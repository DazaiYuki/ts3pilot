#!/usr/bin/env node
import { isAppError, toErrorEnvelope } from '../domain/errors.ts';
import { parseArgs } from './args.ts';
import { runAdoptCommand } from './commands/adopt.ts';
import { runAgentCommand } from './commands/agent.ts';
import { runApiCommand } from './commands/api.ts';
import { runBackupCommand, runRestoreCommand } from './commands/backupCmd.ts';
import { runConfigCommand } from './commands/configCmd.ts';
import { runDoctorCommand } from './commands/doctor.ts';
import { runInstallCommand } from './commands/install.ts';
import { runIdentityCommand } from './commands/identity.ts';
import { runLogsCommand } from './commands/logs.ts';
import { runServiceCommand } from './commands/service.ts';
import { runUpdateCommand } from './commands/update.ts';
import { runSystemdCommand } from './commands/systemd.ts';
import { runVersionCommand } from './commands/version.ts';
import { createCliContext } from './context.ts';
import { printError, printLine } from './print.ts';
import { runTui } from './tui.ts';

const HELP = `ts3-manager — TeamSpeak 3 community operations CLI

Usage: ts3-manager <command> [options]

Commands:
  start|stop|restart|status   Control the TS3 service via the configured provider
  version                     Show version and protocol information
  config <init|show|get|set|validate|path>
  api <enable|disable|status|pair|rotate-secret|unpair>
  identity <challenge|worker|status>
  agent                       Run the agent HTTP API in the foreground
  doctor                      Run read-only health checks
  logs [--lines N]            Show recent TS3 logs (mock in development)
  backup [--source X] [--dest Y]
  restore --backup B [--dest D] [--dry-run|--force]
  install --accept-eula [--version X.Y.Z] [--install-path P] [--setup-firewall]
  adopt                       Analyze an existing TS3 instance (read-only)
  update [check|self] [--mirror|--no-mirror]
                              Check and self-update the standalone binary
  systemd generate <ts3server|ts3-agent> [--out PATH] [--user U] [--install-path P]
  help                        Show this help

Global options:
  --config <path>             Use a specific config file

Run without arguments to enter the interactive bilingual console.
`;

export async function main(argv: readonly string[]): Promise<number> {
  const { positionals, flags } = parseArgs(argv);
  const command = positionals[0];
  if (command === 'help' || flags.help === true) {
    printLine(HELP);
    return 0;
  }
  const configPath = typeof flags.config === 'string' ? flags.config : undefined;
  if (command === undefined) {
    const ctx = createCliContext({ configPath });
    await runTui(ctx);
    return 0;
  }
  if (command === 'version') {
    runVersionCommand();
    return 0;
  }
  if (command === 'config' && positionals[1] === 'init') {
    runConfigCommand(positionals.slice(1), typeof flags.config === 'string' ? flags.config : undefined);
    return 0;
  }

  try {
    const ctx = createCliContext({ configPath });
    switch (command) {
      case 'config':
        runConfigCommand(positionals.slice(1), ctx.cfgPath);
        break;
      case 'api':
        runApiCommand(ctx, positionals.slice(1), flags);
        break;
      case 'start':
      case 'stop':
      case 'restart':
      case 'status':
        await runServiceCommand(ctx, command);
        break;
      case 'agent':
        await runAgentCommand(ctx);
        break;
      case 'doctor':
        await runDoctorCommand(ctx);
        break;
      case 'identity':
        await runIdentityCommand(ctx, positionals.slice(1), flags);
        break;
      case 'logs':
        runLogsCommand(ctx, flags);
        break;
      case 'backup':
        await runBackupCommand(ctx, flags);
        break;
      case 'restore':
        await runRestoreCommand(ctx, flags);
        break;
      case 'install':
        runInstallCommand(ctx, flags);
        break;
      case 'adopt':
        await runAdoptCommand(ctx);
        break;
      case 'update':
        runUpdateCommand(ctx, positionals.slice(1), flags);
        break;
      case 'systemd':
        runSystemdCommand(ctx, positionals.slice(1), flags);
        break;
      default:
        printError(`unknown command: ${command}`);
        printLine(HELP);
        return 2;
    }
    return 0;
  } catch (error) {
    if (isAppError(error)) {
      printError(`error [${error.code}]: ${error.message}`);
    } else {
      printError(`error [${toErrorEnvelope(error).code}]: ${toErrorEnvelope(error).message}`);
    }
    return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    printError(`fatal: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
