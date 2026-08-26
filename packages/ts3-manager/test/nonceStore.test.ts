import assert from 'node:assert/strict';
import test from 'node:test';
import { NonceStore } from '../src/security/nonceStore.ts';

test('nonce store rejects replays and expires entries', () => {
  const store = new NonceStore(1000);
  const now = 5000;
  assert.equal(store.checkAndStore('n1', now), true);
  assert.equal(store.checkAndStore('n1', now + 10), false);
  assert.equal(store.checkAndStore('n1', now + 5000), true);
});
