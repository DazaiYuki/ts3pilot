import { randomBytes } from 'node:crypto';
import { constantTimeEqual, sha256Hex } from './secrets.ts';

export const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePairingCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

export interface PairingState {
  codeHash: string;
  expiresAt: number;
  consumed: boolean;
}

export function createPairingState(code: string): PairingState {
  return {
    codeHash: sha256Hex(code),
    expiresAt: Date.now() + PAIRING_CODE_TTL_MS,
    consumed: false,
  };
}

export function pairingMatches(state: PairingState, code: string, now = Date.now()): boolean {
  if (state.consumed) return false;
  if (now > state.expiresAt) return false;
  return constantTimeEqual(state.codeHash, sha256Hex(code));
}
