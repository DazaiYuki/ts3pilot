import { createHmac } from 'node:crypto';
import { constantTimeEqual, sha256Hex } from './secrets.ts';

export const AUTH_PROTOCOL = 'TS3PILOT-HMAC-SHA256';
export const AUTH_PROTOCOL_VERSION = 1;

export interface CanonicalInput {
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  bodyHash: string;
}

export function buildCanonicalString(input: CanonicalInput): string {
  return [
    `${AUTH_PROTOCOL} v${AUTH_PROTOCOL_VERSION}`,
    input.timestamp,
    input.nonce,
    input.method.toUpperCase(),
    input.path,
    input.bodyHash,
  ].join('\n');
}

export function signRequest(secret: string, input: CanonicalInput): string {
  return createHmac('sha256', secret).update(buildCanonicalString(input)).digest('hex');
}

export function verifySignature(secret: string, input: CanonicalInput, signature: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  return constantTimeEqual(signRequest(secret, input), signature.toLowerCase());
}

export function bodyHash(body: string): string {
  return sha256Hex(body);
}
