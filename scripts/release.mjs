import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { writeTarGzArchive } from '../apps/ts3-manager/src/system/backupEngine.ts';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const version = JSON.parse(readFileUtf8(join(root, 'package.json'))).version;
const releaseDir = join(root, 'dist', 'release');

console.log(`Building release v${version}...`);

// 1. Compile the CLI/Agent.
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--workspace', '@ts3pilot/ts3-manager'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// 2. Stage the CLI package and create a tar.gz using the project's own engine.
const cliStage = join(releaseDir, `ts3-manager-v${version}`);
rmSync(cliStage, { recursive: true, force: true });
mkdirSync(cliStage, { recursive: true });
cpSync(join(root, 'apps', 'ts3-manager', 'dist'), join(cliStage, 'dist'), { recursive: true });
for (const file of ['package.json', 'README.md', 'config.example.json']) {
  cpSync(join(root, 'apps', 'ts3-manager', file), join(cliStage, file));
}
for (const file of ['LICENSE', 'docs/notice.md', 'README.md', 'docs/architecture.md', 'docs/deployment.md', 'scripts/install.sh']) {
  if (existsSync(join(root, file))) cpSync(join(root, file), join(cliStage, basename(file)));
}
const cliArchive = join(releaseDir, `ts3-manager-v${version}.tar.gz`);
const cliEntries = collectEntries(cliStage);
await writeTarGzArchive(cliEntries, cliArchive);

// 3. Stage the WordPress plugin and create a standard .zip.
const wpRoot = join(root, 'plugins', 'ts3pilot-wp');
const wpStageRoot = join(releaseDir, `ts3pilot-wp-v${version}`);
const wpStage = join(wpStageRoot, 'ts3pilot-wp');
rmSync(wpStageRoot, { recursive: true, force: true });
mkdirSync(wpStage, { recursive: true });
const wpFiles = collectWpFiles(wpRoot);
for (const file of wpFiles) {
  const target = join(wpStage, file);
  mkdirSync(join(wpStage, file.split(/[\\/]/).slice(0, -1).join('/')), { recursive: true });
  cpSync(join(wpRoot, file), target);
}
const wpArchive = join(releaseDir, `ts3pilot-wp-v${version}.zip`);
execFileSync('tar', ['-a', '-cf', wpArchive, '-C', wpStageRoot, 'ts3pilot-wp'], { stdio: 'inherit' });

// 4. Report.
for (const artifact of [cliArchive, wpArchive]) {
  const size = statSync(artifact).size;
  console.log(`artifact: ${artifact} (${(size / 1024).toFixed(1)} KiB)`);
}
console.log('release packaging complete.');

function readFileUtf8(path) {
  return readFileSync(path, 'utf8');
}

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
