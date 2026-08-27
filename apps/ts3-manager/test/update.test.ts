import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  DEFAULT_MIRROR_PREFIXES,
  findBinaryInDir,
  isGzipArchive,
  isNewerVersion,
  mirrorChain,
  resolveBinaryPath,
  resolveMirrorPrefixes,
  stripVersionTag,
  swapBinarySafely,
  withMirror,
} from '../src/cli/commands/update.ts';
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

test('resolveMirrorPrefixes honours env overrides and defaults', () => {
  assert.deepEqual(resolveMirrorPrefixes(undefined), DEFAULT_MIRROR_PREFIXES);
  assert.deepEqual(resolveMirrorPrefixes('0'), []);
  assert.deepEqual(resolveMirrorPrefixes('https://cdn.example.test/'), ['https://cdn.example.test/']);
  assert.deepEqual(resolveMirrorPrefixes('https://cdn.example.test'), ['https://cdn.example.test/']);
});

test('mirrorChain builds a fallback list ending with the direct URL', () => {
  const url = 'https://github.com/DazaiYuki/ts3pilot/releases/download/v0.1.0/ts3pilot-linux-x64-v0.1.0.tar.gz';
  assert.deepEqual(mirrorChain(url, ['https://mirror.ghproxy.com/']), [
    'https://mirror.ghproxy.com/https://github.com/DazaiYuki/ts3pilot/releases/download/v0.1.0/ts3pilot-linux-x64-v0.1.0.tar.gz',
  ]);
  assert.deepEqual(mirrorChain(url, []), []);
});

test('isGzipArchive validates the magic bytes', () => {
  const dir = tempDir('update-gzip');
  try {
    const gzip = join(dir, 'x.tar.gz');
    writeFileSync(gzip, Buffer.from([0x1f, 0x8b, 0x08, 0x00]));
    assert.equal(isGzipArchive(gzip), true);
    const plain = join(dir, 'x.txt');
    writeFileSync(plain, 'not a gzip file');
    assert.equal(isGzipArchive(plain), false);
    assert.equal(isGzipArchive(join(dir, 'missing')), false);
  } finally {
    cleanupDir(dir);
  }
});

test('swapBinarySafely replaces the target and keeps it usable', async () => {
  const dir = tempDir('update-swap');
  try {
    const target = join(dir, 'ts3pilot');
    const newBinary = join(dir, 'new', 'ts3pilot');
    mkdirSync(join(dir, 'new'), { recursive: true });
    writeFileSync(target, 'old-binary');
    writeFileSync(newBinary, 'new-binary');

    let verified = 0;
    await swapBinarySafely({
      target,
      newBinary,
      verify: async (binary) => {
        verified += 1;
        assert.equal(readFileSync(binary, 'utf8'), 'new-binary');
      },
    });
    assert.equal(verified, 1);
    assert.equal(readFileSync(target, 'utf8'), 'new-binary');
  } finally {
    cleanupDir(dir);
  }
});

test('swapBinarySafely rolls back when verification fails', async () => {
  const dir = tempDir('update-rollback');
  try {
    const target = join(dir, 'ts3pilot');
    const newBinary = join(dir, 'new', 'ts3pilot');
    mkdirSync(join(dir, 'new'), { recursive: true });
    writeFileSync(target, 'old-binary');
    writeFileSync(newBinary, 'broken-binary');

    await assert.rejects(
      swapBinarySafely({
        target,
        newBinary,
        verify: async () => {
          throw new Error('smoke test failed');
        },
      }),
      /smoke test failed/,
    );
    assert.equal(readFileSync(target, 'utf8'), 'old-binary');
  } finally {
    cleanupDir(dir);
  }
});

test('swapBinarySafely rejects a missing new binary without touching the target', async () => {
  const dir = tempDir('update-missing');
  try {
    const target = join(dir, 'ts3pilot');
    writeFileSync(target, 'old-binary');
    await assert.rejects(
      swapBinarySafely({
        target,
        newBinary: join(dir, 'does-not-exist'),
        verify: async () => undefined,
      }),
      (error: unknown) => error instanceof Error && error.message.includes('新二进制不存在'),
    );
    assert.equal(readFileSync(target, 'utf8'), 'old-binary');
  } finally {
    cleanupDir(dir);
  }
});

test('swapBinarySafely works when the target does not exist yet', async () => {
  const dir = tempDir('update-fresh');
  try {
    const target = join(dir, 'ts3pilot');
    const newBinary = join(dir, 'new', 'ts3pilot');
    mkdirSync(join(dir, 'new'), { recursive: true });
    writeFileSync(newBinary, 'fresh-binary');
    await swapBinarySafely({ target, newBinary, verify: async () => undefined });
    assert.equal(readFileSync(target, 'utf8'), 'fresh-binary');
  } finally {
    cleanupDir(dir);
  }
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
