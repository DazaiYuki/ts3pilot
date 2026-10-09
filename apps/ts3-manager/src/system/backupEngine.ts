import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  accessSync,
  constants,
  chmodSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  lstatSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { AppError, ErrorCode } from '../domain/errors.ts';
import { CLI_VERSION } from '../version.ts';

const TAR_BLOCK = 512;
const MAX_FILE_SIZE = 8 * 1024 * 1024 * 1024 - 1;

export interface BackupManifestEntry {
  path: string;
  size: number;
  sha256: string;
  mode: string;
}

export interface BackupManifest {
  tool: string;
  version: string;
  createdAt: string;
  ts3Version?: string;
  sourceRoot: string;
  files: BackupManifestEntry[];
}

export interface CreateBackupOptions {
  rootDir: string;
  include: readonly string[];
  excludeDirs?: readonly string[];
  archivePath: string;
  ts3Version?: string;
}

export interface RestoreOptions {
  archivePath: string;
  targetRoot: string;
  allowedRoot: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface InspectResult {
  ok: boolean;
  manifest: BackupManifest | undefined;
  fileCount: number;
  errors: string[];
}

export interface RestoreResult {
  ok: boolean;
  dryRun: boolean;
  restoredFiles: string[];
  errors: string[];
}

export const MANIFEST_NAME = 'backup-manifest.json';
export const DEFAULT_BACKUP_INCLUDES: readonly string[] = [
  'ts3server.sqlitedb',
  'ts3server.ini',
  'files',
  'licensekey.dat',
  '.ts3server.sqlitedb',
];

function writeOctal(buffer: Buffer, offset: number, length: number, value: number): void {
  const text = value.toString(8).padStart(length - 1, '0');
  buffer.write(text, offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

function buildTarHeader(input: { name: string; size: number; mtime: number; mode: number; type: '0' | '5' }): Buffer {
  const header = Buffer.alloc(TAR_BLOCK);
  let base = Buffer.from(input.name, 'utf8');
  let prefix = Buffer.alloc(0);
  if (base.length > 100) {
    const split = Array.from({ length: input.name.length }, (_, i) => i).reverse().find((i) =>
      input.name[i] === '/' && Buffer.byteLength(input.name.slice(0, i)) <= 155 && Buffer.byteLength(input.name.slice(i + 1)) <= 100,
    );
    if (split === undefined) throw new AppError(ErrorCode.VALIDATION, `Path cannot be represented in a ustar archive: ${input.name}`);
    base = Buffer.from(input.name.slice(split + 1));
    prefix = Buffer.from(input.name.slice(0, split));
  }
  base.copy(header, 0);
  writeOctal(header, 100, 8, input.mode & 0o7777);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, input.size);
  writeOctal(header, 136, 12, input.mtime);
  header.fill(0x20, 148, 156);
  header[156] = input.type.charCodeAt(0);
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  prefix.copy(header, 345);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const checksumText = checksum.toString(8).padStart(6, '0');
  header.write(checksumText, 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function parseTarHeader(header: Buffer): { name: string; size: number; mtime: number; mode: number; type: string; checksumValid: boolean } {
  const base = header.subarray(0, 100).toString('utf8').replace(/\0+$/, '');
  const prefix = header.subarray(345, 500).toString('utf8').replace(/\0+$/, '');
  const name = prefix.length > 0 ? `${prefix}/${base}` : base;
  const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0/g, '').trim() || '0', 8);
  const mtime = parseInt(header.subarray(136, 148).toString('utf8').replace(/\0/g, '').trim() || '0', 8);
  const mode = parseInt(header.subarray(100, 108).toString('utf8').replace(/\0/g, '').trim() || '0', 8);
  const type = String.fromCharCode(header[156] ?? 48);
  const stored = header.subarray(148, 156).toString('utf8').replace(/\0/g, '').trim();
  const saved = Buffer.from(header);
  saved.fill(0x20, 148, 156);
  let sum = 0;
  for (const byte of saved) sum += byte;
  return { name, size, mtime, mode, type, checksumValid: stored === sum.toString(8).padStart(6, '0') };
}

export function isUnsafeTarPath(name: string): boolean {
  if (name.length === 0 || name.startsWith('/') || name.includes('\\')) return true;
  if (/^[A-Za-z]:/.test(name)) return true;
  return name.split('/').some((part) => part === '..' || part === '' || part === '.');
}

async function writeTar(entries: Array<{ name: string; path: string; type: 'file' | 'dir'; size: number }>, tarPath: string): Promise<void> {
  const out = createWriteStream(tarPath);
  const endBlocks = Buffer.alloc(TAR_BLOCK * 2);
  try {
    for (const entry of entries) {
      const header = buildTarHeader({
        name: entry.name,
        size: entry.size,
        mtime: Math.floor(Date.now() / 1000),
        mode: statSync(entry.path).mode & 0o777,
        type: entry.type === 'dir' ? '5' : '0',
      });
      out.write(header);
      if (entry.type === 'file') {
        await pipeFile(entry.path, out);
        const padding = (TAR_BLOCK - (entry.size % TAR_BLOCK)) % TAR_BLOCK;
        if (padding > 0) out.write(Buffer.alloc(padding));
      }
    }
    out.write(endBlocks);
    await new Promise<void>((resolvePromise, rejectPromise) => {
      out.end((error?: Error | null) => (error === null || error === undefined ? resolvePromise() : rejectPromise(error)));
    });
  } catch (error) {
    out.destroy();
    throw error;
  }
}

function pipeFile(path: string, out: NodeJS.WritableStream): Promise<void> {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const source = createReadStream(path);
    source.on('error', rejectPromise);
    source.pipe(out, { end: false });
    source.on('end', resolvePromise);
  });
}

export async function writeTarGzArchive(entries: Array<{ name: string; path: string; type: 'file' | 'dir'; size: number }>, archivePath: string): Promise<void> {
  const temporaryTar = `${archivePath}.${process.pid}.tar`;
  const temporaryGz = `${archivePath}.${process.pid}.gz`;
  try {
    await writeTar(entries, temporaryTar);
    await pipeline(createReadStream(temporaryTar), createGzip(), createWriteStream(temporaryGz));
    renameSync(temporaryGz, archivePath);
  } finally {
    for (const file of [temporaryTar, temporaryGz]) {
      try {
        if (existsSync(file)) unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }
}

interface TarFileEntryInfo {
  name: string;
  size: number;
  mode: number;
  sha256: string;
}

/**
 * Stream a .tar.gz archive, validating every entry. Regular files are delivered
 * one at a time through a single PassThrough stream; the entry's SHA-256 is
 * computed while streaming and exposed after `onFile` resolves.
 */
export async function readTarGz(
  archivePath: string,
  onFile: (entry: TarFileEntryInfo, content: PassThrough) => Promise<void>,
  onUnsupported?: (name: string, type: string) => void,
): Promise<void> {
  const input = createReadStream(archivePath);
  const source = createGunzip();
  input.on('error', (error) => source.destroy(error));
  input.pipe(source);
  const iterator = source[Symbol.asyncIterator]();
  let pending: Buffer = Buffer.alloc(0);
  const read = async (size: number): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    let remaining = size;
    while (remaining > 0) {
      if (pending.length === 0) {
        const chunk = await iterator.next();
        if (chunk.done) throw new AppError(ErrorCode.VALIDATION, 'Archive ended before the end-of-archive marker');
        pending = chunk.value as Buffer;
      }
      const take = Math.min(remaining, pending.length);
      chunks.push(pending.subarray(0, take));
      pending = pending.subarray(take);
      remaining -= take;
    }
    return Buffer.concat(chunks, size);
  };
  try {
    while (true) {
      const header = await read(TAR_BLOCK);
      if (header.every((byte) => byte === 0)) {
        if (!(await read(TAR_BLOCK)).every((byte) => byte === 0)) {
          throw new AppError(ErrorCode.VALIDATION, 'Invalid end-of-archive marker');
        }
        // Consume the gzip stream to verify its footer/CRC instead of returning
        // early and silently accepting a truncated or corrupt compressed file.
        if (pending.some((byte) => byte !== 0)) throw new AppError(ErrorCode.VALIDATION, 'Unexpected trailing archive data');
        for await (const chunk of source) {
          if ((chunk as Buffer).some((byte) => byte !== 0)) throw new AppError(ErrorCode.VALIDATION, 'Unexpected trailing archive data');
        }
        return;
      }
      const parsed = parseTarHeader(header);
      if (!parsed.checksumValid) throw new AppError(ErrorCode.VALIDATION, 'Corrupted tar header (checksum mismatch)');
      const name = parsed.type === '5' ? parsed.name.replace(/\/$/, '') : parsed.name;
      if (isUnsafeTarPath(name)) throw new AppError(ErrorCode.VALIDATION, `Unsafe path in archive: ${name}`);
      if (!Number.isSafeInteger(parsed.size) || parsed.size < 0 || parsed.size > MAX_FILE_SIZE) {
        throw new AppError(ErrorCode.VALIDATION, 'Invalid archive entry size');
      }
      if (parsed.type === '2' || parsed.type === '1') throw new AppError(ErrorCode.VALIDATION, `Unsupported link entry in archive: ${name}`);
      if (parsed.type !== '0' && parsed.type !== '5') {
        onUnsupported?.(name, parsed.type);
        throw new AppError(ErrorCode.VALIDATION, `Unsupported archive entry type: ${parsed.type}`);
      }
      const entry: TarFileEntryInfo = { name, size: parsed.size, mode: parsed.mode, sha256: '' };
      const hash = createHash('sha256');
      const pass = parsed.type === '0' ? new PassThrough() : undefined;
      pass?.on('error', () => {});
      const consumed = pass === undefined ? undefined : onFile(entry, pass);
      // A callback can reject while the producer is awaiting archive bytes.
      consumed?.catch((error: unknown) => { pass?.destroy(error instanceof Error ? error : new Error(String(error))); });
      try {
        let remaining = parsed.size;
        while (remaining > 0) {
          const data = await read(Math.min(remaining, 64 * 1024));
          hash.update(data);
          if (pass?.destroyed) {
            await consumed;
            throw new AppError(ErrorCode.VALIDATION, 'Archive consumer closed early');
          }
          if (pass !== undefined && !pass.write(data)) {
            await once(pass, 'drain');
          }
          remaining -= data.length;
        }
        entry.sha256 = hash.digest('hex');
        pass?.end();
        await consumed;
      } catch (error) {
        pass?.destroy();
        throw error;
      }
      const padding = (TAR_BLOCK - (parsed.size % TAR_BLOCK)) % TAR_BLOCK;
      if (padding > 0) await read(padding);
    }
  } finally {
    input.destroy();
    source.destroy();
  }
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

function collectFiles(rootDir: string, include: readonly string[], excludeDirs: readonly string[]): string[] {
  const root = resolve(rootDir);
  const files: string[] = [];
  for (const relative of include) {
    const full = resolve(root, relative);
    if (full !== root && !full.startsWith(`${root}${sep}`)) {
      throw new AppError(ErrorCode.VALIDATION, `Include path escapes backup root: ${relative}`);
    }
    if (!existsSync(full)) continue;
    walk(full, excludeDirs, files);
  }
  return files;
}

function walk(dir: string, excludeDirs: readonly string[], out: string[]): void {
  const stat = lstatSync(dir);
  if (stat.isSymbolicLink()) throw new AppError(ErrorCode.VALIDATION, `Refusing to back up symlink: ${dir}`);
  if (stat.isFile()) {
    out.push(dir);
    return;
  }
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new AppError(ErrorCode.VALIDATION, `Refusing to back up symlink: ${full}`);
    if (stat.isDirectory()) {
      if (excludeDirs.includes(entry)) continue;
      walk(full, excludeDirs, out);
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
}

export async function createBackupArchive(options: CreateBackupOptions): Promise<BackupManifest> {
  const rootDir = resolve(options.rootDir);
  if (!existsSync(rootDir)) {
    throw new AppError(ErrorCode.CONFIG, `Backup root does not exist: ${rootDir}`);
  }
  const excludeDirs = options.excludeDirs ?? ['logs', 'cache'];
  const files = [...new Set(collectFiles(rootDir, options.include, excludeDirs))];
  if (!files.length) throw new AppError(ErrorCode.VALIDATION, 'No files found to back up');
  const manifest: BackupManifest = {
    tool: 'ts3-manager',
    version: CLI_VERSION,
    createdAt: new Date().toISOString(),
    ts3Version: options.ts3Version,
    sourceRoot: rootDir,
    files: [],
  };

  for (const file of files) {
    const relative = file.slice(rootDir.length + 1).split(sep).join('/');
    if (isUnsafeTarPath(relative)) {
      throw new AppError(ErrorCode.VALIDATION, `Unsafe relative path: ${relative}`);
    }
    const fileStat = statSync(file);
    if (fileStat.size > MAX_FILE_SIZE) {
      throw new AppError(ErrorCode.VALIDATION, `File too large to back up: ${relative}`);
    }
    manifest.files.push({
      path: relative,
      size: fileStat.size,
      sha256: await sha256File(file),
      mode: fileStat.mode.toString(8),
    });
  }
  manifest.files.sort((a, b) => a.path.localeCompare(b.path));

  const manifestTemp = `${options.archivePath}.${process.pid}.manifest`;
  mkdirSync(dirname(options.archivePath), { recursive: true });
  writeFileSync(manifestTemp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const entries = [
    { name: MANIFEST_NAME, path: manifestTemp, type: 'file' as const, size: statSync(manifestTemp).size },
    ...manifest.files.map((file) => ({
      name: file.path,
      path: join(rootDir, ...file.path.split('/')),
      type: 'file' as const,
      size: file.size,
    })),
  ];
  try {
    await writeTarGzArchive(entries, options.archivePath);
  } finally {
    try {
      unlinkSync(manifestTemp);
    } catch {
      // ignore
    }
  }
  return manifest;
}

export async function inspectBackupArchive(archivePath: string): Promise<InspectResult> {
  const errors: string[] = [];
  let manifest: BackupManifest | undefined;
  let fileCount = 0;
  const manifestBytes: Buffer[] = [];
  const hashes = new Map<string, { sha256: string; size: number }>();
  const names = new Set<string>();

  try {
    await readTarGz(
      archivePath,
      async (entry, content) => {
        if (names.has(entry.name)) throw new AppError(ErrorCode.VALIDATION, `Duplicate archive entry: ${entry.name}`);
        names.add(entry.name);
        if (entry.name === MANIFEST_NAME) {
          if (entry.size > 1024 * 1024) throw new AppError(ErrorCode.VALIDATION, 'Backup manifest too large');
          for await (const chunk of content) manifestBytes.push(chunk as Buffer);
          return;
        }
        const hash = createHash('sha256');
        let size = 0;
        for await (const chunk of content) {
          hash.update(chunk as Buffer);
          size += (chunk as Buffer).length;
        }
        hashes.set(entry.name, { sha256: hash.digest('hex'), size });
        fileCount += 1;
      },
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown archive error');
    return { ok: false, manifest: undefined, fileCount: 0, errors };
  }

  try {
    manifest = JSON.parse(Buffer.concat(manifestBytes).toString('utf8')) as BackupManifest;
    if (!manifest || !Array.isArray(manifest.files)) throw new Error('Invalid manifest');
    const paths = new Set<string>();
    for (const file of manifest.files) {
      if (!file || typeof file.path !== 'string' || isUnsafeTarPath(file.path) || paths.has(file.path) ||
          !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) {
        throw new Error('Invalid manifest entry');
      }
      paths.add(file.path);
    }
  } catch {
    errors.push('backup-manifest.json is missing or corrupted');
    return { ok: false, manifest: undefined, fileCount, errors };
  }

  for (const file of manifest.files) {
    const actual = hashes.get(file.path);
    if (actual === undefined) {
      errors.push(`Missing file in archive: ${file.path}`);
      continue;
    }
    if (actual.sha256 !== file.sha256) errors.push(`Checksum mismatch for ${file.path}`);
    if (actual.size !== file.size) errors.push(`Size mismatch for ${file.path}`);
  }
  for (const name of hashes.keys()) {
    if (!manifest.files.some((file) => file.path === name)) {
      errors.push(`Unexpected file in archive: ${name}`);
    }
  }
  return { ok: errors.length === 0, manifest, fileCount, errors };
}

export async function restoreBackupArchive(options: RestoreOptions): Promise<RestoreResult> {
  const allowedRoot = resolve(options.allowedRoot);
  const targetRoot = resolve(options.targetRoot);
  if (targetRoot !== allowedRoot && !targetRoot.startsWith(`${allowedRoot}${sep}`)) {
    throw new AppError(ErrorCode.VALIDATION, `Restore target is outside the configured TS3 install root: ${targetRoot}`);
  }
  const inspect = await inspectBackupArchive(options.archivePath);
  if (!inspect.ok) {
    return { ok: false, dryRun: options.dryRun ?? false, restoredFiles: [], errors: inspect.errors };
  }
  if (options.dryRun === true) {
    if (!existsSync(targetRoot)) {
      return { ok: false, dryRun: true, restoredFiles: [], errors: [`Target directory does not exist: ${targetRoot}`] };
    }
    try {
      accessSync(targetRoot, constants.W_OK);
    } catch {
      return { ok: false, dryRun: true, restoredFiles: [], errors: [`Target directory is not writable: ${targetRoot}`] };
    }
    return { ok: true, dryRun: true, restoredFiles: [], errors: [] };
  }
  if (options.force !== true) {
    throw new AppError(ErrorCode.PERMISSION, 'Restore requires force=true (destructive, audited operation)', { httpStatus: 403 });
  }

  const restored: string[] = [];
  const errors: string[] = [];
  mkdirSync(targetRoot, { recursive: true });
  try {
    await readTarGz(
      options.archivePath,
      async (entry, content) => {
        if (entry.name === MANIFEST_NAME) {
          await drainStream(content);
          return;
        }
        const target = join(targetRoot, ...entry.name.split('/'));
        if (!target.startsWith(`${targetRoot}${sep}`)) {
          throw new AppError(ErrorCode.VALIDATION, `Unsafe restore target: ${target}`);
        }
        assertNoSymlinks(targetRoot, target);
        mkdirSync(dirname(target), { recursive: true });
        await pipeline(content, createWriteStream(target));
        chmodSync(target, entry.mode & 0o777);
        restored.push(entry.name);
      },
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Restore failed');
    return { ok: false, dryRun: false, restoredFiles: restored, errors };
  }
  return { ok: errors.length === 0, dryRun: false, restoredFiles: restored, errors };
}

function assertNoSymlinks(root: string, target: string): void {
  let current = resolve(root);
  // Also reject a symlink in the target root or one of its ancestors.
  const check = (path: string): void => {
    try {
      if (lstatSync(path).isSymbolicLink()) throw new AppError(ErrorCode.VALIDATION, `Refusing symlink restore target: ${path}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  };
  for (let ancestor = current; ; ancestor = dirname(ancestor)) {
    check(ancestor);
    if (ancestor === dirname(ancestor)) break;
  }
  for (const part of target.slice(current.length + 1).split(sep)) {
    current = join(current, part);
    check(current);
  }
}

async function drainStream(stream: PassThrough): Promise<void> {
  for await (const chunk of stream) {
    void chunk;
  }
}
