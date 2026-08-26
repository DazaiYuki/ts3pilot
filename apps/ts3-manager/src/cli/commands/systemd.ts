import { writeFileSync } from 'node:fs';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import { generateAgentUnit, generateServerUnit, validateUnitName } from '../../system/systemdGenerator.ts';
import { flagString } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export function runSystemdCommand(ctx: CliContext, positionals: readonly string[], flags: Record<string, string | boolean>): void {
  if (positionals[0] !== 'generate') {
    throw new AppError(ErrorCode.USER, 'usage: systemd generate <ts3server|ts3-agent> [options]');
  }
  const target = positionals[1];
  const user = flagString(flags, 'user') ?? 'ts3';
  const group = flagString(flags, 'group') ?? user;
  const out = flagString(flags, 'out');
  let unit: string;

  if (target === 'ts3server') {
    const installPath = flagString(flags, 'install-path') ?? ctx.config.ts3.installPath;
    if (installPath.length === 0) throw new AppError(ErrorCode.USER, 'ts3server unit requires --install-path or ts3.installPath');
    unit = generateServerUnit({ user, group, installPath, startScript: ctx.config.ts3.startScript });
  } else if (target === 'ts3-agent') {
    const execStart = flagString(flags, 'exec-start') ?? 'ts3-manager agent';
    const configPath = flagString(flags, 'config') ?? ctx.cfgPath;
    const installPath = ctx.config.ts3.installPath;
    unit = generateAgentUnit({ user, group, execStart, configPath, installPath });
  } else {
    throw new AppError(ErrorCode.USER, 'usage: systemd generate <ts3server|ts3-agent>');
  }

  const unitName = flagString(flags, 'unit-name') ?? `${target}.service`;
  if (!validateUnitName(unitName)) {
    throw new AppError(ErrorCode.USER, `Invalid unit name: ${unitName}`);
  }
  if (out !== undefined) {
    writeFileSync(out, unit, 'utf8');
    printLine(`unit written to ${out}`);
  } else {
    process.stdout.write(unit);
  }
}
