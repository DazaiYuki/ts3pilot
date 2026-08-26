import { AppError, ErrorCode } from '../../domain/errors.ts';
import { startAgentServer } from '../../agent/server.ts';
import { ChallengeStore } from '../../identity/challengeStore.ts';
import { VerificationNotifier } from '../../identity/notifier.ts';
import { ChallengeVerifier } from '../../identity/verifier.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runAgentCommand(ctx: CliContext): Promise<void> {
  if (!ctx.config.agent.enabled) {
    throw new AppError(ErrorCode.CONFIG, 'Agent API is not enabled. Run: ts3-manager api enable');
  }
  const identityStore = new ChallengeStore();
  const handle = await startAgentServer(ctx.cfgPath, {
    ts3: ctx.ts3(),
    services: ctx.services,
    logger: ctx.logger.child({ component: 'agent' }),
    identityStore,
  });
  printLine(`ts3-agent listening on ${handle.url} (Ctrl+C to stop)`);
  let verifier: ChallengeVerifier | undefined;
  if (ctx.config.identity.verify.enabled) {
    verifier = new ChallengeVerifier(
      identityStore,
      ctx.ts3(),
      new VerificationNotifier(ctx.config.nodeId, ctx.logger),
      ctx.logger.child({ component: 'identity' }),
      {
        fields: ctx.config.identity.verify.fields,
        maxMatchesPerCycle: ctx.config.identity.verify.maxMatchesPerCycle,
      },
    );
    verifier.start(ctx.config.identity.verify.pollIntervalMs);
    printLine(`identity verification worker started (poll ${ctx.config.identity.verify.pollIntervalMs}ms, fields=${ctx.config.identity.verify.fields.join(',')})`);
  }
  await new Promise<void>((resolve) => {
    const stop = (): void => {
      verifier?.stop();
      void handle.close().then(resolve);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
