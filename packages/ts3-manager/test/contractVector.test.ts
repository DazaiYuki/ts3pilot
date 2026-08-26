import assert from 'node:assert/strict';
import test from 'node:test';
import { signRequest } from '../src/security/hmac.ts';
import { PROTOCOL_TEST_VECTOR } from './hmac.test.ts';

test('shared protocol vector is stable for the PHP client implementation', () => {
  const signature = signRequest(PROTOCOL_TEST_VECTOR.secret, {
    timestamp: PROTOCOL_TEST_VECTOR.timestamp,
    nonce: PROTOCOL_TEST_VECTOR.nonce,
    method: PROTOCOL_TEST_VECTOR.method,
    path: PROTOCOL_TEST_VECTOR.path,
    bodyHash: PROTOCOL_TEST_VECTOR.bodyHash,
  });
  assert.equal(signature, PROTOCOL_TEST_VECTOR.signature);
});
