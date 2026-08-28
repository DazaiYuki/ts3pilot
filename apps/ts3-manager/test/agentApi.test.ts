import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { startAgentServer, type AgentServerHandle } from '../src/agent/server.ts';
import type { AppConfig } from '../src/domain/schemas.ts';
import { createLogger } from '../src/logging/logger.ts';
import { bodyHash, signRequest } from '../src/security/hmac.ts';
import { createPairingState, generatePairingCode } from '../src/security/pairing.ts';
import { MockServiceManager } from '../src/system/providers/mock.ts';
import { MockTeamSpeakClient } from '../src/ts3/mock.ts';
import { ChallengeStore } from '../src/identity/challengeStore.ts';
import { CLI_VERSION } from '../src/version.ts';
import { cleanupDir, tempDir, writeTempConfig } from './util.ts';

interface SignOptions {
  timestamp?: string;
  nonce?: string;
  secret?: string;
}

function signedHeaders(secret: string, method: string, path: string, body: string, options: SignOptions = {}): Record<string, string> {
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? `${Math.random().toString(36).slice(2)}${Date.now()}`;
  const signature = signRequest(secret, {
    timestamp,
    nonce,
    method,
    path,
    bodyHash: bodyHash(body),
  });
  return {
    'x-ts3pilot-timestamp': timestamp,
    'x-ts3pilot-nonce': nonce,
    'x-ts3pilot-signature': signature,
    'content-type': 'application/json',
  };
}

async function startTestServer(dir: string, mutate: (config: AppConfig) => void): Promise<{ handle: AgentServerHandle; configPath: string }> {
  const { path } = writeTempConfig(dir, (config) => {
    config.agent.enabled = true;
    config.agent.host = '127.0.0.1';
    mutate(config);
  });
  const handle = await startAgentServer(
    path,
    {
      ts3: new MockTeamSpeakClient(),
      services: new MockServiceManager(readConfigFile(path)),
      logger: createLogger('error', false),
    },
    { listenPort: 0 },
  );
  return { handle, configPath: path };
}

function readConfigFile(path: string): AppConfig {
  return JSON.parse(readFileSync(path, 'utf8')) as AppConfig;
}

async function request(handle: AgentServerHandle, method: string, path: string, body: string, headers: Record<string, string>): Promise<Response> {
  return fetch(`${handle.url}${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : body,
  });
}

async function withServer(dir: string, mutate: (config: AppConfig) => void, fn: (handle: AgentServerHandle, configPath: string) => Promise<void>): Promise<void> {
  const { handle, configPath } = await startTestServer(dir, mutate);
  try {
    await fn(handle, configPath);
  } finally {
    await handle.close();
    cleanupDir(dir);
  }
}

test('health endpoint is public', async () => {
  await withServer(tempDir('agent-health'), () => {}, async (handle) => {
    const response = await request(handle, 'GET', '/v1/health', '', {});
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { ok: boolean; data: { status: string; service: string } };
    assert.equal(payload.ok, true);
    assert.equal(payload.data.status, 'ok');
    assert.equal(payload.data.service, 'ts3-agent');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
});

test('authed endpoints reject missing/wrong signatures', async () => {
  await withServer(
    tempDir('agent-auth'),
    (config) => {
      config.agent.credential = 'test-credential';
    },
    async (handle) => {
      const noAuth = await request(handle, 'GET', '/v1/info', '', {});
      assert.equal(noAuth.status, 401);

      const wrongSecret = await request(handle, 'GET', '/v1/info', '', signedHeaders('wrong-secret', 'GET', '/v1/info', ''));
      assert.equal(wrongSecret.status, 401);

      const ok = await request(handle, 'GET', '/v1/info', '', signedHeaders('test-credential', 'GET', '/v1/info', ''));
      assert.equal(ok.status, 200);
    },
  );
});

test('replay of the same nonce is rejected', async () => {
  await withServer(
    tempDir('agent-replay'),
    (config) => {
      config.agent.credential = 'test-credential';
    },
    async (handle) => {
      const headers = signedHeaders('test-credential', 'GET', '/v1/info', '', { nonce: 'same-nonce-123' });
      const first = await request(handle, 'GET', '/v1/info', '', headers);
      assert.equal(first.status, 200);
      const second = await request(handle, 'GET', '/v1/info', '', headers);
      assert.equal(second.status, 401);
      const payload = (await second.json()) as { error: { code: string } };
      assert.equal(payload.error.code, 'REPLAY_DETECTED');
    },
  );
});

test('info exposes the cli version and deployment profile', async () => {
  await withServer(
    tempDir('agent-info'),
    (config) => {
      config.agent.credential = 'test-credential';
    },
    async (handle) => {
      const response = await request(handle, 'GET', '/v1/info', '', signedHeaders('test-credential', 'GET', '/v1/info', ''));
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        ok: boolean;
        data: { cliVersion?: string; deployment?: { mode?: string } };
      };
      assert.equal(body.ok, true);
      assert.equal(body.data.cliVersion, CLI_VERSION);
      assert.ok(['native', 'docker', 'remote', 'unknown'].includes(body.data.deployment?.mode ?? ''));
    },
  );
});

test('stale timestamps are rejected', async () => {
  await withServer(
    tempDir('agent-stale'),
    (config) => {
      config.agent.credential = 'test-credential';
    },
    async (handle) => {
      const stale = String(Math.floor(Date.now() / 1000) - 3600);
      const response = await request(handle, 'GET', '/v1/info', '', signedHeaders('test-credential', 'GET', '/v1/info', '', { timestamp: stale }));
      assert.equal(response.status, 401);
    },
  );
});

test('body tampering invalidates the signature', async () => {
  await withServer(
    tempDir('agent-tamper'),
    (config) => {
      config.agent.credential = 'test-credential';
    },
    async (handle) => {
      const body = JSON.stringify({ clientId: 1, kickFrom: 'channel' });
      const headers = signedHeaders('test-credential', 'POST', '/v1/ts3/clients/kick', body);
      const response = await request(handle, 'POST', '/v1/ts3/clients/kick', JSON.stringify({ clientId: 1, kickFrom: 'server' }), headers);
      assert.equal(response.status, 401);
    },
  );
});

test('capability model denies un-granted actions', async () => {
  await withServer(
    tempDir('agent-cap'),
    (config) => {
      config.agent.credential = 'test-credential';
      config.agent.capabilities = config.agent.capabilities.filter((capability) => capability !== 'ts3.clients.kick');
    },
    async (handle) => {
      const body = JSON.stringify({ clientId: 1, kickFrom: 'channel' });
      const response = await request(handle, 'POST', '/v1/ts3/clients/kick', body, signedHeaders('test-credential', 'POST', '/v1/ts3/clients/kick', body));
      assert.equal(response.status, 403);
      const payload = (await response.json()) as { error: { code: string } };
      assert.equal(payload.error.code, 'PERMISSION_DENIED');
    },
  );
});

test('unknown routes and method mismatches are structured errors', async () => {
  await withServer(
    tempDir('agent-404'),
    (config) => {
      config.agent.credential = 'test-credential';
    },
    async (handle) => {
      const notFound = await request(handle, 'GET', '/v1/does-not-exist', '', signedHeaders('test-credential', 'GET', '/v1/does-not-exist', ''));
      assert.equal(notFound.status, 404);
      const methodMismatch = await request(handle, 'POST', '/v1/health', '', {});
      assert.equal(methodMismatch.status, 405);
    },
  );
});

test('request body size is limited', async () => {
  await withServer(
    tempDir('agent-body'),
    (config) => {
      config.agent.credential = 'test-credential';
      config.agent.maxBodyBytes = 1024;
    },
    async (handle) => {
      const body = JSON.stringify({ clientId: 1, reason: 'x'.repeat(1000), kickFrom: 'channel' });
      const response = await request(handle, 'POST', '/v1/ts3/clients/kick', body, signedHeaders('test-credential', 'POST', '/v1/ts3/clients/kick', body));
      assert.equal(response.status, 413);
    },
  );
});

test('maintenance endpoints report not-implemented honestly', async () => {
  await withServer(
    tempDir('agent-maint'),
    (config) => {
      config.agent.credential = 'test-credential';
      config.agent.capabilities = [...config.agent.capabilities, 'server.update'];
    },
    async (handle) => {
      const response = await request(handle, 'POST', '/v1/maintenance/update', '{}', signedHeaders('test-credential', 'POST', '/v1/maintenance/update', '{}'));
      assert.equal(response.status, 501);
      const payload = (await response.json()) as { error: { code: string } };
      assert.equal(payload.error.code, 'NOT_IMPLEMENTED');
    },
  );
});

test('channel create works through the API with the mock client', async () => {
  await withServer(
    tempDir('agent-channel'),
    (config) => {
      config.agent.credential = 'test-credential';
    },
    async (handle) => {
      const body = JSON.stringify({ name: 'API Created Channel', parentId: 1 });
      const create = await request(handle, 'POST', '/v1/ts3/channels/create', body, signedHeaders('test-credential', 'POST', '/v1/ts3/channels/create', body));
      assert.equal(create.status, 200);
      const createPayload = (await create.json()) as { data: { channelId: number } };
      assert.ok(createPayload.data.channelId > 3);

      const list = await request(handle, 'GET', '/v1/ts3/channels', '', signedHeaders('test-credential', 'GET', '/v1/ts3/channels', ''));
      const listPayload = (await list.json()) as { data: Array<{ channelId: number; name: string }> };
      assert.equal(listPayload.data.some((channel) => channel.channelId === createPayload.data.channelId && channel.name === 'API Created Channel'), true);
    },
  );
});

test('pairing flow issues a long-term credential and is single-use', async () => {
  const code = generatePairingCode();
  await withServer(
    tempDir('agent-pair'),
    (config) => {
      config.agent.pairing = createPairingState(code);
    },
    async (handle, configPath) => {
      const body = JSON.stringify({ pairingCode: code });
      const pairResponse = await request(handle, 'POST', '/v1/agent/pair', body, signedHeaders(code, 'POST', '/v1/agent/pair', body));
      assert.equal(pairResponse.status, 200);
      const pairPayload = (await pairResponse.json()) as { data: { credential: string; nodeId: string } };
      assert.ok(pairPayload.data.credential.length >= 32);

      const saved = readConfigFile(configPath);
      assert.equal(saved.agent.pairing, undefined);
      assert.equal(saved.agent.credential, pairPayload.data.credential);

      const info = await request(handle, 'GET', '/v1/info', '', signedHeaders(pairPayload.data.credential, 'GET', '/v1/info', ''));
      assert.equal(info.status, 200);

      const secondPair = await request(handle, 'POST', '/v1/agent/pair', body, signedHeaders(code, 'POST', '/v1/agent/pair', body));
      assert.equal(secondPair.status, 401);
    },
  );
});

test('rotate-secret invalidates the previous credential', async () => {
  await withServer(
    tempDir('agent-rotate'),
    (config) => {
      config.agent.credential = 'old-credential';
    },
    async (handle, configPath) => {
      const rotate = await request(handle, 'POST', '/v1/agent/rotate-secret', '{}', signedHeaders('old-credential', 'POST', '/v1/agent/rotate-secret', '{}'));
      assert.equal(rotate.status, 200);
      const rotatePayload = (await rotate.json()) as { data: { credential: string } };
      assert.notEqual(rotatePayload.data.credential, 'old-credential');

      const withOld = await request(handle, 'GET', '/v1/info', '', signedHeaders('old-credential', 'GET', '/v1/info', ''));
      assert.equal(withOld.status, 401);
      const withNew = await request(handle, 'GET', '/v1/info', '', signedHeaders(rotatePayload.data.credential, 'GET', '/v1/info', ''));
      assert.equal(withNew.status, 200);
      assert.equal(readConfigFile(configPath).agent.credential, rotatePayload.data.credential);
    },
  );
});

test('disable revokes the credential', async () => {
  await withServer(
    tempDir('agent-disable'),
    (config) => {
      config.agent.credential = 'test-credential';
    },
    async (handle, configPath) => {
      const disable = await request(handle, 'POST', '/v1/agent/disable', '{}', signedHeaders('test-credential', 'POST', '/v1/agent/disable', '{}'));
      assert.equal(disable.status, 200);
      const saved = readConfigFile(configPath);
      assert.equal(saved.agent.enabled, false);
      assert.equal(saved.agent.credential, '');
    },
  );
});

test('identity challenge register endpoint stores the challenge', async () => {
  const dir = tempDir('agent-identity');
  const { path } = writeTempConfig(dir, (config) => {
    config.agent.enabled = true;
    config.agent.credential = 'test-credential';
    config.agent.host = '127.0.0.1';
  });
  const store = new ChallengeStore();
  const handle = await startAgentServer(
    path,
    {
      ts3: new MockTeamSpeakClient(),
      services: new MockServiceManager(readConfigFile(path)),
      logger: createLogger('error', false),
      identityStore: store,
    },
    { listenPort: 0 },
  );
  try {
    const body = JSON.stringify({
      wpUserId: 42,
      code: 'IDENT42',
      webhookUrl: 'http://127.0.0.1:9/wp-json/ts3pilot/v1/identity/callback',
      webhookSecret: 'webhook-secret-value',
    });
    const response = await request(handle, 'POST', '/v1/identity/challenge', body, signedHeaders('test-credential', 'POST', '/v1/identity/challenge', body));
    assert.equal(response.status, 200);
    assert.equal(store.list().length, 1);
    assert.equal(store.list()[0]?.wpUserId, 42);

    const denied = await request(
      handle,
      'POST',
      '/v1/identity/challenge',
      body,
      signedHeaders('test-credential', 'POST', '/v1/identity/challenge', JSON.stringify({ ...JSON.parse(body) as object, wpUserId: 43 })),
    );
    assert.equal(denied.status, 401);
  } finally {
    await handle.close();
    cleanupDir(dir);
  }
});

test('maintenance backup and restore work through the API', async () => {
  const dir = tempDir('agent-maint-real');
  const installPath = join(dir, 'ts3');
  mkdirSync(installPath, { recursive: true });
  writeFileSync(join(installPath, 'ts3server.ini'), 'query_port=10011');
  writeFileSync(join(installPath, 'ts3server.sqlitedb'), 'sqlite-db-bytes');
  const { path } = writeTempConfig(dir, (config) => {
    config.agent.enabled = true;
    config.agent.credential = 'test-credential';
    config.agent.host = '127.0.0.1';
    config.ts3.installPath = installPath;
    config.agent.capabilities = [...config.agent.capabilities, 'server.restore'];
  });
  const handle = await startAgentServer(
    path,
    {
      ts3: new MockTeamSpeakClient(),
      services: new MockServiceManager(readConfigFile(path)),
      logger: createLogger('error', false),
    },
    { listenPort: 0 },
  );
  try {
    const backupBody = JSON.stringify({ destPath: join(dir, 'backup.tar.gz') });
    const backupRes = await request(handle, 'POST', '/v1/maintenance/backup', backupBody, signedHeaders('test-credential', 'POST', '/v1/maintenance/backup', backupBody));
    assert.equal(backupRes.status, 200);
    const backupPayload = (await backupRes.json()) as { data: { archivePath: string } };
    assert.ok(existsSync(backupPayload.data.archivePath));

    const dryBody = JSON.stringify({ archivePath: backupPayload.data.archivePath, destPath: installPath, dryRun: true });
    const dryRes = await request(handle, 'POST', '/v1/maintenance/restore', dryBody, signedHeaders('test-credential', 'POST', '/v1/maintenance/restore', dryBody));
    assert.equal(dryRes.status, 200);
    const dryPayload = (await dryRes.json()) as { data: { ok: boolean; dryRun: boolean } };
    assert.equal(dryPayload.data.ok, true);
    assert.equal(dryPayload.data.dryRun, true);

    const restoreBody = JSON.stringify({ archivePath: backupPayload.data.archivePath, destPath: installPath, force: true });
    const restoreRes = await request(handle, 'POST', '/v1/maintenance/restore', restoreBody, signedHeaders('test-credential', 'POST', '/v1/maintenance/restore', restoreBody));
    assert.equal(restoreRes.status, 200);
    const restorePayload = (await restoreRes.json()) as { data: { ok: boolean; restoredFiles: string[] } };
    assert.equal(restorePayload.data.ok, true);
    assert.ok(restorePayload.data.restoredFiles.includes('ts3server.ini'));
    assert.equal(readFileSync(join(installPath, 'ts3server.sqlitedb'), 'utf8'), 'sqlite-db-bytes');
  } finally {
    await handle.close();
    cleanupDir(dir);
  }
});
