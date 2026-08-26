import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createBackup, executeRestore, planRestore } from '../src/services/backup.ts';
import { cleanupDir, tempDir } from './util.ts';

test('backup and restore roundtrip with manifest checksums', async () => {
  const dir = tempDir('backup');
  const source = join(dir, 'src');
  const backup = join(dir, 'backup');
  const restored = join(dir, 'restored');
  try {
    mkdirSync(join(source, 'sub'), { recursive: true });
    writeFileSync(join(source, 'a.txt'), 'hello world');
    writeFileSync(join(source, 'sub', 'b.bin'), 'binary-data');
    mkdirSync(join(source, 'logs'), { recursive: true });
    writeFileSync(join(source, 'logs', 'ts3server.log'), 'should-not-be-backed-up');

    const manifest = await createBackup(source, backup);
    assert.equal(manifest.files.length, 2);
    const manifestContent = JSON.parse(readFileSync(join(backup, 'manifest.json'), 'utf8')) as {
      files: { path: string; sha256: string }[];
    };
    assert.equal(manifestContent.files.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256)), true);

    writeFileSync(join(source, 'a.txt'), 'modified');
    const plan = await planRestore(backup, restored);
    assert.equal(plan.files.length, 2);

    await executeRestore(backup, restored);
    assert.equal(readFileSync(join(restored, 'a.txt'), 'utf8'), 'hello world');
    assert.equal(readFileSync(join(restored, 'sub', 'b.bin'), 'utf8'), 'binary-data');
    assert.equal(createFileExists(join(restored, 'logs', 'ts3server.log')), false);
  } finally {
    cleanupDir(dir);
  }
});

test('backup rejects a destination inside the source directory', async () => {
  const dir = tempDir('backup-invalid');
  try {
    const source = join(dir, 'src');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'a.txt'), 'x');
    await assert.rejects(() => createBackup(source, join(source, 'nested-backup')));
  } finally {
    cleanupDir(dir);
  }
});

test('restore rejects unsafe manifest paths', async () => {
  const dir = tempDir('backup-unsafe');
  try {
    const backup = join(dir, 'backup');
    mkdirSync(backup, { recursive: true });
    writeFileSync(
      join(backup, 'manifest.json'),
      JSON.stringify({ tool: 'ts3-manager', version: '0.1.0', createdAt: '', sourceDir: '', files: [{ path: '../evil.txt', size: 1, sha256: 'x' }] }),
    );
    await assert.rejects(() => planRestore(backup, join(dir, 'dest')));
  } finally {
    cleanupDir(dir);
  }
});

function createFileExists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
