import assert from 'node:assert/strict';
import test from 'node:test';
import { TokenBucketLimiter } from '../src/security/rateLimit.ts';

test('token bucket enforces capacity', () => {
  const limiter = new TokenBucketLimiter(2, 1);
  assert.equal(limiter.consume('ip'), true);
  assert.equal(limiter.consume('ip'), true);
  assert.equal(limiter.consume('ip'), false);
});

test('token bucket refills over time', () => {
  const limiter = new TokenBucketLimiter(1, 1);
  const start = 1000;
  assert.equal(limiter.consume('ip', start), true);
  assert.equal(limiter.consume('ip', start + 500), false);
  assert.equal(limiter.consume('ip', start + 1100), true);
});
