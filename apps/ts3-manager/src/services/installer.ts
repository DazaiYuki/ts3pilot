import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { AppError, ErrorCode } from '../domain/errors.ts';
import type { Logger } from '../logging/logger.ts';
import type { ProcessResult } from '../system/processRunner.ts';
import { generateServerUnit } from '../system/systemdGenerator.ts';

export const DEFAULT_TS3_VERSION = '3.13.7';
export const TS3_OFFICIAL_BASE_URL = 'https://files.teamspeak-services.com/releases/server/';
export const EULA_MARKER = '.ts3server_license_accepted';
export const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;

export interface FirewallPort {
  port: number;
  proto: 'udp' | 'tcp';
  comment: string;
}

export const TS3_FIREWALL_PORTS: readonly FirewallPort[] = [
  { port: 9987, proto: 'udp', comment: 'Voice' },
  { port: 30033, proto: 'tcp', comment: 'File Transfer' },
  { port: 10011, proto: 'tcp', comment: 'ServerQuery raw' },
  { port: 10022, proto: 'tcp', comment: 'ServerQuery SSH' },
  { port: 10080, proto: 'tcp', comment: 'WebQuery HTTP' },
  { port: 10443, proto: 'tcp', comment: 'WebQuery HTTPS' },
];

export interface InstallerDependencies {
  platform: NodeJS.Platform;
  mode: 'development' | 'local-integration' | 'production';
  logger: Logger;
  runProcess(bin: string, args: readonly string[], opts?: { timeoutMs?: number }): Promise<ProcessResult>;
  download(url: string, destPath: string): Promise<void>;
}

export interface InstallOptions {
  version: string;
  installPath: string;
  acceptEula: boolean;
  setupFirewall?: boolean;
  sourceUrl?: string;
  expectedSha256?: string;
  force?: boolean;
  user?: string;
  group?: string;
}

export interface FirewallResult {
  configured: boolean;
  tool: 'ufw' | 'firewalld' | 'none';
  opened: string[];
}

export interface InstallResult {
  mocked: boolean;
  installPath: string;
  version: string;
  eulaAccepted: boolean;
  firewall: FirewallResult;
  systemdUnit?: string;
  downloadUrl?: string;
}

/**
 * Compose the official TeamSpeak download URL.
 *
 * The base URL follows the official release layout; the exact file name pattern
 * MUST be confirmed against the official release listing before production use
 * (the installer accepts an explicit --source-url override for that reason).
 */
export function buildDownloadUrl(version: string, platform = 'linux', arch = 'amd64'): string {
  return `${TS3_OFFICIAL_BASE_URL}${version}/teamspeak3-server_${platform}_${arch}-${version}.tar.bz2`;
}

export function validateVersion(version: string): void {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new AppError(ErrorCode.VALIDATION, `Invalid TS3 version: ${version} (expected x.y.z)`);
  }
}

export async function runInstall(options: InstallOptions, deps: InstallerDependencies): Promise<InstallResult> {
  validateVersion(options.version);
  const installPath = resolve(options.installPath);
  if (installPath.length === 0) {
    throw new AppError(ErrorCode.USER, 'installPath is required');
  }
  if (!options.acceptEula) {
    throw new AppError(
      ErrorCode.USER,
      '请阅读 TeamSpeak 官方许可协议，并使用 --accept-eula 参数确认同意 / Please read the TeamSpeak EULA and pass --accept-eula to accept it.',
    );
  }

  const useMock = deps.platform === 'win32' || deps.mode === 'development';
  if (useMock) {
    return mockInstall(options, installPath, deps);
  }

  if (existsSync(installPath) && readdirSync(installPath).length > 0 && options.force !== true) {
    throw new AppError(ErrorCode.USER, `Install path is not empty: ${installPath}. Use --force to overwrite.`);
  }

  const downloadUrl = options.sourceUrl ?? buildDownloadUrl(options.version);
  const parent = dirname(installPath);
  mkdirSync(parent, { recursive: true });
  const stagingDir = `${installPath}.staging-${process.pid}`;
  mkdirSync(stagingDir, { recursive: true });
  const archivePath = join(stagingDir, basename(downloadUrl));

  try {
    deps.logger.info('downloading TeamSpeak server archive', { url: downloadUrl });
    await deps.download(downloadUrl, archivePath);
    if (options.expectedSha256 !== undefined && options.expectedSha256.length > 0) {
      const actual = await sha256File(archivePath);
      if (actual !== options.expectedSha256.toLowerCase()) {
        throw new AppError(ErrorCode.VALIDATION, `Checksum mismatch: expected ${options.expectedSha256}, got ${actual}`);
      }
      deps.logger.info('archive checksum verified');
    } else {
      deps.logger.warn('no expected SHA-256 configured; skipping checksum verification');
    }

    deps.logger.info('extracting archive with tar', { archive: basename(downloadUrl) });
    const tarResult = await deps.runProcess('tar', ['-xjf', archivePath, '-C', stagingDir], { timeoutMs: 600000 });
    if (tarResult.exitCode !== 0) {
      throw new AppError(ErrorCode.SYSTEM, `tar extraction failed: ${tarResult.stderr.trim() || `exit ${tarResult.exitCode}`}`);
    }

    mkdirSync(installPath, { recursive: true });
    const extractedRoot = findExtractedRoot(stagingDir, basename(downloadUrl));
    for (const entry of readdirSync(extractedRoot)) {
      renameSync(join(extractedRoot, entry), join(installPath, entry));
    }
    writeFileSync(join(installPath, EULA_MARKER), `accepted_at=${new Date().toISOString()}\n`, 'utf8');
    deps.logger.info('installation files moved and EULA marker created', { installPath });

    const firewall = await configureFirewall(deps, options.setupFirewall === true);
    const systemdUnit = generateServerUnit({
      user: options.user ?? 'ts3',
      group: options.group ?? 'ts3',
      installPath,
    });

    return {
      mocked: false,
      installPath,
      version: options.version,
      eulaAccepted: true,
      firewall,
      systemdUnit,
      downloadUrl,
    };
  } finally {
    try {
      rmSync(stagingDir, { recursive: true, force: true });
    } catch {
      // best effort cleanup
    }
  }
}

async function mockInstall(options: InstallOptions, installPath: string, deps: InstallerDependencies): Promise<InstallResult> {
  const downloadUrl = options.sourceUrl ?? buildDownloadUrl(options.version);
  deps.logger.warn('mock install: real download/tar/firewall are skipped in development or on Windows');
  deps.logger.info('mock steps', {
    download: downloadUrl,
    extract: 'tar -xjf <archive> -C <staging>',
    eulaMarker: join(installPath, EULA_MARKER),
  });
  mkdirSync(installPath, { recursive: true });
  writeFileSync(join(installPath, EULA_MARKER), `accepted_at=${new Date().toISOString()}\n`, 'utf8');
  const systemdUnit = generateServerUnit({
    user: options.user ?? 'ts3',
    group: options.group ?? 'ts3',
    installPath,
  });
  return {
    mocked: true,
    installPath,
    version: options.version,
    eulaAccepted: true,
    firewall: { configured: false, tool: 'none', opened: [] },
    systemdUnit,
    downloadUrl,
  };
}

async function configureFirewall(deps: InstallerDependencies, enabled: boolean): Promise<FirewallResult> {
  if (!enabled) {
    return { configured: false, tool: 'none', opened: [] };
  }
  const ufwStatus = await deps.runProcess('ufw', ['status'], { timeoutMs: 10000 });
  if (ufwStatus.exitCode === 0) {
    const opened: string[] = [];
    for (const rule of TS3_FIREWALL_PORTS) {
      const spec = `${rule.port}/${rule.proto}`;
      const result = await deps.runProcess('ufw', ['allow', spec], { timeoutMs: 15000 });
      if (result.exitCode === 0) {
        opened.push(spec);
        deps.logger.info('ufw rule added', { spec, comment: rule.comment });
      } else {
        deps.logger.warn('ufw rule failed', { spec, stderr: result.stderr.trim() });
      }
    }
    return { configured: opened.length > 0, tool: 'ufw', opened };
  }

  const firewalldState = await deps.runProcess('firewall-cmd', ['--state'], { timeoutMs: 10000 });
  if (firewalldState.exitCode === 0) {
    const opened: string[] = [];
    for (const rule of TS3_FIREWALL_PORTS) {
      const spec = `${rule.port}/${rule.proto}`;
      const result = await deps.runProcess('firewall-cmd', ['--permanent', '--add-port', spec], { timeoutMs: 15000 });
      if (result.exitCode === 0) {
        opened.push(spec);
        deps.logger.info('firewalld port added', { spec, comment: rule.comment });
      } else {
        deps.logger.warn('firewalld rule failed', { spec, stderr: result.stderr.trim() });
      }
    }
    await deps.runProcess('firewall-cmd', ['--reload'], { timeoutMs: 15000 });
    return { configured: opened.length > 0, tool: 'firewalld', opened };
  }

  deps.logger.warn('neither ufw nor firewalld detected; firewall configuration skipped');
  return { configured: false, tool: 'none', opened: [] };
}

function findExtractedRoot(stagingDir: string, archiveName: string): string {
  const entries = readdirSync(stagingDir).filter((name) => name !== archiveName);
  const directories = entries
    .map((name) => join(stagingDir, name))
    .filter((path) => statSync(path).isDirectory());
  if (directories.length === 1) {
    return directories[0] as string;
  }
  return stagingDir;
}

function sha256File(path: string): Promise<string> {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    const hash = createHash('sha256');
    const source = createReadStream(path);
    source.on('data', (chunk) => hash.update(chunk as Buffer));
    source.on('end', () => resolvePromise(hash.digest('hex')));
    source.on('error', rejectPromise);
  });
}
