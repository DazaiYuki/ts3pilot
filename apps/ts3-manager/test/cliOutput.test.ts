import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { defaultConfig } from '../src/domain/schemas.ts';

test('actual CLI status stdout remains parseable JSON with default diagnostic logging', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ts3pilot-cli-output-'));
  try {
    const config = defaultConfig();
    config.dataDir = directory;
    config.system.provider = 'mock';
    const path = join(directory, 'config.json');
    writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli/index.ts', import.meta.url)), 'status', '--config', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).provider, 'mock');
    assert.ok(result.stderr.includes('Service provider: mock'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
