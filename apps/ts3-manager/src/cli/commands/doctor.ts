import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { runDoctorChecks } from '../../services/doctorChecks.ts';
import { detectDeployment } from '../../services/deploymentProfile.ts';
import { probePort } from '../../services/probe.ts';
import { ServerQueryConnection } from '../../ts3/serverQueryConnection.ts';
import { runProcess } from '../../system/processRunner.ts';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runDoctorCommand(ctx: CliContext): Promise<void> {
  const deployment = await detectDeployment({
    config: ctx.config,
    platform: process.platform,
    fileExists: (path) => existsSync(path),
    runCommand: async (command, args) => {
      const result = await runProcess(command, args, { timeoutMs: 5000 });
      return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
    },
  });
  const checks = await runDoctorChecks({
    platform: process.platform,
    nodeVersion: process.version,
    configPath: ctx.cfgPath,
    configFileExists: existsSync(ctx.cfgPath),
    config: ctx.config,
    fileExists: (path) => existsSync(path),
    fileReadable: (path) => {
      try {
        accessSync(path, constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },
    fileSize: (path) => {
      try {
        return statSync(path).size;
      } catch {
        return undefined;
      }
    },
    readFile: (path) => {
      try {
        return readFileSync(path, 'latin1');
      } catch {
        return undefined;
      }
    },
    probePort: (host, port) => probePort(host, port, 1500),
    agentHealth: async () => {
      try {
        const response = await fetch(`http://${ctx.config.agent.host}:${ctx.config.agent.port}/v1/health`, {
          signal: AbortSignal.timeout(2000),
        });
        const body = (await response.json()) as { status?: string };
        return response.ok && body.status === 'ok' ? 'ok' : 'unreachable';
      } catch {
        return 'unreachable';
      }
    },
    serverQueryAuth: async () => {
      const query = ctx.config.ts3.query;
      if (query.username.length === 0 || query.password.length === 0) return undefined;
      const host = query.host.trim().length > 0 ? query.host : '127.0.0.1';
      const connection = new ServerQueryConnection({
        host,
        port: query.rawPort,
        username: query.username,
        password: query.password,
        timeoutMs: 3000,
      });
      try {
        await connection.connect();
        return true;
      } catch {
        return false;
      } finally {
        await connection.close();
      }
    },
    providerAvailable: () => ctx.services.isAvailable(),
    deployment,
  });

  for (const check of checks) {
    printLine(`${check.severity.toUpperCase().padEnd(4)} ${check.name}: ${check.detail}`);
  }
  if (checks.some((check) => check.severity === 'fail')) {
    throw new AppError(ErrorCode.USER, 'doctor found failing checks');
  }
}
