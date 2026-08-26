import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { flagNumber } from '../args.ts';
import type { CliContext } from '../context.ts';
import { mockLogLines, readLogFiles } from '../../services/logs.ts';
import { printLine } from '../print.ts';

export function runLogsCommand(ctx: CliContext, flags: Record<string, string | boolean>): void {
  const maxLines = flagNumber(flags, 'lines') ?? 50;
  const logDir = ctx.config.ts3.logDir.length > 0 ? ctx.config.ts3.logDir : ctx.config.ts3.installPath.length > 0 ? join(ctx.config.ts3.installPath, 'logs') : '';
  if (logDir.length > 0 && existsSync(logDir)) {
    const results = readLogFiles(logDir, maxLines);
    if (results.length === 0) {
      printLine('(no .log files found in log directory)');
      return;
    }
    for (const result of results) {
      printLine(`## ${result.file}`);
      for (const line of result.lines) printLine(line);
    }
    return;
  }
  printLine('(no TS3 log directory configured; development mock logs below)');
  for (const line of mockLogLines(maxLines)) printLine(line);
}
