import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createLogger } from '../src/logging/logger.ts';
import {
  buildDownloadUrl,
  DEFAULT_TS3_VERSION,
  EULA_MARKER,
  runInstall,
  TS3_FIREWALL_PORTS,
  type InstallerDependencies,
} from '../src/services/installer.ts';
import { cleanupDir, tempDir } from './util.ts';

type Call = { bin: string; args: string[] };

function makeDeps(overrides: Partial<InstallerDependencies> = {}, calls: Call[] = []): InstallerDependencies {
  return {
    platform: 'linux',
    mode: 'production',
    logger: createLogger('error', false),
    runProcess: async (bin, args) => {
      calls.push({ bin, args: [...args] });
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false, overflow: false };
    },
    download: async () => {},
    ...overrides,
  };
}

test('buildDownloadUrl composes the official URL and validates versions', async () => {
  assert.equal(
    buildDownloadUrl(DEFAULT_TS3_VERSION),
    'https://files.teamspeak-services.com/releases/server/3.13.7/teamspeak3-server_linux_amd64-3.13.7.tar.bz2',
  );
  assert.equal(buildDownloadUrl('3.12.1', 'linux', 'x86_64'), 'https://files.teamspeak-services.com/releases/server/3.12.1/teamspeak3-server_linux_x86_64-3.12.1.tar.bz2');
  await assert.rejects(() => runInstall({ version: 'latest', installPath: '/tmp/x', acceptEula: true }, makeDeps()), /Invalid TS3 version/);
  await assert.rejects(() => runInstall({ version: '1.2', installPath: '/tmp/x', acceptEula: true }, makeDeps()), /Invalid TS3 version/);
});

test('install requires explicit EULA acceptance', async () => {
  const calls: Call[] = [];
  await assert.rejects(
    () => runInstall({ version: '3.13.7', installPath: join(tempDir('eula'), 'ts3'), acceptEula: false }, makeDeps({}, calls)),
    /--accept-eula/,
  );
  assert.equal(calls.length, 0);
});

test('windows development install runs in mock mode and creates the EULA marker', async () => {
  const dir = tempDir('install-mock');
  try {
    const installPath = join(dir, 'ts3');
    const calls: Call[] = [];
    const result = await runInstall(
      { version: '3.13.7', installPath, acceptEula: true, setupFirewall: true },
      makeDeps({ platform: 'win32', mode: 'development' }, calls),
    );
    assert.equal(result.mocked, true);
    assert.equal(existsSync(join(installPath, EULA_MARKER)), true);
    assert.equal(calls.length, 0);
    assert.equal(result.firewall.tool, 'none');
    assert.ok((result.systemdUnit ?? '').includes('NoNewPrivileges=true'));
  } finally {
    cleanupDir(dir);
  }
});

test('linux development mode also uses the mock path', async () => {
  const dir = tempDir('install-mock2');
  try {
    const calls: Call[] = [];
    const result = await runInstall(
      { version: '3.13.7', installPath: join(dir, 'ts3'), acceptEula: true },
      makeDeps({ mode: 'development' }, calls),
    );
    assert.equal(result.mocked, true);
    assert.equal(calls.some((call) => call.bin === 'tar'), false);
  } finally {
    cleanupDir(dir);
  }
});

test('production install orchestrates download, tar, EULA marker, firewall and systemd', async () => {
  const dir = tempDir('install-real');
  try {
    const installPath = join(dir, 'ts3');
    const calls: Call[] = [];
    let downloadedUrl = '';
    const deps = makeDeps({}, calls);
    deps.download = async (url, dest) => {
      downloadedUrl = url;
      writeFileSync(dest, 'fake-archive');
    };
    deps.runProcess = async (bin, args) => {
      calls.push({ bin, args: [...args] });
      if (bin === 'tar') {
        const cIdx = args.indexOf('-C');
        const staging = args[cIdx + 1] as string;
        mkdirSync(staging, { recursive: true });
        writeFileSync(join(staging, 'ts3server_startscript.sh'), '#!/bin/sh');
        writeFileSync(join(staging, 'ts3server.sqlitedb'), 'db-bytes');
      }
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false, overflow: false };
    };

    const result = await runInstall(
      { version: '3.13.7', installPath, acceptEula: true, setupFirewall: true, user: 'ts3', group: 'ts3' },
      deps,
    );
    assert.equal(result.mocked, false);
    assert.equal(downloadedUrl, buildDownloadUrl('3.13.7'));
    assert.equal(existsSync(join(installPath, 'ts3server_startscript.sh')), true);
    assert.equal(existsSync(join(installPath, EULA_MARKER)), true);
    assert.equal(result.firewall.tool, 'ufw');
    assert.ok(result.firewall.opened.includes('9987/udp'));
    assert.ok(result.firewall.opened.includes('10443/tcp'));
    for (const port of TS3_FIREWALL_PORTS) {
      assert.ok(calls.some((call) => call.bin === 'ufw' && call.args[0] === 'allow' && call.args[1] === `${port.port}/${port.proto}`));
    }
    assert.ok((result.systemdUnit ?? '').includes('Description=TeamSpeak 3 Server'));
    assert.equal(readFileSync(join(installPath, EULA_MARKER), 'utf8').includes('accepted_at='), true);
  } finally {
    cleanupDir(dir);
  }
});

test('firewalld is used when ufw is unavailable', async () => {
  const dir = tempDir('install-fw');
  try {
    const calls: Call[] = [];
    const deps = makeDeps({}, calls);
    deps.runProcess = async (bin, args) => {
      calls.push({ bin, args: [...args] });
      if (bin === 'ufw') return { exitCode: 1, stdout: '', stderr: 'not found', timedOut: false, overflow: false };
      if (bin === 'firewall-cmd' && args[0] === '--state') return { exitCode: 0, stdout: 'running', stderr: '', timedOut: false, overflow: false };
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false, overflow: false };
    };
    const result = await runInstall(
      { version: '3.13.7', installPath: join(dir, 'ts3'), acceptEula: true, setupFirewall: true },
      deps,
    );
    assert.equal(result.firewall.tool, 'firewalld');
    assert.ok(result.firewall.opened.includes('30033/tcp'));
    assert.ok(calls.some((call) => call.bin === 'firewall-cmd' && call.args.includes('--reload')));
  } finally {
    cleanupDir(dir);
  }
});

test('source-url override and checksum verification', async () => {
  const dir = tempDir('install-source');
  try {
    const installPath = join(dir, 'ts3');
    const calls: Call[] = [];
    const deps = makeDeps({}, calls);
    deps.download = async (_url, dest) => writeFileSync(dest, 'data');
    deps.runProcess = async (bin, args) => {
      calls.push({ bin, args: [...args] });
      if (bin === 'tar') {
        const cIdx = args.indexOf('-C');
        const staging = args[cIdx + 1] as string;
        mkdirSync(staging, { recursive: true });
        writeFileSync(join(staging, 'ts3server.ini'), 'query_port=10011');
      }
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false, overflow: false };
    };
    const result = await runInstall(
      {
        version: '3.13.7',
        installPath,
        acceptEula: true,
        sourceUrl: 'https://mirror.example.test/ts3.tar.bz2',
        expectedSha256: '3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7',
      },
      deps,
    );
    assert.equal(result.downloadUrl, 'https://mirror.example.test/ts3.tar.bz2');
    assert.equal(existsSync(join(installPath, 'ts3server.ini')), true);

    await assert.rejects(
      () =>
        runInstall(
          {
            version: '3.13.7',
            installPath: join(dir, 'ts3-bad'),
            acceptEula: true,
            expectedSha256: '0'.repeat(64),
          },
          deps,
        ),
      /Checksum mismatch/,
    );
  } finally {
    cleanupDir(dir);
  }
});

test('install refuses a non-empty target without force', async () => {
  const dir = tempDir('install-force');
  try {
    const installPath = join(dir, 'ts3');
    mkdirSync(installPath, { recursive: true });
    writeFileSync(join(installPath, 'existing.txt'), 'x');
    await assert.rejects(
      () => runInstall({ version: '3.13.7', installPath, acceptEula: true }, makeDeps()),
      /not empty/,
    );
  } finally {
    cleanupDir(dir);
  }
});
