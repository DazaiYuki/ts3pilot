import {
  chmodSync,
  closeSync,
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { readTarGz } from '../../system/backupEngine.ts';
import { downloadFile } from '../../services/download.ts';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import { runProcess } from '../../system/processRunner.ts';
import { CLI_VERSION } from '../../version.ts';
import { flagBool } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

const REPO = 'DazaiYuki/ts3pilot';
const GITHUB_API = `https://api.github.com/repos/${REPO}/releases/latest`;
export const DEFAULT_MIRROR_PREFIXES: readonly string[] = [
  'https://mirror.ghproxy.com/',
  'https://gh-proxy.com/',
];
const FALLBACK_BINARY = '/opt/ts3pilot/ts3pilot';
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;

const GREEN = '\x1b[32m';
const NC = '\x1b[0m';

interface LatestRelease {
  tag: string;
  assetUrl: string;
  sha256?: string;
}

export async function runUpdateCommand(
  _ctx: CliContext,
  positionals: readonly string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const action = positionals[0] ?? 'self';
  if (action !== 'self' && action !== 'check') throw new AppError(ErrorCode.USER, 'usage: update [check|self]');
  const explicitNoMirror = flagBool(flags, 'no-mirror');
  const prefixes = explicitNoMirror || process.env.TS3PILOT_GH_MIRROR === '0'
    ? []
    : resolveMirrorPrefixes(process.env.TS3PILOT_GH_MIRROR);
  await runUpdate(prefixes, action);
}

async function runUpdate(mirrorPrefixes: readonly string[], action: string): Promise<void> {
  printLine(`当前版本: ${CLI_VERSION}`);
  let release: LatestRelease;
  try {
    release = await fetchLatestRelease();
  } catch (error) {
    throw new AppError(ErrorCode.NETWORK, `无法获取最新版本: ${error instanceof Error ? error.message : 'unknown'}`, { cause: error });
  }
  const latest = stripVersionTag(release.tag);
  printLine(`最新版本: ${latest}`);

  if (!isNewerVersion(latest, CLI_VERSION)) {
    printLine('已是最新版本 / Already up to date.');
    return;
  }
  printLine('发现新版本，开始更新... / New version available, updating...');
  if (action === 'check') {
    printLine(`下载地址: ${release.assetUrl}`);
    return;
  }

  if (!isPkgBinary()) {
    throw new AppError(ErrorCode.USER, 'Self-update 仅支持独立二进制版本（pkg 构建）；源码运行时请用 git pull 更新。');
  }
  if (process.platform !== 'linux') {
    throw new AppError(ErrorCode.UNSUPPORTED_PLATFORM, 'Self-update 仅支持 Linux。');
  }

  const target = resolveBinaryPath();
  const workDir = mkdtempSync(join(tmpdir(), 'ts3pilot-update-'));
  try {
    const archivePath = join(workDir, 'ts3pilot-update.tar.gz');
    await downloadWithMirror(release.assetUrl, archivePath, mirrorPrefixes);
    if (!release.sha256) throw new AppError(ErrorCode.VALIDATION, 'Release metadata has no SHA-256 digest; refusing an unverified update');
    await installUpdateArchive(archivePath, target, release.sha256, latest);

    printLine('');
    printLine(`${GREEN}✔ 更新完成！新版本 ${latest} 已就绪，重启 ts3pilot 后生效。${NC}`);
    printLine(`${GREEN}✔ Update complete! Restart ts3pilot to use ${latest}.${NC}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export async function installUpdateArchive(archive: string, target: string, expectedSha256: string, version: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new AppError(ErrorCode.VALIDATION, 'Invalid release SHA-256');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk as Buffer);
  if (hash.digest('hex') !== expectedSha256.toLowerCase()) throw new AppError(ErrorCode.VALIDATION, 'Release checksum mismatch');
  const work = mkdtempSync(join(tmpdir(), 'ts3pilot-extract-'));
  try {
    let binary: string | undefined;
    let total = 0;
    const names = new Set<string>();
    await readTarGz(archive, async (entry, content) => {
      total += entry.size;
      if (total > MAX_ARCHIVE_BYTES || names.has(entry.name)) throw new AppError(ErrorCode.VALIDATION, 'Invalid release archive size or duplicate entry');
      names.add(entry.name);
      if (basename(entry.name) === 'ts3pilot') {
        if (binary) throw new AppError(ErrorCode.VALIDATION, 'Multiple binaries in release archive');
        binary = join(work, 'ts3pilot');
        await pipeline(content, createWriteStream(binary, { mode: 0o700 }));
      } else {
        for await (const chunk of content) void chunk;
      }
    });
    if (!binary) throw new AppError(ErrorCode.VALIDATION, 'Release archive contains no ts3pilot binary');
    await swapBinarySafely({ target, newBinary: binary, verify: async path => {
      const probe = await runProcess(path, ['version'], { timeoutMs: 15000 });
      if (probe.exitCode !== 0 || probe.stdout.split(/\r?\n/)[0] !== `ts3pilot ${version}`) {
        throw new AppError(ErrorCode.VALIDATION, 'Downloaded binary failed version verification');
      }
    } });
  } finally { rmSync(work, { recursive: true, force: true }); }
}

export function stripVersionTag(tag: string): string {
  return tag.replace(/^v/, '');
}

export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map((part) => Number(part) || 0);
  const currentParts = current.split('.').map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i += 1) {
    const left = latestParts[i] ?? 0;
    const right = currentParts[i] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return false;
}

export function withMirror(url: string, prefix = DEFAULT_MIRROR_PREFIXES[0] as string): string {
  return `${prefix}${url}`;
}

export function resolveMirrorPrefixes(envValue: string | undefined): readonly string[] {
  if (envValue === undefined || envValue.length === 0) return DEFAULT_MIRROR_PREFIXES;
  if (envValue === '0') return [];
  const trimmed = envValue.trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(trimmed)) return [`${trimmed}/`];
  return [];
}

export function mirrorChain(url: string, prefixes: readonly string[]): readonly string[] {
  return prefixes.map((prefix) => withMirror(url, prefix));
}

export function findBinaryInDir(dir: string): string | undefined {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const nested = findBinaryInDir(full);
      if (nested !== undefined) return nested;
    } else if (entry === 'ts3pilot') {
      return full;
    }
  }
  return undefined;
}

export function resolveBinaryPath(argvPath = process.argv[1] ?? '', fallback = FALLBACK_BINARY): string {
  let candidate = argvPath;
  try {
    if (candidate.length > 0) candidate = realpathSync(candidate);
  } catch {
    // keep original path
  }
  if (candidate.length > 0 && existsSync(candidate) && basename(candidate) === 'ts3pilot') {
    return candidate;
  }
  if (existsSync(fallback) && basename(fallback) === 'ts3pilot') {
    return fallback;
  }
  throw new AppError(ErrorCode.SYSTEM, `找不到可更新的 ts3pilot 二进制（尝试了 ${candidate || argvPath} 与 ${fallback}）`);
}

export function isGzipArchive(path: string): boolean {
  try {
    const fd = openSync(path, 'r');
    try {
      const header = Buffer.alloc(2);
      const read = readSync(fd, header, 0, 2, 0);
      return read === 2 && header[0] === 0x1f && header[1] === 0x8b;
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

export interface BinarySwapOptions {
  target: string;
  newBinary: string;
  verify: (binary: string) => Promise<void> | void;
}

/**
 * Verify a staged candidate without touching the installed binary, then replace
 * it with an atomic same-filesystem rename. A failed preflight keeps the old file.
 */
export async function swapBinarySafely(options: BinarySwapOptions): Promise<void> {
  const { target, newBinary, verify } = options;
  if (!existsSync(newBinary)) {
    throw new AppError(ErrorCode.VALIDATION, `新二进制不存在: ${newBinary}`);
  }
  // Stage beside the destination so the final rename is atomic even when /tmp
  // is a separate filesystem. Verify before replacing the running executable.
  const staging = mkdtempSync(join(dirname(target), '.ts3pilot-update-'));
  const candidate = join(staging, 'ts3pilot');
  try {
    copyFileSync(newBinary, candidate);
    chmodSync(candidate, 0o755);
    await verify(candidate);
    // POSIX rename replaces a running binary without unlinking it first.
    renameSync(candidate, target);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function isPkgBinary(): boolean {
  return (process as NodeJS.Process & { pkg?: unknown }).pkg !== undefined;
}

async function fetchLatestRelease(): Promise<LatestRelease> {
  const pinned = process.env.TS3PILOT_VERSION;
  if (pinned && !/^\d+\.\d+\.\d+$/.test(pinned)) throw new AppError(ErrorCode.VALIDATION, 'Invalid TS3PILOT_VERSION');
  const metadataUrl = pinned ? `https://api.github.com/repos/${REPO}/releases/tags/v${pinned}` : GITHUB_API;
  const response = await fetch(metadataUrl, {
    headers: { 'user-agent': `ts3pilot/${CLI_VERSION}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new AppError(ErrorCode.NETWORK, `GitHub API HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    tag_name?: string;
    assets?: Array<{ browser_download_url?: string; digest?: string }>;
  };
  const tag = payload.tag_name ?? '';
  const asset = (payload.assets ?? []).find((entry) => /ts3pilot-linux-x64-v.*\.tar\.gz$/.test(entry.browser_download_url ?? ''));
  const assetUrl = asset?.browser_download_url ?? '';
  if (tag.length === 0 || assetUrl.length === 0) {
    throw new AppError(ErrorCode.NETWORK, 'Release 元数据不完整（缺少 tag 或 ts3pilot-linux-x64 发布包）');
  }
  return { tag, assetUrl, sha256: asset?.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1] };
}

async function downloadWithMirror(assetUrl: string, dest: string, mirrorPrefixes: readonly string[]): Promise<void> {
  const attempts: string[] = [...mirrorChain(assetUrl, mirrorPrefixes), assetUrl];
  let lastError: unknown;
  for (let index = 0; index < attempts.length; index += 1) {
    const url = attempts[index] as string;
    try {
      await downloadFile(url, dest, MAX_ARCHIVE_BYTES);
      if (index > 0) printLine(`已通过镜像/直连完成下载 (${index + 1}/${attempts.length})`);
      return;
    } catch (error) {
      lastError = error;
      if (index < attempts.length - 1) {
        printLine(`下载失败(${url})，尝试下一个源...`);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('所有下载源均失败');
}
