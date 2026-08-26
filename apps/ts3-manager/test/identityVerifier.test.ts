import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import { ChallengeStore } from '../src/identity/challengeStore.ts';
import { VerificationNotifier } from '../src/identity/notifier.ts';
import { ChallengeVerifier } from '../src/identity/verifier.ts';
import { createLogger } from '../src/logging/logger.ts';
import { sha256Hex } from '../src/security/secrets.ts';
import { verifySignature, bodyHash } from '../src/security/hmac.ts';
import type { Ts3Client } from '../src/domain/models.ts';
import type { TeamSpeakClient, Ts3FeatureValue } from '../src/ts3/teamSpeakClient.ts';

class FakeTs3Client implements TeamSpeakClient {
  readonly kind = 'mock' as const;
  private readonly clientList: Ts3Client[];

  constructor(clientList: Ts3Client[]) {
    this.clientList = clientList;
  }

  supports(feature: Ts3FeatureValue): boolean {
    return feature === 'clients.list';
  }

  async status() {
    return { online: true };
  }

  async clients(): Promise<Ts3Client[]> {
    return this.clientList;
  }

  async channels() {
    return [];
  }

  async channelCreate() {
    return { channelId: 1 };
  }

  async channelEdit() {
    return { ok: true as const };
  }

  async channelDelete() {
    return { ok: true as const };
  }

  async channelMove() {
    return { ok: true as const };
  }

  async kickClient() {
    return { ok: true as const };
  }

  async banClient() {
    return { ok: true as const };
  }

  async moveClient() {
    return { ok: true as const };
  }

  async pokeClient() {
    return { ok: true as const };
  }
}

interface CapturedRequest {
  headers: Record<string, string>;
  body: string;
}

function startWebhookServer(): Promise<{ server: Server; port: number; captured: CapturedRequest[] }> {
  return new Promise((resolve, reject) => {
    const captured: CapturedRequest[] = [];
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8');
      });
      req.on('end', () => {
        captured.push({
          headers: {
            'x-ts3cops-timestamp': String(req.headers['x-ts3cops-timestamp'] ?? ''),
            'x-ts3cops-nonce': String(req.headers['x-ts3cops-nonce'] ?? ''),
            'x-ts3cops-signature': String(req.headers['x-ts3cops-signature'] ?? ''),
          },
          body,
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        reject(new Error('failed to bind webhook server'));
        return;
      }
      resolve({ server, port: address.port, captured });
    });
  });
}

function makeChallenge(store: ChallengeStore, code: string, wpUserId: number, webhook: { url: string; secret: string }, expiresAt = Date.now() + 600000): void {
  store.register({
    codeHash: sha256Hex(code),
    wpUserId,
    expiresAt,
    attempts: 0,
    consumed: false,
    webhook,
    delivered: false,
  });
}

test('identity verifier matches a nickname code, consumes it and delivers a signed webhook', async () => {
  const { server, port, captured } = await startWebhookServer();
  try {
    const secret = 'webhook-secret-value';
    const store = new ChallengeStore();
    const code = 'A1B2C3D4';
    makeChallenge(store, code, 42, { url: `http://127.0.0.1:${port}/wp-json/ts3-operations/v1/identity/callback`, secret });
    const ts3 = new FakeTs3Client([{ clientId: 1, nickname: `Player ${code}`, channelId: 1, clientType: 0, uniqueId: 'ts3uid-abc' }]);
    const verifier = new ChallengeVerifier(
      store,
      ts3,
      new VerificationNotifier('node-1', createLogger('error', false)),
      createLogger('error', false),
    );

    const results = await verifier.verifyOnce();
    assert.equal(results.length, 1);
    assert.equal(results[0]?.wpUserId, 42);
    assert.equal(results[0]?.ts3Uid, 'ts3uid-abc');
    assert.equal(results[0]?.delivered, true);
    assert.equal(store.findActive(code), undefined);
    assert.equal(captured.length, 1);
    const request0 = captured[0] as CapturedRequest;

    const payload = JSON.parse(request0.body) as { wpUserId: number; ts3Uid: string; nodeId: string };
    assert.equal(payload.wpUserId, 42);
    assert.equal(payload.ts3Uid, 'ts3uid-abc');
    assert.equal(payload.nodeId, 'node-1');
    const valid = verifySignature(secret, {
      timestamp: request0.headers['x-ts3cops-timestamp'] ?? '',
      nonce: request0.headers['x-ts3cops-nonce'] ?? '',
      method: 'POST',
      path: '/wp-json/ts3-operations/v1/identity/callback',
      bodyHash: bodyHash(request0.body),
    }, request0.headers['x-ts3cops-signature'] ?? '');
    assert.equal(valid, true);

    const second = await verifier.verifyOnce();
    assert.equal(second.length, 0);
  } finally {
    server.close();
  }
});

test('identity verifier skips clients without a unique id and locks after max attempts', async () => {
  const store = new ChallengeStore();
  const code = 'FF00FF00';
  makeChallenge(store, code, 7, { url: 'http://127.0.0.1:1/callback', secret: 'webhook-secret-value' });
  const ts3 = new FakeTs3Client([{ clientId: 1, nickname: code, channelId: 1, clientType: 0 }]);
  const verifier = new ChallengeVerifier(
    store,
    ts3,
    new VerificationNotifier('node-1', createLogger('error', false)),
    createLogger('error', false),
    { maxAttemptsPerChallenge: 3 },
  );

  for (let i = 0; i < 3; i += 1) {
    await verifier.verifyOnce();
    assert.equal(store.findActive(code) !== undefined, true);
  }
  await verifier.verifyOnce();
  assert.equal(store.findActive(code), undefined);
});

test('identity verifier ignores expired challenges and supports away-message field', async () => {
  const store = new ChallengeStore();
  const expiredCode = 'E1E1E1E1';
  makeChallenge(store, expiredCode, 1, { url: 'http://127.0.0.1:1/callback', secret: 'webhook-secret-value' }, Date.now() - 1000);
  const awayCode = 'A2A2A2A2';
  makeChallenge(store, awayCode, 2, { url: 'http://127.0.0.1:1/callback', secret: 'webhook-secret-value' });

  const ts3 = new FakeTs3Client([
    { clientId: 1, nickname: expiredCode, channelId: 1, clientType: 0, uniqueId: 'uid-1' },
    { clientId: 2, nickname: 'Player', channelId: 1, clientType: 0, uniqueId: 'uid-2', away: true, awayMessage: `brb ${awayCode}` },
  ]);
  const verifier = new ChallengeVerifier(
    store,
    ts3,
    new VerificationNotifier('node-1', createLogger('error', false)),
    createLogger('error', false),
    { field: 'away' },
  );

  const results = await verifier.verifyOnce();
  assert.equal(results.length, 1);
  assert.equal(results[0]?.wpUserId, 2);
});
