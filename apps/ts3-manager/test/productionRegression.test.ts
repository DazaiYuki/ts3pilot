import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { ensureConfig, writeConfig } from '../src/config/config.ts';
import { swapBinarySafely } from '../src/cli/commands/update.ts';
import { generateAgentUnit } from '../src/system/systemdGenerator.ts';
import { createBackupArchive, restoreBackupArchive } from '../src/system/backupEngine.ts';
import { cleanupDir, tempDir } from './util.ts';

test('configuration containing credentials is private and uses its own data directory', { skip: process.platform === 'win32' }, () => {
  const dir = tempDir('private-config');
  try {
    const path = join(dir, 'state', 'config.json');
    const config = ensureConfig(path);
    assert.equal(config.dataDir, dirname(path));
    assert.equal(statSync(path).mode & 0o777, 0o600);
    chmodSync(path, 0o644);
    config.agent.credential = 'local-test-secret';
    writeConfig(path, config);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(dirname(path)), ['config.json']);
  } finally { cleanupDir(dir); }
});

test('a binary failing preflight leaves the installed binary available during verification', async () => {
  const dir = tempDir('preflight');
  try {
    const target = join(dir, 'ts3pilot');
    const next = join(dir, 'next');
    writeFileSync(target, 'old'); writeFileSync(next, 'bad');
    await assert.rejects(swapBinarySafely({ target, newBinary: next, verify: () => {
      assert.equal(readFileSync(target, 'utf8'), 'old');
      throw new Error('bad candidate');
    } }), /bad candidate/);
    assert.equal(readFileSync(target, 'utf8'), 'old');
    assert.deepEqual(readdirSync(dir).sort(), ['next', 'ts3pilot']);
  } finally { cleanupDir(dir); }
});

test('self update works when the download and installation are on different filesystems', { skip: process.platform === 'win32' }, async () => {
  const dir = tempDir('cross-filesystem');
  const download = mkdtempSync(join(tmpdir(), 'ts3pilot-regression-'));
  try {
    const target = join(dir, 'ts3pilot'); const next = join(download, 'ts3pilot');
    writeFileSync(target, 'old'); writeFileSync(next, 'new');
    await swapBinarySafely({ target, newBinary: next, verify: path => { assert.equal(readFileSync(path, 'utf8'), 'new'); } });
    assert.equal(readFileSync(target, 'utf8'), 'new');
    assert.equal(statSync(target).mode & 0o777, 0o755);
  } finally { cleanupDir(dir); rmSync(download, { recursive: true, force: true }); }
});

test('systemd agent can write adjacent config files and use local systemd IPC', () => {
  const unit = generateAgentUnit({ user: 'ts3', group: 'ts3', execStart: '/opt/ts3pilot/ts3pilot agent', configPath: '/var/lib/ts3pilot/config.json', installPath: '/srv/ts3' });
  assert.match(unit, /^ReadWritePaths=\/var\/lib\/ts3pilot \/srv\/ts3$/m);
  assert.match(unit, /^RestrictAddressFamilies=.*AF_UNIX/m);
  assert.throws(() => generateAgentUnit({ user: 'ts3\nExecStart=/bin/sh', group: 'ts3', execStart: '/opt/ts3pilot/ts3pilot agent', configPath: '/tmp/config.json', installPath: '/srv/ts3' }));
});

test('backup archives support long paths, empty files and real tar readers', async () => {
  const dir = tempDir('long-path-backup');
  try {
    const root = join(dir, 'root'); const nested = join('files', 'a'.repeat(80), 'b'.repeat(80));
    mkdirSync(join(root, nested), { recursive: true });
    writeFileSync(join(root, nested, 'file.bin'), Buffer.alloc(200000, 17));
    writeFileSync(join(root, 'empty'), '');
    const archive = join(dir, 'archives', 'backup.tar.gz');
    await createBackupArchive({ rootDir: root, include: ['files', 'empty'], archivePath: archive });
    const extracted = join(dir, 'tar-output'); mkdirSync(extracted);
    execFileSync('tar', ['-xzf', archive, '-C', extracted]);
    assert.deepEqual(readFileSync(join(extracted, nested, 'file.bin')), Buffer.alloc(200000, 17));
    const target = join(root, 'restore');
    const result = await restoreBackupArchive({ archivePath: archive, targetRoot: target, allowedRoot: root, force: true });
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(statSync(join(target, 'empty')).size, 0);
  } finally { cleanupDir(dir); }
});

test('restore refuses existing symlinks that escape the install directory', { skip: process.platform === 'win32' }, async () => {
  const dir = tempDir('restore-symlink');
  try {
    const root = join(dir, 'root'); const outside = join(dir, 'outside');
    mkdirSync(join(root, 'files'), { recursive: true }); mkdirSync(outside);
    writeFileSync(join(root, 'files', 'data'), 'backup');
    const archive = join(dir, 'backup.tar.gz');
    await createBackupArchive({ rootDir: root, include: ['files'], archivePath: archive });
    const target = join(root, 'restore'); mkdirSync(target);
    symlinkSync(outside, join(target, 'files'), 'dir');
    const result = await restoreBackupArchive({ archivePath: archive, targetRoot: target, allowedRoot: root, force: true });
    assert.equal(result.ok, false);
    assert.equal(existsSync(join(outside, 'data')), false);
  } finally { cleanupDir(dir); }
});
