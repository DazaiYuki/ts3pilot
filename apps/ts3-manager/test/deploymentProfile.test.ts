import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { defaultConfig } from '../src/domain/schemas.ts';
import { detectDeployment, findTs3Container, isLoopbackHost, type DeploymentDependencies } from '../src/services/deploymentProfile.ts';
import { cleanupDir, tempDir } from './util.ts';

function makeDeps(overrides: Partial<DeploymentDependencies>): DeploymentDependencies {
  return {
    config: defaultConfig(),
    platform: 'linux',
    fileExists: (path) => existsSync(path),
    runCommand: async () => ({ exitCode: 127, stdout: '', stderr: 'docker: not found' }),
    ...overrides,
  };
}

test('native install is detected from the ts3server binary', async () => {
  const dir = tempDir('deploy-native');
  try {
    const install = join(dir, 'ts3');
    mkdirSync(install, { recursive: true });
    const config = defaultConfig();
    config.ts3.installPath = install;
    // no binary yet -> unknown
    let profile = await detectDeployment(makeDeps({ config }));
    assert.equal(profile.mode, 'unknown');
    // with binary -> native
    mkdirSync(join(install, 'ts3server'), { recursive: true });
    profile = await detectDeployment(makeDeps({ config }));
    assert.equal(profile.mode, 'native');
    assert.equal(profile.capabilities.filesystem, true);
    assert.equal(profile.capabilities.install, true);
  } finally {
    cleanupDir(dir);
  }
});

test('remote mode is detected from a non-loopback query host', async () => {
  const config = defaultConfig();
  config.ts3.query.host = '203.0.113.10';
  const profile = await detectDeployment(makeDeps({ config }));
  assert.equal(profile.mode, 'remote');
  assert.equal(profile.capabilities.serverQuery, true);
  assert.equal(profile.capabilities.filesystem, false);
  assert.equal(profile.capabilities.install, false);
});

test('docker mode is detected from docker ps output', async () => {
  const config = defaultConfig();
  const profile = await detectDeployment(
    makeDeps({
      config,
      runCommand: async (command) => {
        assert.equal(command, 'docker');
        return {
          exitCode: 0,
          stdout: 'abc123\tteamspeak-01\tteamspeak:latest\t0.0.0.0:9987->9987/udp, 0.0.0.0:10011->10011/tcp\n',
          stderr: '',
        };
      },
    }),
  );
  assert.equal(profile.mode, 'docker');
  assert.equal(profile.dockerContainer, 'teamspeak-01');
  assert.equal(profile.capabilities.serverQuery, true);
  assert.equal(profile.capabilities.filesystem, false);
});

test('explicit deployment kind overrides auto detection', async () => {
  const config = defaultConfig();
  config.ts3.deployment.kind = 'docker';
  config.ts3.deployment.dockerContainer = 'my-ts3';
  const profile = await detectDeployment(makeDeps({ config }));
  assert.equal(profile.mode, 'docker');
  assert.equal(profile.dockerContainer, 'my-ts3');
});

test('findTs3Container matches image name or ports', () => {
  const output = [
    'id1\tweb\tnginx\t0.0.0.0:80->80/tcp',
    'id2\tvoice\tteamspeak:3.13.7\t0.0.0.0:9987->9987/udp',
  ].join('\n');
  assert.equal(findTs3Container(output), 'voice');
  assert.equal(findTs3Container('id1\tweb\tnginx\t0.0.0.0:80->80/tcp\n'), undefined);
  assert.equal(findTs3Container(''), undefined);
});

test('isLoopbackHost recognises local addresses', () => {
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('::1'), true);
  assert.equal(isLoopbackHost('192.168.1.10'), false);
});
