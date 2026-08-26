import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import { probePort } from '../../services/probe.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

export async function runDoctorCommand(ctx: CliContext): Promise<void> {
  const results: CheckResult[] = [];
  results.push({ name: 'node version', status: Number(process.versions.node.split('.')[0]) >= 24 ? 'ok' : 'warn', detail: process.version });
  results.push({ name: 'platform', status: 'ok', detail: process.platform });
  results.push({ name: 'config file', status: existsSync(ctx.cfgPath) ? 'ok' : 'fail', detail: ctx.cfgPath });
  results.push({ name: 'run mode', status: 'ok', detail: ctx.config.mode });

  const installPath = ctx.config.ts3.installPath;
  if (installPath.length > 0) {
    const exists = existsSync(installPath);
    results.push({ name: 'ts3 install path', status: exists ? 'ok' : 'fail', detail: installPath });
    const startScript = join(installPath, ctx.config.ts3.startScript);
    if (exists) {
      results.push({
        name: 'ts3 start script',
        status: existsSync(startScript) ? 'ok' : 'warn',
        detail: startScript,
      });
    }
    const logDir = ctx.config.ts3.logDir.length > 0 ? ctx.config.ts3.logDir : join(installPath, 'logs');
    results.push({ name: 'ts3 log dir', status: existsSync(logDir) ? 'ok' : 'warn', detail: logDir });
  } else {
    results.push({ name: 'ts3 install path', status: 'warn', detail: 'not configured (development mock mode is fine)' });
  }

  results.push({ name: 'voice port 9987', status: (await probePort('127.0.0.1', ctx.config.ts3.voicePort)) ? 'ok' : 'warn', detail: `127.0.0.1:${ctx.config.ts3.voicePort}` });
  results.push({ name: 'serverquery port 10011', status: (await probePort('127.0.0.1', ctx.config.ts3.query.rawPort)) ? 'ok' : 'warn', detail: `127.0.0.1:${ctx.config.ts3.query.rawPort}` });

  if (ctx.config.agent.enabled) {
    try {
      const response = await fetch(`http://${ctx.config.agent.host}:${ctx.config.agent.port}/v1/health`, {
        signal: AbortSignal.timeout(2000),
      });
      const body = (await response.json()) as { status?: string };
      results.push({ name: 'agent health', status: response.ok && body.status === 'ok' ? 'ok' : 'fail', detail: `http://${ctx.config.agent.host}:${ctx.config.agent.port}` });
    } catch {
      results.push({ name: 'agent health', status: 'warn', detail: 'agent not reachable (is `ts3-manager agent` running?)' });
    }
  } else {
    results.push({ name: 'agent API', status: 'ok', detail: 'disabled (explicit security boundary)' });
  }

  const providerAvailable = await ctx.services.isAvailable();
  results.push({ name: `service provider (${ctx.services.providerName})`, status: providerAvailable ? 'ok' : 'fail', detail: 'availability probe' });

  if (process.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0) {
    results.push({ name: 'running as root', status: 'warn', detail: 'agent should run as a dedicated unprivileged user' });
  }

  for (const result of results) {
    printLine(`${result.status.toUpperCase().padEnd(4)} ${result.name}: ${result.detail}`);
  }
  if (results.some((result) => result.status === 'fail')) {
    throw new AppError(ErrorCode.USER, 'doctor found failing checks');
  }
}
