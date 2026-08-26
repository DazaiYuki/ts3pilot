import { AppError, ErrorCode } from '../domain/errors.ts';
import type { Logger } from '../logging/logger.ts';
import { bodyHash, signRequest } from '../security/hmac.ts';
import { randomHex } from '../security/secrets.ts';
import type { IdentityWebhook } from './challengeStore.ts';

export interface VerificationPayload {
  wpUserId: number;
  ts3Uid: string;
  verifiedAt: number;
  nodeId: string;
}

export interface VerificationResult {
  wpUserId: number;
  ts3Uid: string;
  verifiedAt: number;
  delivered: boolean;
}

/**
 * HMAC-signed webhook delivery of successful identity verification results.
 *
 * The signature uses the same protocol v1 canonical string as the Agent API so
 * the WordPress side reuses its existing verifier.
 */
export class VerificationNotifier {
  private readonly nodeId: string;
  private readonly logger: Logger;

  constructor(nodeId: string, logger: Logger) {
    this.nodeId = nodeId;
    this.logger = logger;
  }

  async notify(webhook: IdentityWebhook, payload: Omit<VerificationPayload, 'nodeId'>): Promise<VerificationResult> {
    const full: VerificationPayload = { ...payload, nodeId: this.nodeId };
    const body = JSON.stringify(full);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomHex(16);
    const path = safePathname(webhook.url);
    const signature = signRequest(webhook.secret, {
      timestamp,
      nonce,
      method: 'POST',
      path,
      bodyHash: bodyHash(body),
    });

    let response: Response;
    try {
      response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ts3cops-timestamp': timestamp,
          'x-ts3cops-nonce': nonce,
          'x-ts3cops-signature': signature,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      this.logger.warn('identity webhook delivery failed', { error: error instanceof Error ? error.message : 'unknown' });
      throw new AppError(ErrorCode.NETWORK, 'Identity webhook delivery failed', { cause: error });
    }
    if (!response.ok) {
      this.logger.warn('identity webhook rejected', { status: response.status });
      throw new AppError(ErrorCode.NETWORK, `Identity webhook rejected with HTTP ${response.status}`);
    }
    this.logger.info('identity webhook delivered', { wpUserId: full.wpUserId });
    return { wpUserId: full.wpUserId, ts3Uid: full.ts3Uid, verifiedAt: full.verifiedAt, delivered: true };
  }
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}
