import assert from 'node:assert/strict';
import test from 'node:test';
import { createPairingState, generatePairingCode, pairingMatches, PAIRING_CODE_TTL_MS } from '../src/security/pairing.ts';

test('pairing code is single-use and expires', () => {
  const code = generatePairingCode();
  assert.match(code, /^[A-Z0-9]{8}$/);
  const state = createPairingState(code);
  assert.equal(pairingMatches(state, code), true);
  assert.equal(pairingMatches(state, 'WRONG'), false);
  const consumed = { ...state, consumed: true };
  assert.equal(pairingMatches(consumed, code), false);
  const expired = { ...state, expiresAt: Date.now() - 1 };
  assert.equal(pairingMatches(expired, code), false);
});

test('pairing TTL is 15 minutes', () => {
  assert.equal(PAIRING_CODE_TTL_MS, 15 * 60 * 1000);
});
