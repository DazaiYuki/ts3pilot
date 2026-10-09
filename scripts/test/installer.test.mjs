import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(new URL('../..', import.meta.url).pathname);
const version = JSON.parse(readFileSync(join(root, 'package.json'))).version;

test('the shell installer preserves config, replaces a running binary and rejects a corrupt download', () => {
  const fixtures = mkdtempSync(join(root, 'tmp', 'installer-fixture-'));
  try {
    writeFileSync(join(fixtures, 'curl'), `#!/bin/sh
url=''; out=''
while [ "$#" -gt 0 ]; do
 case "$1" in -o) out="$2"; shift 2 ;; https:*) url="$1"; shift ;; *) shift ;; esac
done
case "$url" in
 *.sha256) cat /artifacts/ts3pilot-linux-x64-v${version}.tar.gz.sha256 ;;
 *.tar.gz) if [ -e /bad-download ]; then printf bad > "$out"; else cp /artifacts/ts3pilot-linux-x64-v${version}.tar.gz "$out"; fi ;;
 *) exit 22 ;;
esac
`, { mode: 0o755 });
    const output = execFileSync('docker', ['run', '--rm', '--network=none', '-v', `${root}/scripts/install.sh:/install.sh:ro`, '-v', `${root}/dist/release:/artifacts:ro`, '-v', `${fixtures}:/fixtures:ro`, '-e', `TS3PILOT_VERSION=${version}`, '-e', 'TS3PILOT_PREFIX=/opt/ts3pilot', '-e', 'TS3PILOT_BIN=/usr/local/bin/ts3pilot', '-e', 'PATH=/fixtures:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'ubuntu:24.04', '/bin/bash', '-ec', `
bash /install.sh
mkdir -p /opt/ts3pilot/user-data
printf preserved > /opt/ts3pilot/user-data/config
/usr/local/bin/ts3pilot config init --config /tmp/state/config.json
chown 65534:65534 /tmp/state/config.json
/usr/local/bin/ts3pilot config set agent.enabled true --config /tmp/state/config.json
[ "$(stat -c %u /tmp/state/config.json)" = 65534 ]
/usr/local/bin/ts3pilot agent --config /tmp/state/config.json >/tmp/agent.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
sleep 1
bash /install.sh
kill -0 "$pid"
[ "$(cat /opt/ts3pilot/user-data/config)" = preserved ]
sha256sum /opt/ts3pilot/ts3pilot > /tmp/before
: > /bad-download
if bash /install.sh; then exit 1; fi
sha256sum -c /tmp/before
/usr/local/bin/ts3pilot version
kill "$pid"
wait "$pid"
trap - EXIT
`], { stdio: 'pipe', timeout: 90000 });
    assert.ok(output.toString().includes(`ts3pilot ${version}`));
  } finally { rmSync(fixtures, { recursive: true, force: true }); }
});
