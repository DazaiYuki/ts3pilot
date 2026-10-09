import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const binary = resolve(root, 'apps/ts3-manager/dist/pkg/ts3pilot-linux-x64');
if (!existsSync(binary)) throw new Error('Build the release before running compatibility checks');
const images = process.argv.slice(2);
if (!images.length) images.push('ubuntu:22.04', 'ubuntu:24.04', 'ubuntu:26.04', 'debian:12-slim', 'debian:13-slim', 'rockylinux:8', 'rockylinux:9', 'quay.io/rockylinux/rockylinux:10', 'fedora:43', 'fedora:44', 'opensuse/leap:16.0', 'alpine:3.21', 'alpine:3.22', 'alpine:3.23', 'alpine:3.24', 'archlinux:base', 'opensuse/tumbleweed:latest');
const version = JSON.parse(readFileSync(resolve(root, 'package.json'))).version;
const results = [];
for (const image of images) {
  try {
    execFileSync('docker', ['pull', '--platform=linux/amd64', image], { stdio: 'pipe', timeout: 300000 });
    const output = execFileSync('docker', ['run', '--rm', '--user=65534:65534', '--platform=linux/amd64', '--network=none', '-v', `${binary}:/ts3pilot:ro`, '--entrypoint', '/bin/sh', image, '-ec', `
/ts3pilot version
/ts3pilot config init --config /tmp/ts3pilot/config.json
/ts3pilot config validate --config /tmp/ts3pilot/config.json
/ts3pilot config set agent.enabled true --config /tmp/ts3pilot/config.json
/ts3pilot agent --config /tmp/ts3pilot/config.json >/tmp/agent.log 2>&1 &
agent_pid=$!
trap 'kill "$agent_pid" 2>/dev/null || true' EXIT
sleep 1
kill -0 "$agent_pid"
/ts3pilot doctor --config /tmp/ts3pilot/config.json > /tmp/doctor.log 2>&1 || true
grep -E '^OK +agent health:' /tmp/doctor.log
kill "$agent_pid"
wait "$agent_pid"
trap - EXIT
`], { encoding: 'utf8', timeout: 45000 });
    if (!output.includes(`ts3pilot ${version}`)) throw new Error('Version did not match');
    const digest = execFileSync('docker', ['image', 'inspect', image, '--format', '{{index .RepoDigests 0}}'], { encoding: 'utf8' }).trim();
    results.push({ image, digest, passed: true });
    console.log(`PASS ${image}: binary, config, Agent, doctor health and shutdown`);
  } catch (error) {
    const detail = error.stderr?.toString().slice(-1200) || error.message;
    results.push({ image, passed: false, detail });
    console.error(`FAIL ${image}: ${detail}`);
  }
}
writeFileSync(resolve(root, 'dist/release/compatibility-results.json'), JSON.stringify({ version, testedAt: new Date().toISOString(), results }, null, 2) + '\n');
if (results.some(result => !result.passed)) process.exitCode = 1;
