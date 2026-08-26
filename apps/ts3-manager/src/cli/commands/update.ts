import { AppError, ErrorCode } from '../../domain/errors.ts';
import { flagBool } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export function runUpdateCommand(ctx: CliContext, flags: Record<string, string | boolean>): void {
  const install = ctx.config.ts3.install;
  printLine('Update pipeline (checksum-verified, rollback-capable) is planned.');
  if (!install.verified || install.sourceUrl.length === 0 || install.sha256.length === 0) {
    printLine('No verified update source configured; refusing to guess an official URL.');
    printLine('Configure ts3.install.sourceUrl + sha256 (verified against official TeamSpeak documentation) to enable updates.');
    if (flagBool(flags, 'execute')) {
      throw new AppError(ErrorCode.NOT_IMPLEMENTED, 'Update execution requires a verified source configuration and the update pipeline implementation (roadmap).');
    }
    return;
  }
  throw new AppError(ErrorCode.NOT_IMPLEMENTED, 'Update execution pipeline is planned; only source validation exists in this MVP.');
}
