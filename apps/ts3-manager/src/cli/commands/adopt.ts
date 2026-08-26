import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { probePort } from '../../services/probe.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runAdoptCommand(ctx: CliContext): Promise<void> {
  printLine('Adopt analysis (read-only; nothing is modified):');
  const installPath = ctx.config.ts3.installPath;
  if (installPath.length === 0 || !existsSync(installPath)) {
    printLine('  - ts3.installPath is not set or does not exist. Configure it first (config set ts3.installPath <path>).');
  } else {
    printLine(`  - install path exists: ${installPath}`);
    const candidates = ['ts3server', 'ts3server_linux_amd64', ctx.config.ts3.startScript];
    for (const candidate of candidates) {
      if (existsSync(join(installPath, candidate))) {
        printLine(`  - found: ${candidate}`);
      }
    }
  }

  const voiceOpen = await probePort('127.0.0.1', ctx.config.ts3.voicePort);
  const queryOpen = await probePort('127.0.0.1', ctx.config.ts3.query.rawPort);
  printLine(`  - voice port ${ctx.config.ts3.voicePort}: ${voiceOpen ? 'open' : 'closed'}`);
  printLine(`  - serverquery port ${ctx.config.ts3.query.rawPort}: ${queryOpen ? 'open' : 'closed'}`);
  printLine('');
  printLine('Minimal steps to enable the toolchain for an existing server:');
  printLine('  1. Create a low-privilege ServerQuery login (never the master serveradmin) or a scoped API key.');
  printLine('  2. Configure credentials: config set ts3.query.username <name> / ts3.query.password <password>.');
  printLine('  3. If using WebQuery, verify endpoint mappings against official docs, then set webQuery.verified=true.');
  printLine('  4. Run ts3-manager doctor, then ts3-manager api enable and pair with WordPress.');
}
