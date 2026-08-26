import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const run = (cmd, args, opts = {}) => {
  console.log(`\n==> ${cmd} ${args.join(' ')}`);
  try {
    execFileSync(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      shell: process.platform === 'win32',
      ...opts,
    });
    return true;
  } catch {
    return false;
  }
};

const steps = [];
steps.push(['node --check', () => run(process.execPath, ['--check', 'scripts/verify.mjs'], { shell: false })]);
steps.push(['lint', () => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'lint'])]);
steps.push(['typecheck', () => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'typecheck'])]);
steps.push(['test', () => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'])]);
steps.push(['build', () => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'])]);
steps.push(['php lint', () => run('php', ['plugins/ts3pilot-wp/tests/lint-all.php'])]);
steps.push([
  'phpcs',
  () =>
    run('php', ['vendor/bin/phpcs', '--standard=phpcs.xml.dist', 'src', 'tests', 'ts3pilot-wp.php', 'uninstall.php'], {
      cwd: join(root, 'plugins', 'ts3pilot-wp'),
    }),
]);

let ok = true;
for (const [name, fn] of steps) {
  if (!fn()) {
    ok = false;
    console.error(`\nFAILED: ${name}`);
  }
}

if (ok) console.log('\nverify: ALL GREEN');
else process.exit(1);
