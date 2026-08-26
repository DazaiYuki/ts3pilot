import { execFileSync } from 'node:child_process';
import process from 'node:process';

function probe(name, args) {
  try {
    const out = execFileSync(name, args, { encoding: 'utf8', timeout: 10000, windowsHide: true });
    return out.split(/\r?\n/)[0] || 'ok';
  } catch {
    return null;
  }
}

const report = {
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  npm: probe('npm', ['--version']),
  git: probe('git', ['--version']),
  php: probe('php', ['--version']),
  composer: probe('composer', ['--version']),
  docker: probe('docker', ['--version']),
  wsl: probe('wsl', ['--status']),
};

console.log(JSON.stringify(report, null, 2));
