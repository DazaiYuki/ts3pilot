import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  createBackupArchive,
  inspectBackupArchive,
  isUnsafeTarPath,
  restoreBackupArchive,
} from '../src/system/backupEngine.ts';
import { cleanupDir, tempDir } from './util.ts';

function writeOctal(buffer: Buffer, offset: number, length: number, value: number): void {
  const text = value.toString(8).padStart(length - 1, '0');
  buffer.write(text, offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

function tarHeader(name: string, size: number, type: '0' | '5' | '2'): Buffer {
  const header = Buffer.alloc(512);
  header.write(name.slice(0, 100), 0, 100, 'utf8');
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 1700000000);
  header.fill(0x20, 148, 156);
  header[156] = type.charCodeAt(0);
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  let sum = 0;
  for (const byte of header) sum += byte;
  const checksum = sum.toString(8).padStart(6, '0');
  header.write(checksum, 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function craftTarGz(path: string, entries: Array<{ name: string; data: Buffer; type: '0' | '5' | '2' }>): void {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    blocks.push(tarHeader(entry.name, entry.data.length, entry.type));
    if (entry.data.length > 0) {
      blocks.push(entry.data);
      const padding = (512 - (entry.data.length % 512)) % 512;
      if (padding > 0) blocks.push(Buffer.alloc(padding));
    }
  }
  blocks.push(Buffer.alloc(1024));
  writeFileSync(path, gzipSync(Buffer.concat(blocks)));
}

test('backup engine roundtrip creates manifest and restores byte-identical files', async () => {
  const dir = tempDir('engine');
  try {
    const root = join(dir, 'ts3');
    mkdirSync(join(root, 'files', 'sub'), { recursive: true });
    writeFileSync(join(root, 'ts3server.sqlitedb'), 'sqlite-bytes-123');
    writeFileSync(join(root, 'ts3server.ini'), 'query_port=10011');
    writeFileSync(join(root, 'files', 'sub', 'upload.bin'), Buffer.from([1, 2, 3, 4, 5]));
    writeFileSync(join(root, 'licensekey.dat'), 'license-placeholder');

    const archive = join(dir, 'backup.tar.gz');
    const manifest = await createBackupArchive({
      rootDir: root,
      include: ['ts3server.sqlitedb', 'ts3server.ini', 'files', 'licensekey.dat'],
      archivePath: archive,
      ts3Version: '3.13.7-test',
    });
    assert.ok(existsSync(archive));
    assert.equal(manifest.files.length, 4);
    assert.equal(manifest.ts3Version, '3.13.7-test');
    assert.match(manifest.files[0]?.sha256 ?? '', /^[0-9a-f]{64}$/);

    const target = join(root, 'restore-out');
    mkdirSync(target, { recursive: true });
    const result = await restoreBackupArchive({
      archivePath: archive,
      targetRoot: target,
      allowedRoot: root,
      force: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.restoredFiles.length, 4);
    assert.equal(readFileSync(join(target, 'ts3server.sqlitedb'), 'utf8'), 'sqlite-bytes-123');
    assert.deepEqual([...readFileSync(join(target, 'files', 'sub', 'upload.bin'))], [1, 2, 3, 4, 5]);
  } finally {
    cleanupDir(dir);
  }
});

test('backup engine dry-run validates without writing files', async () => {
  const dir = tempDir('engine-dry');
  try {
    const root = join(dir, 'ts3');
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'ts3server.ini'), 'port=10011');
    const archive = join(dir, 'backup.tar.gz');
    await createBackupArchive({ rootDir: root, include: ['ts3server.ini'], archivePath: archive });

    const target = join(root, 'empty-target');
    mkdirSync(target, { recursive: true });
    const result = await restoreBackupArchive({
      archivePath: archive,
      targetRoot: target,
      allowedRoot: root,
      dryRun: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(existsSync(join(target, 'ts3server.ini')), false);
  } finally {
    cleanupDir(dir);
  }
});

test('backup engine rejects path traversal, absolute paths and links', async () => {
  const dir = tempDir('engine-traversal');
  try {
    const target = join(dir, 'target');
    mkdirSync(target, { recursive: true });
    const archive = join(dir, 'evil.tar.gz');
    craftTarGz(archive, [
      { name: 'normal.txt', data: Buffer.from('ok'), type: '0' },
      { name: '../evil.txt', data: Buffer.from('bad'), type: '0' },
    ]);
    const result = await restoreBackupArchive({
      archivePath: archive,
      targetRoot: target,
      allowedRoot: target,
      force: true,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('Unsafe path')));

    const absolute = join(dir, 'absolute.tar.gz');
    craftTarGz(absolute, [{ name: '/etc/evil', data: Buffer.from('x'), type: '0' }]);
    const absoluteResult = await restoreBackupArchive({
      archivePath: absolute,
      targetRoot: target,
      allowedRoot: target,
      force: true,
    });
    assert.equal(absoluteResult.ok, false);

    const link = join(dir, 'link.tar.gz');
    craftTarGz(link, [{ name: 'link', data: Buffer.alloc(0), type: '2' }]);
    const linkResult = await restoreBackupArchive({
      archivePath: link,
      targetRoot: target,
      allowedRoot: target,
      force: true,
    });
    assert.equal(linkResult.ok, false);
    assert.ok(linkResult.errors.some((error) => error.includes('link')));
  } finally {
    cleanupDir(dir);
  }
});

test('backup engine detects checksum mismatches in the manifest', async () => {
  const dir = tempDir('engine-manifest');
  try {
    const target = join(dir, 'target');
    mkdirSync(target, { recursive: true });
    const archive = join(dir, 'bad.tar.gz');
    const manifest = JSON.stringify({
      tool: 'ts3-manager',
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      sourceRoot: '/tmp/ts3',
      files: [{ path: 'a.txt', size: 3, sha256: '0'.repeat(64), mode: '640' }],
    });
    craftTarGz(archive, [
      { name: 'backup-manifest.json', data: Buffer.from(manifest), type: '0' },
      { name: 'a.txt', data: Buffer.from('abc'), type: '0' },
    ]);
    const inspect = await inspectBackupArchive(archive);
    assert.equal(inspect.ok, false);
    assert.ok(inspect.errors.some((error) => error.includes('Checksum mismatch')));
  } finally {
    cleanupDir(dir);
  }
});

test('backup engine rejects corrupted tar headers and targets outside the install root', async () => {
  const dir = tempDir('engine-corrupt');
  try {
    const archive = join(dir, 'corrupt.tar.gz');
    const header = tarHeader('x.txt', 1, '0');
    header[124] = 0; // corrupt size field -> checksum no longer matches
    const blocks = [header, Buffer.alloc(512), Buffer.alloc(1024)];
    writeFileSync(archive, gzipSync(Buffer.concat(blocks)));
    const inspect = await inspectBackupArchive(archive);
    assert.equal(inspect.ok, false);
    assert.ok(inspect.errors.some((error) => error.includes('Corrupted tar header')));

    const outside = join(dir, 'outside');
    mkdirSync(outside, { recursive: true });
    await assert.rejects(() =>
      restoreBackupArchive({
        archivePath: archive,
        targetRoot: outside,
        allowedRoot: join(dir, 'ts3-root'),
        force: true,
      }),
    );
  } finally {
    cleanupDir(dir);
  }
});

test('isUnsafeTarPath rejects traversal and absolute names', () => {
  assert.equal(isUnsafeTarPath('a/b.txt'), false);
  assert.equal(isUnsafeTarPath('../x'), true);
  assert.equal(isUnsafeTarPath('/etc/passwd'), true);
  assert.equal(isUnsafeTarPath('C:\\windows'), true);
  assert.equal(isUnsafeTarPath('a//b'), true);
});
