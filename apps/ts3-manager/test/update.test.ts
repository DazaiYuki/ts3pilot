import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { findBinaryInDir, isNewerVersion, resolveBinaryPath, stripVersionTag, withMirror } from '../src/cli/commands/update.ts';
import { cleanupDir, tempDir } from './util.ts';

test('stripVersionTag removes the v prefix', () => {
  assert.equal(stripVersionTag('v0.1.0'), '0.1.0');
  assert.equal(stripVersionTag('0.1.0'), '0.1.0');
});

test('isNewerVersion compares numeric segments', () => {
  assert.equal(isNewerVersion('0.2.0', '0.1.0'), true);
  assert.equal(isNewerVersion('0.10.0', '0.9.9'), true);
  assert.equal(isNewerVersion('0.1.0', '0.1.0'), false);
  assert.equal(isNewerVersion('0.1.1', '0.1.0'), true);
  assert.equal(isNewerVersion('0.1.0', '0.2.0'), false);
});

test('withMirror prefixes the ghproxy mirror', () => {
  assert.equal(
    withMirror('https://github.com/DazaiYuki/ts3pilot/releases/download/v0.1.0/ts3pilot-linux-x64-v0.1.0.tar.gz'),
    'https://mirror.ghproxy.com/https://github.com/DazaiYuki/ts3pilot/releases/download/v0.1.0/ts3pilot-linux-x64-v0.1.0.tar.gz',
  );
});

test('findBinaryInDir locates the ts3pilot file recursively', () => {
  const dir = tempDir('update-find');
  try {
    mkdirSync(join(dir, 'pkg', 'ts3pilot'), { recursive: true });
    writeFileSync(join(dir, 'pkg', 'ts3pilot', 'ts3pilot'), 'binary');
    writeFileSync(join(dir, 'pkg', 'config.example.json'), '{}');
    assert.equal(findBinaryInDir(dir), join(dir, 'pkg', 'ts3pilot', 'ts3pilot'));
  } finally {
    cleanupDir(dir);
  }
});

test('resolveBinaryPath falls back when argv path is missing', () => {
  const dir = tempDir('update-resolve');
  try {
    const binary = join(dir, 'ts3pilot');
    writeFileSync(binary, 'binary');
    assert.equal(resolveBinaryPath(binary), binary);
    const fallback = join(dir, 'fallback', 'ts3pilot');
    mkdirSync(join(dir, 'fallback'), { recursive: true });
    writeFileSync(fallback, 'binary');
    assert.equal(resolveBinaryPath(join(dir, 'missing'), fallback), fallback);
    assert.throws(() => resolveBinaryPath(join(dir, 'missing'), '/opt/ts3pilot/ts3pilot'));
  } finally {
    cleanupDir(dir);
  }
});
