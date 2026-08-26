import { sha256Hex } from '../security/secrets.ts';

export interface IdentityWebhook {
  url: string;
  secret: string;
}

export interface IdentityChallenge {
  codeHash: string;
  wpUserId: number;
  expiresAt: number;
  attempts: number;
  consumed: boolean;
  webhook: IdentityWebhook;
  verifiedAt?: number;
  delivered: boolean;
}

/**
 * In-memory store for identity binding challenges.
 *
 * Challenges are single-use, expire after a short TTL and carry an attempt
 * counter to limit brute-force probing. The plaintext code is never stored.
 */
export class ChallengeStore {
  private readonly challenges = new Map<string, IdentityChallenge>();

  register(challenge: IdentityChallenge): void {
    this.challenges.set(challenge.codeHash, challenge);
  }

  findByCode(code: string): IdentityChallenge | undefined {
    return this.challenges.get(sha256Hex(code));
  }

  findActive(code: string, now = Date.now()): IdentityChallenge | undefined {
    const challenge = this.findByCode(code);
    if (challenge === undefined || challenge.consumed || now > challenge.expiresAt) {
      return undefined;
    }
    return challenge;
  }

  markConsumed(codeHash: string): void {
    const challenge = this.challenges.get(codeHash);
    if (challenge !== undefined) challenge.consumed = true;
  }

  markDelivered(codeHash: string): void {
    const challenge = this.challenges.get(codeHash);
    if (challenge !== undefined) challenge.delivered = true;
  }

  prune(now = Date.now()): void {
    for (const [hash, challenge] of this.challenges) {
      if (now > challenge.expiresAt) this.challenges.delete(hash);
    }
  }

  list(): IdentityChallenge[] {
    return [...this.challenges.values()];
  }

  clear(): void {
    this.challenges.clear();
  }
}
