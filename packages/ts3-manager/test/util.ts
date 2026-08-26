import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultConfig, type AppConfig } from '../src/domain/schemas.ts';

export function tempDir(prefix: string): string {
  const dir = join(process.cwd(), 'tmp', `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanupDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function writeTempConfig(dir: string, mutate?: (config: AppConfig) => void): { path: string; config: AppConfig } {
  const config = defaultConfig();
  config.dataDir = dir;
  if (mutate !== undefined) mutate(config);
  const path = join(dir, 'config.json');
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return { path, config };
}
