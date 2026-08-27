import { join } from 'node:path';
import type { AppConfig } from '../domain/schemas.ts';
import type { DeploymentProfile } from './deploymentProfile.ts';

export type CheckSeverity = 'ok' | 'warn' | 'fail';

export interface DoctorCheck {
  name: string;
  severity: CheckSeverity;
  detail: string;
}

export interface DoctorDependencies {
  platform: NodeJS.Platform;
  nodeVersion: string;
  configPath: string;
  configFileExists: boolean;
  config: AppConfig;
  fileExists(path: string): boolean;
  fileReadable(path: string): boolean;
  fileSize(path: string): number | undefined;
  readFile(path: string): string | undefined;
  probePort(host: string, port: number): Promise<boolean>;
  agentHealth(): Promise<'ok' | 'unreachable'>;
  serverQueryAuth(): Promise<boolean | undefined>;
  providerAvailable(): Promise<boolean>;
  deployment?: DeploymentProfile;
}

const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');

export async function runDoctorChecks(deps: DoctorDependencies): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const config = deps.config;

  checks.push({
    name: 'node version',
    severity: Number(deps.nodeVersion.split('.')[0] ?? 0) >= 24 ? 'ok' : 'warn',
    detail: deps.nodeVersion,
  });
  checks.push({ name: 'platform', severity: 'ok', detail: deps.platform });
  checks.push({
    name: 'config file',
    severity: deps.configFileExists ? 'ok' : 'fail',
    detail: deps.configPath,
  });
  checks.push({ name: 'run mode', severity: 'ok', detail: config.mode });

  if (deps.deployment !== undefined) {
    const d = deps.deployment;
    checks.push({
      name: 'deployment profile',
      severity: 'ok',
      detail: `${d.mode} (serverQuery=${d.capabilities.serverQuery ? 'yes' : 'no'}, filesystem=${d.capabilities.filesystem ? 'yes' : 'no'})${d.dockerContainer ? ` container=${d.dockerContainer}` : ''}`,
    });
    if (d.mode === 'docker' && config.ts3.installPath.length === 0) {
      checks.push({
        name: 'docker volume path',
        severity: 'warn',
        detail: 'set ts3.installPath to the host volume path so backup/logs can read TS3 files',
      });
    }
    if (d.mode === 'remote') {
      checks.push({
        name: 'remote mode',
        severity: 'warn',
        detail: 'query-only control plane; install/backup/restore/systemd are unavailable on this host',
      });
    }
  }

  const installPath = config.ts3.installPath;
  if (installPath.length === 0) {
    checks.push({ name: 'ts3 install path', severity: 'warn', detail: 'not configured (development mock mode is fine)' });
  } else {
    checks.push({
      name: 'ts3 install path',
      severity: deps.fileExists(installPath) ? 'ok' : 'fail',
      detail: installPath,
    });
    if (deps.fileExists(installPath)) {
      checks.push({
        name: 'ts3 install path readable',
        severity: deps.fileReadable(installPath) ? 'ok' : 'fail',
        detail: installPath,
      });
      const startScript = join(installPath, config.ts3.startScript);
      checks.push({
        name: 'ts3 start script',
        severity: deps.fileExists(startScript) ? 'ok' : 'warn',
        detail: startScript,
      });
      const logDir = config.ts3.logDir.length > 0 ? config.ts3.logDir : join(installPath, 'logs');
      checks.push({ name: 'ts3 log dir', severity: deps.fileExists(logDir) ? 'ok' : 'warn', detail: logDir });
      checks.push(...sqliteChecks(join(installPath, 'ts3server.sqlitedb'), deps));
      checks.push(...iniChecks(join(installPath, 'ts3server.ini'), deps));
    }
  }

  const queryHost = config.ts3.query.host.trim().length > 0 ? config.ts3.query.host : '127.0.0.1';
  const remote = deps.deployment?.mode === 'remote';
  const portChecks: Array<{ name: string; port: number; host: string }> = [
    { name: 'voice port', port: config.ts3.voicePort, host: remote ? queryHost : '127.0.0.1' },
    { name: 'file transfer port', port: config.ts3.fileTransferPort, host: remote ? queryHost : '127.0.0.1' },
    { name: 'serverquery raw port', port: config.ts3.query.rawPort, host: queryHost },
    { name: 'serverquery ssh port', port: config.ts3.query.sshPort, host: queryHost },
    { name: 'webquery http port', port: config.ts3.query.webQuery.httpPort, host: queryHost },
    { name: 'webquery https port', port: config.ts3.query.webQuery.httpsPort, host: queryHost },
  ];
  for (const entry of portChecks) {
    const open = await deps.probePort(entry.host, entry.port);
    checks.push({
      name: entry.name,
      severity: open ? 'ok' : 'warn',
      detail: `${entry.host}:${entry.port} (${open ? 'open' : 'closed'})`,
    });
  }

  const queryAuth = await deps.serverQueryAuth();
  if (queryAuth === undefined) {
    checks.push({
      name: 'serverquery auth',
      severity: 'warn',
      detail: 'ServerQuery credentials not configured (ts3.query.username/password)',
    });
  } else {
    checks.push({
      name: 'serverquery auth',
      severity: queryAuth ? 'ok' : 'fail',
      detail: queryAuth ? 'login verified' : 'login failed or unreachable',
    });
  }

  if (config.agent.enabled) {
    const health = await deps.agentHealth();
    checks.push({
      name: 'agent health',
      severity: health === 'ok' ? 'ok' : 'warn',
      detail: health === 'ok' ? `http://${config.agent.host}:${config.agent.port}` : 'agent not reachable (run `ts3-manager agent`)',
    });
  } else {
    checks.push({ name: 'agent API', severity: 'ok', detail: 'disabled (explicit security boundary)' });
  }

  checks.push({
    name: `service provider (${config.system.provider})`,
    severity: (await deps.providerAvailable()) ? 'ok' : 'fail',
    detail: 'availability probe',
  });

  if (deps.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0) {
    checks.push({ name: 'running as root', severity: 'warn', detail: 'agent should run as a dedicated unprivileged user' });
  }
  return checks;
}

function sqliteChecks(path: string, deps: DoctorDependencies): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  if (!deps.fileExists(path)) {
    checks.push({ name: 'ts3 sqlite database', severity: 'fail', detail: `${path} missing` });
    return checks;
  }
  if (!deps.fileReadable(path)) {
    checks.push({ name: 'ts3 sqlite database', severity: 'fail', detail: `${path} not readable` });
    return checks;
  }
  const size = deps.fileSize(path) ?? 0;
  if (size <= 0) {
    checks.push({ name: 'ts3 sqlite database', severity: 'fail', detail: `${path} is empty` });
    return checks;
  }
  const head = deps.readFile(path);
  if (head !== undefined && Buffer.from(head, 'latin1').subarray(0, 16).equals(SQLITE_MAGIC)) {
    checks.push({ name: 'ts3 sqlite database', severity: 'ok', detail: `${path} (${size} bytes, valid header)` });
  } else {
    checks.push({ name: 'ts3 sqlite database', severity: 'warn', detail: `${path} header check inconclusive (${size} bytes)` });
  }
  return checks;
}

function iniChecks(path: string, deps: DoctorDependencies): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  if (!deps.fileExists(path)) {
    checks.push({ name: 'ts3server.ini', severity: 'warn', detail: `${path} missing (server will generate defaults)` });
    return checks;
  }
  if (!deps.fileReadable(path)) {
    checks.push({ name: 'ts3server.ini', severity: 'fail', detail: `${path} not readable` });
    return checks;
  }
  const content = deps.readFile(path) ?? '';
  checks.push({
    name: 'ts3server.ini',
    severity: content.trim().length > 0 ? 'ok' : 'warn',
    detail: content.trim().length > 0 ? `${path} readable` : `${path} empty`,
  });
  return checks;
}
