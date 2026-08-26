import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
  config.dataDir = defaultDataDir();
  writeConfig(path, config);
  return config;
}

export function writeConfig(path: string, config: AppConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
}

export function updateConfig(path: string, updater: (config: AppConfig) => AppConfig): AppConfig {
  const current = existsSync(path) ? readConfig(path) : defaultConfig();
  const next = updater(current);
  writeConfig(path, next);
  return next;
}
