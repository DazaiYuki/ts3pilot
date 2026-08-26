import { AppError, ErrorCode } from '../../domain/errors.ts';
import { startAgentServer } from '../../agent/server.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runAgentCommand(ctx: CliContext): Promise<void> {
  if (!ctx.config.agent.enabled) {
    throw new AppError(ErrorCode.CONFIG, 'Agent API is not enabled. Run: ts3-manager api enable');
  }
  const handle = await startAgentServer(ctx.cfgPath, {
    ts3: ctx.ts3(),
    services: ctx.services,
    logger: ctx.logger.child({ component: 'agent' }),
  });
  printLine(`ts3-agent listening on ${handle.url} (Ctrl+C to stop)`);
  await new Promise<void>((resolve) => {
    const stop = (): void => {
      void handle.close().then(resolve);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
