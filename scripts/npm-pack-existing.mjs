/**
 * Pack the npm distribution from an already-built Linux release binary,
 * without running pkg locally.
 *
 * pkg-fetch's `linuxstatic` base binaries are downloaded from GitHub at build
 * time; on publisher machines where that download is blocked or slow (common
 * in CN networks), reuse the binary that CI already built and published:
 *
 *   node scripts/npm-pack-existing.mjs
 *   node scripts/npm-pack-existing.mjs --archive ./ts3pilot-linux-x64-v0.3.0.tar.gz
 *
 * Output: dist/release/ts3-manager-npm-v<version>.tgz (publish directly with
 * `npm publish <file> --access public`).
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const args = process.argv.slice(2);
const archiveFlag = args.findIndex((arg) => arg === '--archive');
const localArchive = archiveFlag >= 0 ? (args[archiveFlag + 1] ?? '') : '';

const releaseDir = join(root, 'dist', 'release');
const workDir = join(root, 'tmp', `npm-pack-${Date.now()}`);
const pkgDir = join(root, 'apps', 'ts3-manager');
const outBinary = join(pkgDir, 'dist', 'pkg', 'ts3pilot-linux-x64');

try {
  mkdirSync(workDir, { recursive: true });
  mkdirSync(join(pkgDir, 'dist', 'pkg'), { recursive: true });
  mkdirSync(releaseDir, { recursive: true });

  let archivePath = localArchive;
  if (archivePath.length === 0) {
    const assetUrl = `https://github.com/DazaiYuki/ts3pilot/releases/download/v${version}/ts3pilot-linux-x64-v${version}.tar.gz`;
    console.log(`Downloading: ${assetUrl}`);
    archivePath = join(workDir, 'release.tar.gz');
    const response = await fetch(assetUrl, { redirect: 'follow', signal: AbortSignal.timeout(600000) });
    if (!response.ok || response.body === null) {
      throw new Error(`download failed: HTTP ${response.status}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(archivePath));
  } else if (!existsSync(archivePath)) {
    throw new Error(`archive not found: ${archivePath}`);
  }

  const extractDir = join(workDir, 'extract');
  mkdirSync(extractDir, { recursive: true });
  execFileSync('tar', ['-xzf', archivePath, '-C', extractDir], { stdio: 'inherit' });

  const binary = findBinary(extractDir);
  if (binary === undefined) {
    throw new Error('no `ts3pilot` binary found in the archive');
  }
  copyFileSync(binary, outBinary);
  chmodSync(outBinary, 0o755);
  console.log(`staged binary: ${outBinary}`);

  execFileSync(process.execPath, [join(root, 'scripts', 'npm-prepack.mjs')], { cwd: pkgDir, stdio: 'inherit' });

  const packOutput = execFileSync(
    npm,
    ['pack', '--ignore-scripts', '--json', '--pack-destination', releaseDir, '--workspace', '@ts3pilot/ts3-manager'],
    { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  const packJson = JSON.parse(packOutput.trim());
  const packedFilename = Array.isArray(packJson)
    ? (packJson[0]?.filename ?? '')
    : ((Object.values(packJson)[0]?.filename) ?? '');
  if (packedFilename.length === 0) {
    throw new Error('npm pack did not report a tarball filename');
  }
  const finalTarball = join(releaseDir, `ts3-manager-npm-v${version}.tgz`);
  renameSync(join(releaseDir, packedFilename), finalTarball);

  console.log('');
  console.log(`npm tarball: ${finalTarball}`);
  console.log(`publish with: npm publish ${finalTarball}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

function findBinary(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const nested = findBinary(full);
      if (nested !== undefined) return nested;
    } else if (entry === 'ts3pilot') {
      return full;
    }
  }
  return undefined;
}
