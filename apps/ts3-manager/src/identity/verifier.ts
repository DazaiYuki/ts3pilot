import { AppError, ErrorCode } from '../domain/errors.ts';
import type { Ts3Client } from '../domain/models.ts';
import type { Logger } from '../logging/logger.ts';
import type { TeamSpeakClient } from '../ts3/teamSpeakClient.ts';
import type { ChallengeStore, IdentityChallenge } from './challengeStore.ts';
import type { VerificationNotifier, VerificationResult } from './notifier.ts';

export interface IdentityVerifierOptions {
  field: 'nickname' | 'away' | 'nickname-away';
  maxMatchesPerCycle: number;
  maxAttemptsPerChallenge: number;
}

const DEFAULT_OPTIONS: IdentityVerifierOptions = {
  field: 'nickname',
  maxMatchesPerCycle: 5,
  maxAttemptsPerChallenge: 10,
};

/**
 * Challenge verification worker.
 *
 * Polls the TS3 client list and matches the user-provided one-time challenge
 * code in the configured field(s). On a match the challenge is consumed and
 * the result is delivered to the WordPress webhook.
 */
export class ChallengeVerifier {
  private readonly options: IdentityVerifierOptions;
  private timer: NodeJS.Timeout | undefined;
  private readonly store: ChallengeStore;
  private readonly ts3: TeamSpeakClient;
  private readonly notifier: VerificationNotifier;
  private readonly logger: Logger;

  constructor(store: ChallengeStore, ts3: TeamSpeakClient, notifier: VerificationNotifier, logger: Logger, options: Partial<IdentityVerifierOptions> = {}) {
    this.store = store;
    this.ts3 = ts3;
    this.notifier = notifier;
    this.logger = logger;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async verifyOnce(now = Date.now()): Promise<VerificationResult[]> {
    this.store.prune(now);
    if (!this.ts3.supports('clients.list')) {
      this.logger.warn('identity verifier: TS3 client does not support clients.list');
      return [];
    }
    let clients: Ts3Client[];
    try {
      clients = await this.ts3.clients();
    } catch (error) {
      this.logger.warn('identity verifier: failed to fetch clients', { error: error instanceof Error ? error.message : 'unknown' });
      return [];
    }

    const results: VerificationResult[] = [];
    for (const client of clients) {
      if (client.clientType !== 0 || results.length >= this.options.maxMatchesPerCycle) continue;
      const candidates = this.extractCodes(client);
      let challenge: IdentityChallenge | undefined;
      for (const code of candidates) {
        const found = this.store.findActive(code, now);
        if (found !== undefined) {
          challenge = found;
          break;
        }
      }
      if (challenge === undefined) continue;

      challenge.attempts += 1;
      if (challenge.attempts > this.options.maxAttemptsPerChallenge) {
        this.store.markConsumed(challenge.codeHash);
        this.logger.warn('identity challenge locked after too many attempts', { wpUserId: challenge.wpUserId });
        continue;
      }
      if (client.uniqueId === undefined || client.uniqueId.length === 0) {
        continue;
      }

      this.store.markConsumed(challenge.codeHash);
      challenge.verifiedAt = now;
      let delivered = false;
      try {
        const deliveredResult = await this.notifier.notify(challenge.webhook, {
          wpUserId: challenge.wpUserId,
          ts3Uid: client.uniqueId,
          verifiedAt: now,
        });
        delivered = deliveredResult.delivered;
        this.store.markDelivered(challenge.codeHash);
      } catch (error) {
        if (error instanceof AppError && error.code === ErrorCode.NETWORK) {
          this.logger.warn('identity challenge verified but webhook pending retry', { wpUserId: challenge.wpUserId });
        } else {
          throw error;
        }
      }
      results.push({ wpUserId: challenge.wpUserId, ts3Uid: client.uniqueId, verifiedAt: now, delivered });
    }
    return results;
  }

  start(pollIntervalMs: number): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      void this.verifyOnce().catch((error) => {
        this.logger.error('identity verifier cycle failed', { error: error instanceof Error ? error.message : 'unknown' });
      });
    }, pollIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private extractCodes(client: Ts3Client): string[] {
    const codes: string[] = [];
    const field = this.options.field;
    const nickname = client.nickname;
    const away = client.awayMessage ?? '';
    if (field === 'nickname' || field === 'nickname-away') {
      codes.push(...findTokens(nickname));
    }
    if (field === 'away' || field === 'nickname-away') {
      codes.push(...findTokens(away));
    }
    return codes;
  }
}

function findTokens(value: string): string[] {
  if (value.length === 0) return [];
  const matches = [...value.matchAll(/(?<![A-Z0-9])([A-Z0-9]{6,64})(?![A-Z0-9])/gi)];
  const codes: string[] = [];
  for (const match of matches) {
    const code = match[1];
    if (code !== undefined) codes.push(code);
  }
  return codes;
}

export function challengeStillPending(challenge: IdentityChallenge | undefined): boolean {
  return challenge !== undefined && challenge.consumed && !challenge.delivered;
}
