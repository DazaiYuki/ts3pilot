import { chmodSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkgDir = join(root, 'apps', 'ts3-manager');
const binary = join(pkgDir, 'dist', 'pkg', 'ts3pilot-linux-x64');

if (!existsSync(binary)) {
  console.error('npm-prepack: Linux binary not found; run `npm run bundle` first');
  process.exit(1);
}

// Stage the standalone Linux binary at the package root so `bin` can point at
// it directly and the one-line installer can find a file literally named
// `ts3pilot` inside an npm tarball (layout: package/ts3pilot).
const staged = join(pkgDir, 'ts3pilot');
copyFileSync(binary, staged);
chmodSync(staged, 0o755);

const extras = [
  [join(root, 'LICENSE'), join(pkgDir, 'LICENSE')],
  [join(root, 'docs', 'notice.md'), join(pkgDir, 'NOTICE.md')],
];
for (const [source, dest] of extras) {
  if (existsSync(source)) {
    copyFileSync(source, dest);
  }
}

console.log('npm-prepack: staged Linux binary and package docs');
