import assert from 'node:assert/strict';
import test from 'node:test';
import { ChallengeStore } from '../src/identity/challengeStore.ts';
import { sha256Hex } from '../src/security/secrets.ts';

function makeChallenge(store: ChallengeStore, code: string): void {
  store.register({
    codeHash: sha256Hex(code),
    wpUserId: 1,
    expiresAt: Date.now() + 600000,
    attempts: 0,
    consumed: false,
    webhook: { url: 'http://127.0.0.1:1/cb', secret: 'webhook-secret-value' },
    delivered: false,
  });
}

test('challenge store matches by code hash and prunes expired entries', () => {
  const store = new ChallengeStore();
  makeChallenge(store, 'ABCD1234');
  assert.ok(store.findActive('ABCD1234'));
  assert.equal(store.findActive('wrong'), undefined);

  const challenge = store.findByCode('ABCD1234');
  assert.ok(challenge);
  store.markConsumed(challenge?.codeHash as string);
  assert.equal(store.findActive('ABCD1234'), undefined);

  makeChallenge(store, 'EXPIRED1');
  const expired = store.findByCode('EXPIRED1');
  assert.ok(expired);
  expired.expiresAt = Date.now() - 1;
  store.prune(Date.now());
  assert.equal(store.findByCode('EXPIRED1'), undefined);
});
