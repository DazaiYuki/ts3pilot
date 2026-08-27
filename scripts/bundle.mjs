import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkgDir = join(root, 'apps', 'ts3-manager');
const out = join(pkgDir, 'dist', 'pkg', 'ts3pilot-linux-x64');
const pkgBin = join(pkgDir, 'node_modules', '.bin', process.platform === 'win32' ? 'pkg.cmd' : 'pkg');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Static (musl) targets have no host glibc/libstdc++ dependency, which is the
// only way to keep the binary runnable on RHEL8-likes (glibc 2.28) when the
// build host itself is much newer. pkg-fetch does not ship every combination,
// so we probe the common static targets and fail loudly if none is available —
// a dynamic build would silently break on glibc 2.28 systems.
const candidates = ['node18-linuxstatic-x64', 'node20-linuxstatic-x64', 'node22-linuxstatic-x64'];

execFileSync(npm, ['run', 'build'], { cwd: pkgDir, stdio: 'inherit', shell: process.platform === 'win32' });

for (const target of candidates) {
  try {
    console.log(`bundle: trying target ${target}`);
    rmSync(out, { force: true });
    execFileSync(pkgBin, ['.', '--targets', target, '--output', out], { cwd: pkgDir, stdio: 'inherit' });
    if (!existsSync(out)) throw new Error(`pkg did not produce ${out}`);
    console.log(`bundle: built with ${target}`);
    process.exit(0);
  } catch (error) {
    console.warn(`bundle: target ${target} failed: ${error instanceof Error ? error.message : 'unknown'}`);
  }
}

console.error('bundle: no static pkg target is available; refusing to ship a dynamic binary');
process.exit(1);
