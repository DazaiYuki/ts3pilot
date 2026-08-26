import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkgDir = join(root, 'apps', 'ts3-manager');
const out = join(root, 'dist', 'ts3-manager-pkg');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'src'), { recursive: true });

for (const entry of readdirSync(join(pkgDir, 'src'))) {
  cpSync(join(pkgDir, 'src', entry), join(out, 'src', entry), { recursive: true });
}
for (const f of ['package.json', 'README.md', 'tsconfig.json', 'tsconfig.build.json']) {
  const src = join(pkgDir, f);
  if (statSync(src, { throwIfNoEntry: false })) cpSync(src, join(out, f));
}
writeFileSync(join(out, 'RUNNING.md'), [
  '# ts3-manager package',
  '',
  'Run with Node.js >= 24 (native TypeScript type-stripping):',
  '  node src/cli/index.ts --help',
  '',
  'This staging package contains no compiled output; build with `npm run build` when a TypeScript toolchain is available.',
  '',
].join('\n'));

console.log(`Packaged source tree to ${out}`);
