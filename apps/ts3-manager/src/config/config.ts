import { chmodSync, chownSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { AppError, ErrorCode } from '../domain/errors.ts';
import { applyEnvOverrides, defaultConfig, validateConfig } from '../domain/schemas.ts';
import type { AppConfig } from '../domain/schemas.ts';

export function defaultConfigPath(): string {
  const fromEnv = process.env.TS3_MANAGER_CONFIG;
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return join(homedir(), '.config', 'ts3-manager', 'config.json');
}

export function defaultDataDir(): string {
  return join(homedir(), '.config', 'ts3-manager');
}

export function readConfig(path = defaultConfigPath()): AppConfig {
  if (!existsSync(path)) {
    throw new AppError(
      ErrorCode.CONFIG,
      `Config file not found at ${path}. Run 'ts3-manager config init' first.`,
      { httpStatus: 500 },
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new AppError(ErrorCode.CONFIG, `Cannot parse config file ${path}`, { cause: error });
  }
  return applyEnvOverrides(validateConfig(raw));
}

export function ensureConfig(path = defaultConfigPath()): AppConfig {
  if (existsSync(path)) return readConfig(path);
  const config = defaultConfig();
  config.dataDir = dirname(path);
  writeConfig(path, config);
  return config;
}

export function writeConfig(path: string, config: AppConfig): void {
  const previous = existsSync(path) ? statSync(path) : undefined;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    chmodSync(temporary, 0o600);
    if (previous && process.getuid?.() === 0) chownSync(temporary, previous.uid, previous.gid);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function updateConfig(path: string, updater: (config: AppConfig) => AppConfig): AppConfig {
  const current = existsSync(path) ? readConfig(path) : defaultConfig();
  const next = updater(current);
  writeConfig(path, next);
  return next;
}
