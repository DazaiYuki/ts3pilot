import { createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
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

const TAR_BLOCK = 512;
const MAX_FILE_SIZE = 8 * 1024 * 1024 * 1024;

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
  const nameBytes = Buffer.from(input.name, 'utf8');
  const base = nameBytes.subarray(0, 100);
  const prefix = nameBytes.subarray(100, 255);
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
        mode: 0o640,
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
  const source = createReadStream(archivePath).pipe(createGunzip());
  let pending = Buffer.alloc(0);
  let current:
    | {
        name: string;
        size: number;
        mode: number;
        type: 'file' | 'dir' | 'unsupported';
        remaining: number;
        hash: ReturnType<typeof createHash>;
        pass?: PassThrough;
        onFileDone?: Promise<void>;
        sha256?: string;
      }
    | undefined;

  for await (const chunk of source) {
    // Stream file data directly out of the incoming chunk: large entries (e.g.
    // a multi-hundred-MB files/ directory) never accumulate in `pending`, so
    // memory stays bounded regardless of entry size.
    if (current !== undefined && current.remaining > 0) {
      const chunkBuffer = chunk as Buffer;
      const take = Math.min(current.remaining, chunkBuffer.length);
      if (take > 0) {
        const data = chunkBuffer.subarray(0, take);
        current.hash.update(data);
        if (current.pass !== undefined) current.pass.write(data);
        current.remaining -= take;
      }
      if (current.remaining === 0) {
        const padding = (TAR_BLOCK - (current.size % TAR_BLOCK)) % TAR_BLOCK;
        const rest = chunkBuffer.subarray(take);
        if (rest.length < padding) {
          pending = Buffer.concat([pending, rest]);
        } else {
          pending = Buffer.concat([pending, rest.subarray(padding)]);
        }
        if (current.pass !== undefined) {
          current.pass.end();
          current.sha256 = current.hash.digest('hex');
          if (current.onFileDone !== undefined) await current.onFileDone;
        }
        current = undefined;
      } else {
        continue;
      }
    } else {
      pending = Buffer.concat([pending, chunk as Buffer]);
    }

    while (true) {
      if (current === undefined) {
        if (pending.length < TAR_BLOCK) break;
        const headerBytes = pending.subarray(0, TAR_BLOCK);
        pending = pending.subarray(TAR_BLOCK);
        const parsed = parseTarHeader(headerBytes);
        if (parsed.name.length === 0 && parsed.size === 0) {
          return;
        }
        if (!parsed.checksumValid) {
          throw new AppError(ErrorCode.VALIDATION, 'Corrupted tar header (checksum mismatch)');
        }
        if (isUnsafeTarPath(parsed.name)) {
          throw new AppError(ErrorCode.VALIDATION, `Unsafe path in archive: ${parsed.name}`);
        }
        if (parsed.type === '2' || parsed.type === '1') {
          throw new AppError(ErrorCode.VALIDATION, `Unsupported link entry in archive: ${parsed.name}`);
        }
        if (parsed.type !== '0' && parsed.type !== '5') {
          onUnsupported?.(parsed.name, parsed.type);
        }
        const isFile = parsed.type === '0';
        current = {
          name: parsed.name,
          size: parsed.size,
          mode: parsed.mode,
          type: isFile ? 'file' : parsed.type === '5' ? 'dir' : 'unsupported',
          remaining: parsed.size,
          hash: createHash('sha256'),
        };
        if (isFile) {
          current.pass = new PassThrough();
          const entryInfo: TarFileEntryInfo = { name: current.name, size: current.size, mode: current.mode, sha256: '' };
          const pass = current.pass;
          current.onFileDone = onFile(entryInfo, pass);
        }
        continue;
      }

      const take = Math.min(current.remaining, pending.length);
      if (take > 0) {
        const data = pending.subarray(0, take);
        current.hash.update(data);
        if (current.pass !== undefined) current.pass.write(data);
        pending = pending.subarray(take);
        current.remaining -= take;
      }
      if (current.remaining === 0) {
        const padding = (TAR_BLOCK - (current.size % TAR_BLOCK)) % TAR_BLOCK;
        if (pending.length < padding) break;
        pending = pending.subarray(padding);
        if (current.pass !== undefined) {
          current.pass.end();
          current.sha256 = current.hash.digest('hex');
          if (current.onFileDone !== undefined) await current.onFileDone;
        }
        current = undefined;
      } else if (take === 0) {
        break;
      }
    }
  }
  throw new AppError(ErrorCode.VALIDATION, 'Archive ended before the end-of-archive marker');
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
  const stat = statSync(dir);
  if (stat.isFile()) {
    out.push(dir);
    return;
  }
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const stat = statSync(full);
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
  const files = collectFiles(rootDir, options.include, excludeDirs);
  const manifest: BackupManifest = {
    tool: 'ts3-manager',
    version: '0.1.0',
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
  mkdirSync(dirname(options.archivePath), { recursive: true });
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

  try {
    await readTarGz(
      archivePath,
      async (entry, content) => {
        if (entry.name === MANIFEST_NAME) {
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
        mkdirSync(dirname(target), { recursive: true });
        await pipeline(content, createWriteStream(target));
        restored.push(entry.name);
      },
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Restore failed');
    return { ok: false, dryRun: false, restoredFiles: restored, errors };
  }
  return { ok: errors.length === 0, dryRun: false, restoredFiles: restored, errors };
}

async function drainStream(stream: PassThrough): Promise<void> {
  for await (const chunk of stream) {
    void chunk;
  }
}
