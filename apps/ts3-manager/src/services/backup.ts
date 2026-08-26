import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { AppError, ErrorCode } from '../domain/errors.ts';

export interface BackupManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface BackupManifest {
  tool: string;
  version: string;
  createdAt: string;
  sourceDir: string;
  files: BackupManifestFile[];
}

export interface BackupOptions {
  excludeDirs?: readonly string[];
}

const DEFAULT_EXCLUDE_DIRS = ['logs', 'backup'];

function assertNotInside(root: string, target: string, label: string): string {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  if (resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${sep}`)) {
    throw new AppError(ErrorCode.VALIDATION, `${label} must not be inside or equal to the source directory: ${target}`, { httpStatus: 400 });
  }
  return resolvedTarget;
}

async function collectFiles(sourceDir: string, excludeDirs: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (excludeDirs.includes(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  await walk(sourceDir);
  return files;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk as Buffer));
    stream.on('end', () => resolvePromise());
    stream.on('error', rejectPromise);
  });
  return hash.digest('hex');
}

export async function createBackup(sourceDir: string, destDir: string, options: BackupOptions = {}): Promise<BackupManifest> {
  const excludeDirs = [...DEFAULT_EXCLUDE_DIRS, ...(options.excludeDirs ?? [])];
  const resolvedSource = await realpath(sourceDir);
  const resolvedDest = assertNotInside(resolvedSource, destDir, 'backup destination');

  await mkdir(resolvedDest, { recursive: true });
  const files = await collectFiles(resolvedSource, excludeDirs);
  const manifestFiles: BackupManifestFile[] = [];

  for (const file of files) {
    const relativePath = relative(resolvedSource, file);
    if (relativePath.split(sep).some((part) => part === '..')) {
      throw new AppError(ErrorCode.VALIDATION, `Refusing to back up path outside source: ${relativePath}`);
    }
    const target = join(resolvedDest, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
    const fileStat = await stat(file);
    manifestFiles.push({ path: relativePath, size: fileStat.size, sha256: await sha256File(file) });
  }

  const manifest: BackupManifest = {
    tool: 'ts3-manager',
    version: '0.1.0',
    createdAt: new Date().toISOString(),
    sourceDir: resolvedSource,
    files: manifestFiles,
  };
  await writeFile(join(resolvedDest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export interface RestorePlan {
  backupDir: string;
  destDir: string;
  files: string[];
}

export async function planRestore(backupDir: string, destDir: string): Promise<RestorePlan> {
  const resolvedBackup = await realpath(backupDir);
  const manifestPath = join(resolvedBackup, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as BackupManifest;
  const resolvedDest = resolve(destDir);
  if (resolvedDest === resolvedBackup || resolvedDest.startsWith(`${resolvedBackup}${sep}`)) {
    throw new AppError(ErrorCode.VALIDATION, 'Restore destination must not be inside the backup directory');
  }
  for (const entry of manifest.files) {
    const normalized = normalize(entry.path);
    if (normalized.startsWith('..') || normalized.startsWith(`${sep}`) || /^[A-Za-z]:/.test(normalized)) {
      throw new AppError(ErrorCode.VALIDATION, `Unsafe path in backup manifest: ${entry.path}`);
    }
  }
  return {
    backupDir: resolvedBackup,
    destDir: resolvedDest,
    files: manifest.files.map((entry) => entry.path),
  };
}

export async function executeRestore(backupDir: string, destDir: string): Promise<RestorePlan> {
  const plan = await planRestore(backupDir, destDir);
  const manifest = JSON.parse(await readFile(join(plan.backupDir, 'manifest.json'), 'utf8')) as BackupManifest;
  await mkdir(plan.destDir, { recursive: true });
  for (const entry of manifest.files) {
    const source = join(plan.backupDir, entry.path);
    const target = join(plan.destDir, entry.path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  return plan;
}

export function backupDirName(): string {
  return `ts3-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}
