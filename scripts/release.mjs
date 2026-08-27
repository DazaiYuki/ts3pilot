import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { writeTarGzArchive } from '../apps/ts3-manager/src/system/backupEngine.ts';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const releaseDir = join(root, 'dist', 'release');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log(`Building release v${version}...`);

// 1. Compile the CLI and package it into a single Linux standalone binary.
execFileSync(npm, ['run', 'bundle', '--workspace', '@ts3pilot/ts3-manager'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// 2. Stage the Linux package: binary + minimal static config only.
const binary = join(root, 'apps', 'ts3-manager', 'dist', 'pkg', 'ts3pilot-linux-x64');
if (!existsSync(binary)) {
  throw new Error(`pkg binary not found: ${binary}`);
}
const stageRoot = join(releaseDir, `ts3pilot-linux-x64-v${version}`);
const stage = join(stageRoot, 'ts3pilot');
rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(binary, join(stage, 'ts3pilot'));
cpSync(join(root, 'apps', 'ts3-manager', 'config.example.json'), join(stage, 'config.example.json'));
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));
cpSync(join(root, 'docs', 'notice.md'), join(stage, 'NOTICE.md'));

const cliArchive = join(releaseDir, `ts3pilot-linux-x64-v${version}.tar.gz`);
await writeTarGzArchive(collectEntries(stage), cliArchive);

// 3. WordPress plugin zip (unchanged: standard plugin directory structure).
const wpRoot = join(root, 'plugins', 'ts3pilot-wp');
const wpStageRoot = join(releaseDir, `ts3pilot-wp-v${version}`);
const wpStage = join(wpStageRoot, 'ts3pilot-wp');
rmSync(wpStageRoot, { recursive: true, force: true });
mkdirSync(wpStage, { recursive: true });
for (const file of collectWpFiles(wpRoot)) {
  const target = join(wpStage, file);
  mkdirSync(join(wpStage, file.split(/[\\/]/).slice(0, -1).join('/')), { recursive: true });
  cpSync(join(wpRoot, file), target);
}
const wpArchive = join(releaseDir, `ts3pilot-wp-v${version}.zip`);
execFileSync('tar', ['-a', '-cf', wpArchive, '-C', wpStageRoot, 'ts3pilot-wp'], { stdio: 'inherit' });

// 4. CDN mirror metadata.
cpSync(join(root, 'scripts', 'latest.json'), join(releaseDir, 'latest.json'));

for (const artifact of [cliArchive, wpArchive, join(releaseDir, 'latest.json')]) {
  const size = statSync(artifact).size;
  console.log(`artifact: ${artifact} (${(size / 1024).toFixed(1)} KiB)`);
}
console.log('release packaging complete.');

function collectEntries(dir) {
  const entries = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else entries.push({ name: relative(dir, full).split('\\').join('/'), path: full, type: 'file', size: stat.size });
    }
  };
  walk(dir);
  return entries;
}

function collectWpFiles(rootDir) {
  const excluded = new Set(['tests', 'vendor', 'build', '.phpunit.result.cache']);
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      if (excluded.has(entry)) continue;
      const full = join(current, entry);
      const stat = statSync(full);
      const rel = relative(rootDir, full).split('\\').join('/');
      if (stat.isDirectory()) walk(full);
      else files.push(rel);
    }
  };
  walk(rootDir);
  return files.filter((file) => !['composer.lock', 'package.json', 'package-lock.json', 'phpcs.xml.dist', 'phpunit.xml.dist'].includes(file));
}
