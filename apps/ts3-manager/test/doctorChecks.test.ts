import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { defaultConfig } from '../src/domain/schemas.ts';
import { runDoctorChecks, type DoctorDependencies } from '../src/services/doctorChecks.ts';
import { cleanupDir, tempDir } from './util.ts';

function makeDeps(overrides: Partial<DoctorDependencies>): DoctorDependencies {
  const config = defaultConfig();
  const base: DoctorDependencies = {
    platform: 'win32',
    nodeVersion: 'v24.0.0',
    configPath: '/tmp/config.json',
    configFileExists: true,
    config,
    fileExists: () => false,
    fileReadable: () => false,
    fileSize: () => undefined,
    readFile: () => undefined,
    probePort: async () => true,
    agentHealth: async () => 'ok',
    serverQueryAuth: async () => undefined,
    providerAvailable: async () => true,
  };
  return { ...base, ...overrides };
}

test('doctor detects a valid sqlite header and missing database', async () => {
  const dir = tempDir('doctor');
  try {
    const install = join(dir, 'ts3');
    mkdirSync(install, { recursive: true });
    writeFileSync(join(install, 'ts3server.sqlitedb'), 'SQLite format 3\u0000binary-data');
    writeFileSync(join(install, 'ts3server.ini'), 'query_port=10011\n');
    mkdirSync(join(install, 'logs'), { recursive: true });
    writeFileSync(join(install, 'logs', 'x.log'), 'log');

    const config = defaultConfig();
    config.ts3.installPath = install;
    const checks = await runDoctorChecks(
      makeDeps({
        config,
        fileExists: (p) => fsExists(p),
        fileReadable: () => true,
        fileSize: (p) => fsSize(p),
        readFile: (p) => fsRead(p),
      }),
    );
    const sqlite = checks.find((check) => check.name === 'ts3 sqlite database');
    assert.equal(sqlite?.severity, 'ok');
    assert.ok((sqlite?.detail ?? '').includes('valid header'));
    const ini = checks.find((check) => check.name === 'ts3server.ini');
    assert.equal(ini?.severity, 'ok');

    const missingConfig = defaultConfig();
    missingConfig.ts3.installPath = join(dir, 'does-not-exist');
    const missingChecks = await runDoctorChecks(makeDeps({ config: missingConfig, fileExists: (p) => p === missingConfig.ts3.installPath, fileReadable: () => true }));
    const missingSqlite = missingChecks.find((check) => check.name === 'ts3 sqlite database');
    assert.equal(missingSqlite?.severity, 'fail');
  } finally {
    cleanupDir(dir);
  }
});

test('doctor flags closed ports and unverified query auth', async () => {
  const checks = await runDoctorChecks(
    makeDeps({
      probePort: async () => false,
      serverQueryAuth: async () => undefined,
    }),
  );
  const voice = checks.find((check) => check.name === 'voice port');
  assert.equal(voice?.severity, 'warn');
  const auth = checks.find((check) => check.name === 'serverquery auth');
  assert.equal(auth?.severity, 'warn');

  const failed = await runDoctorChecks(
    makeDeps({
      probePort: async () => true,
      serverQueryAuth: async () => false,
    }),
  );
  const authFailed = failed.find((check) => check.name === 'serverquery auth');
  assert.equal(authFailed?.severity, 'fail');
});

test('doctor warns on old node version', async () => {
  const checks = await runDoctorChecks(makeDeps({ nodeVersion: 'v20.0.0' }));
  const node = checks.find((check) => check.name === 'node version');
  assert.equal(node?.severity, 'warn');
});

function fsExists(path: string): boolean {
  return existsSync(path);
}

function fsSize(path: string): number | undefined {
  try {
    return statSync(path).size;
  } catch {
    return undefined;
  }
}

function fsRead(path: string): string | undefined {
  try {
    return readFileSync(path, 'latin1');
  } catch {
    return undefined;
  }
}
