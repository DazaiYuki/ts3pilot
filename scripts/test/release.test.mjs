import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { installUpdateArchive } from '../../apps/ts3-manager/src/cli/commands/update.ts';

const root = resolve(new URL('../..', import.meta.url).pathname);
const version = JSON.parse(readFileSync(join(root, 'package.json'))).version;
const release = join(root, 'dist/release');

test('release archives have valid formats, checksums, executable modes and plugin layout', () => {
  for (const name of [`ts3pilot-linux-x64-v${version}.tar.gz`, `ts3-manager-npm-v${version}.tgz`, `ts3pilot-wp-v${version}.zip`]) {
    const path = join(release, name);
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), readFileSync(`${path}.sha256`, 'utf8').split(' ')[0]);
  }
  const dir = mkdtempSync(join(tmpdir(), 'ts3pilot-release-'));
  try {
    execFileSync('tar', ['-xzf', join(release, `ts3pilot-linux-x64-v${version}.tar.gz`), '--same-permissions', '-C', dir]);
    assert.equal(statSync(join(dir, 'ts3pilot')).mode & 0o777, 0o755);
    assert.match(execFileSync(join(dir, 'ts3pilot'), ['version'], { encoding: 'utf8' }), new RegExp(`^ts3pilot ${version.replaceAll('.', '\\.')}`));
    execFileSync('unzip', ['-t', join(release, `ts3pilot-wp-v${version}.zip`)]);
    const entries = execFileSync('unzip', ['-Z1', join(release, `ts3pilot-wp-v${version}.zip`)], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(entries.includes('ts3pilot-wp/ts3pilot-wp.php'));
    assert.ok(entries.every(name => name.startsWith('ts3pilot-wp/') && !name.includes('/vendor/') && !name.includes('/tests/')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the actual release installs through the verified self-update pipeline', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ts3pilot-upgrade-'));
  const archive = join(release, `ts3pilot-linux-x64-v${version}.tar.gz`);
  const digest = readFileSync(`${archive}.sha256`, 'utf8').split(' ')[0];
  const target = join(dir, 'ts3pilot');
  try {
    await installUpdateArchive(archive, target, digest, version);
    assert.match(execFileSync(target, ['version'], { encoding: 'utf8' }), /^ts3pilot /);
    await assert.rejects(installUpdateArchive(archive, target, '0'.repeat(64), version), /checksum mismatch/);
    await assert.rejects(installUpdateArchive(archive, target, digest, '999.0.0'), /version verification/);
    assert.match(execFileSync(target, ['version'], { encoding: 'utf8' }), new RegExp(`^ts3pilot ${version.replaceAll('.', '\\.')}`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
