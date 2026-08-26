import { ChallengeStore } from '../../identity/challengeStore.ts';
import { VerificationNotifier } from '../../identity/notifier.ts';
import { ChallengeVerifier } from '../../identity/verifier.ts';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import { sha256Hex } from '../../security/secrets.ts';
import { flagNumber, flagString } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runIdentityCommand(ctx: CliContext, positionals: readonly string[], flags: Record<string, string | boolean>): Promise<void> {
  const sub = positionals[0];
  switch (sub) {
    case 'challenge':
      runChallengeAdd(flags);
      return;
    case 'worker':
      await runWorker(ctx, positionals[1] ?? 'once');
      return;
    case 'status':
      runStatus(ctx);
      return;
    default:
      throw new AppError(ErrorCode.USER, 'usage: identity <challenge|worker|status>');
  }
}

function runChallengeAdd(flags: Record<string, string | boolean>): void {
  const wpUserId = Number(flagString(flags, 'user') ?? flagNumber(flags, 'user'));
  const code = flagString(flags, 'code');
  const webhookUrl = flagString(flags, 'webhook-url');
  const webhookSecret = flagString(flags, 'webhook-secret');
  if (!Number.isInteger(wpUserId) || wpUserId <= 0 || code === undefined || webhookUrl === undefined || webhookSecret === undefined) {
    throw new AppError(
      ErrorCode.USER,
      'usage: identity challenge add --user <id> --code <code> --webhook-url <url> --webhook-secret <secret> [--ttl-sec <n>]',
    );
  }
  if (!/^[A-Za-z0-9]{6,64}$/.test(code)) {
    throw new AppError(ErrorCode.USER, 'Challenge code must be 6-64 alphanumeric characters');
  }
  const ttlSec = flagNumber(flags, 'ttl-sec') ?? 600;
  const store = new ChallengeStore();
  store.register({
    codeHash: sha256Hex(code),
    wpUserId,
    expiresAt: Date.now() + ttlSec * 1000,
    attempts: 0,
    consumed: false,
    webhook: { url: webhookUrl, secret: webhookSecret },
    delivered: false,
  });
  printLine('challenge registered (in-memory)');
  printLine(`wp_user_id: ${wpUserId}`);
  printLine(`expires_at: ${new Date(Date.now() + ttlSec * 1000).toISOString()}`);
}

async function runWorker(ctx: CliContext, mode: string): Promise<void> {
  if (mode !== 'once' && mode !== 'start') {
    throw new AppError(ErrorCode.USER, 'usage: identity worker <once|start>');
  }
  const store = new ChallengeStore();
  const notifier = new VerificationNotifier(ctx.config.nodeId, ctx.logger);
  const verifier = new ChallengeVerifier(store, ctx.ts3(), notifier, ctx.logger, {
    fields: ctx.config.identity.verify.fields,
    maxMatchesPerCycle: ctx.config.identity.verify.maxMatchesPerCycle,
  });
  if (mode === 'once') {
    const results = await verifier.verifyOnce();
    printLine(`verification cycle complete: ${results.length} match(es)`);
    for (const result of results) {
      printLine(`  verified wp_user_id=${result.wpUserId} ts3_uid=${result.ts3Uid} delivered=${result.delivered}`);
    }
    return;
  }
  verifier.start(ctx.config.identity.verify.pollIntervalMs);
  printLine(`identity verification worker started (poll ${ctx.config.identity.verify.pollIntervalMs}ms)`);
  await new Promise<void>((resolve) => {
    const stop = (): void => {
      verifier.stop();
      resolve();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

function runStatus(ctx: CliContext): void {
  const store = new ChallengeStore();
  const challenges = store.list();
  printLine(`identity verification: ${ctx.config.identity.verify.enabled ? 'enabled' : 'disabled'}`);
  printLine(`fields: ${ctx.config.identity.verify.fields.join(', ')}`);
  printLine(`poll interval: ${ctx.config.identity.verify.pollIntervalMs}ms`);
  printLine(`challenges in memory: ${challenges.length}`);
}
