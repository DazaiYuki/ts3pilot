import { existsSync, readFileSync } from 'node:fs';
import { analyzeExistingInstall } from '../../services/adoptAnalyzer.ts';
import { runProcess } from '../../system/processRunner.ts';
import { probePort } from '../../services/probe.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runAdoptCommand(ctx: CliContext): Promise<void> {
  const analysis = await analyzeExistingInstall({
    config: ctx.config,
    fileExists: (path) => existsSync(path),
    readFile: (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return undefined;
      }
    },
    probePort: (host, port) => probePort(host, port, 1500),
    runCommand: async (command, args) => {
      const result = await runProcess(command, args, { timeoutMs: 5000 });
      return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
    },
  });

  printLine('Adopt analysis (read-only; nothing is modified):');
  printLine(`install path: ${analysis.installPath || '(not configured)'}`);
  printLine(
    `deployment: ${analysis.deployment.mode} (serverQuery=${analysis.deployment.capabilities.serverQuery ? 'yes' : 'no'}, filesystem=${
      analysis.deployment.capabilities.filesystem ? 'yes' : 'no'
    })`,
  );
  for (const detail of analysis.deployment.details) {
    printLine(`  - ${detail}`);
  }
  printLine(`detected: ${analysis.found.join(', ') || '(none)'}`);
  printLine(`missing: ${analysis.missing.join(', ') || '(none)'}`);
  if (analysis.optionalFound.length > 0) {
    printLine(`optional: ${analysis.optionalFound.join(', ')}`);
  }
  if (Object.keys(analysis.ini).length > 0) {
    printLine('ts3server.ini (relevant keys):');
    for (const [key, value] of Object.entries(analysis.ini)) {
      printLine(`  ${key}=${value}`);
    }
  }
  for (const port of analysis.ports) {
    printLine(`port ${port.name} ${port.port}: ${port.open ? 'open' : 'closed'}`);
  }
  printLine('');
  for (const finding of analysis.findings) {
    printLine(`${finding.kind.toUpperCase()} ${finding.message}`);
  }
  if (analysis.recommendations.length > 0) {
    printLine('');
    printLine('Minimal-change recommendations:');
    for (const recommendation of analysis.recommendations) {
      printLine(`  - ${recommendation}`);
    }
  }
}
