import assert from 'node:assert/strict';
import test from 'node:test';
import { bodyHash, buildCanonicalString, signRequest, verifySignature } from '../src/security/hmac.ts';

export const PROTOCOL_TEST_VECTOR = {
  timestamp: '1700000000',
  nonce: 'a'.repeat(32),
  method: 'POST',
  path: '/v1/ts3/status',
  body: '{}',
  bodyHash: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
  secret: 'test-secret',
  signature: 'b8ea68ab27fdc4bc30753a62507e9030bcb217a8f897807ea097728d5436836b',
} as const;

test('canonical string matches the protocol v1 format', () => {
  const canonical = buildCanonicalString({
    timestamp: PROTOCOL_TEST_VECTOR.timestamp,
    nonce: PROTOCOL_TEST_VECTOR.nonce,
    method: PROTOCOL_TEST_VECTOR.method,
    path: PROTOCOL_TEST_VECTOR.path,
    bodyHash: PROTOCOL_TEST_VECTOR.bodyHash,
  });
  assert.equal(
    canonical,
    [
      'TS3PILOT-HMAC-SHA256 v1',
      '1700000000',
      'a'.repeat(32),
      'POST',
      '/v1/ts3/status',
      '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    ].join('\n'),
  );
});

test('signRequest matches the cross-language test vector', () => {
  const signature = signRequest(PROTOCOL_TEST_VECTOR.secret, {
    timestamp: PROTOCOL_TEST_VECTOR.timestamp,
    nonce: PROTOCOL_TEST_VECTOR.nonce,
    method: PROTOCOL_TEST_VECTOR.method,
    path: PROTOCOL_TEST_VECTOR.path,
    bodyHash: PROTOCOL_TEST_VECTOR.bodyHash,
  });
  assert.equal(signature, PROTOCOL_TEST_VECTOR.signature);
});

test('verifySignature accepts a valid signature and rejects a wrong secret', () => {
  const input = {
    timestamp: PROTOCOL_TEST_VECTOR.timestamp,
    nonce: PROTOCOL_TEST_VECTOR.nonce,
    method: PROTOCOL_TEST_VECTOR.method,
    path: PROTOCOL_TEST_VECTOR.path,
    bodyHash: PROTOCOL_TEST_VECTOR.bodyHash,
  };
  assert.equal(verifySignature('test-secret', input, PROTOCOL_TEST_VECTOR.signature), true);
  assert.equal(verifySignature('wrong-secret', input, PROTOCOL_TEST_VECTOR.signature), false);
  assert.equal(verifySignature('test-secret', { ...input, nonce: 'b'.repeat(32) }, PROTOCOL_TEST_VECTOR.signature), false);
  assert.equal(verifySignature('test-secret', input, 'not-a-hex-signature'), false);
});

test('bodyHash produces the vector body hash', () => {
  assert.equal(bodyHash(PROTOCOL_TEST_VECTOR.body), PROTOCOL_TEST_VECTOR.bodyHash);
});
