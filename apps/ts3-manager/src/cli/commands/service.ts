import type { ServiceStatus } from '../../domain/models.ts';
import type { CliContext } from '../context.ts';
import { printLine, printJson } from '../print.ts';

export async function runServiceCommand(ctx: CliContext, action: 'start' | 'stop' | 'restart' | 'status'): Promise<void> {
  let status: ServiceStatus;
  switch (action) {
    case 'start':
      status = await ctx.services.start();
      break;
    case 'stop':
      status = await ctx.services.stop();
      break;
    case 'restart':
      status = await ctx.services.restart();
      break;
    case 'status':
      status = await ctx.services.status();
      break;
  }
  if (process.stdout.isTTY) {
    printLine(`state: ${status.state}`);
    printLine(`provider: ${status.provider}`);
    if (status.pid !== undefined) printLine(`pid: ${status.pid}`);
    if (status.uptimeSec !== undefined) printLine(`uptime_sec: ${status.uptimeSec}`);
    if (status.message !== undefined) printLine(`message: ${status.message}`);
  } else {
    printJson(status);
  }
}
