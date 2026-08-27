import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { defaultConfig } from '../src/domain/schemas.ts';
import { analyzeExistingInstall } from '../src/services/adoptAnalyzer.ts';
import { cleanupDir, tempDir } from './util.ts';

test('adopt analyzer detects structure, parses ini and suggests minimal changes without writing', async () => {
  const dir = tempDir('adopt');
  try {
    const install = join(dir, 'ts3');
    mkdirSync(join(install, 'files'), { recursive: true });
    mkdirSync(join(install, 'logs'), { recursive: true });
    writeFileSync(join(install, 'ts3server_startscript.sh'), '#!/bin/sh');
    writeFileSync(join(install, 'ts3server.sqlitedb'), 'SQLite format 3\u0000data');
    writeFileSync(
      join(install, 'ts3server.ini'),
      ['query_port=10011', 'query_ip_whitelist=0.0.0.0', 'filetransfer_port=30033'].join('\n'),
    );
    const before = readdirSync(install).sort();

    const config = defaultConfig();
    config.ts3.installPath = install;
    const analysis = await analyzeExistingInstall({
      config,
      fileExists: (p) => {
        return existsSync(p);
      },
      readFile: (p) => {
        try {
          return readFileSync(p, 'utf8');
        } catch {
          return undefined;
        }
      },
      probePort: async () => true,
    });

    assert.ok(analysis.found.includes('ts3server.sqlitedb'));
    assert.ok(analysis.found.includes('files'));
    assert.ok(analysis.optionalFound.includes('ts3server.ini'));
    assert.ok(!analysis.missing.includes('ts3server.ini'));
    assert.ok(!analysis.missing.includes('licensekey.dat'));
    assert.equal(analysis.ini.query_ip_whitelist, '0.0.0.0');
    assert.ok(analysis.findings.some((finding) => finding.message.includes('query_ip_whitelist')));
    assert.ok(analysis.recommendations.some((recommendation) => recommendation.includes('ts3-manager backup')));
    assert.equal(analysis.ports.length, 4);
    assert.ok(['native', 'docker', 'remote', 'unknown'].includes(analysis.deployment.mode));

    const after = readdirSync(install).sort();
    assert.deepEqual(after, before);
  } finally {
    cleanupDir(dir);
  }
});

test('adopt reports docker findings when a container is detected', async () => {
  const dir = tempDir('adopt-docker');
  try {
    const install = join(dir, 'ts3');
    mkdirSync(install, { recursive: true });
    const config = defaultConfig();
    config.ts3.installPath = install;
    const analysis = await analyzeExistingInstall({
      config,
      fileExists: (p) => existsSync(p),
      readFile: () => undefined,
      probePort: async () => true,
      runCommand: async () => ({
        exitCode: 0,
        stdout: 'abc123\tteamspeak-01\tteamspeak:latest\t0.0.0.0:9987->9987/udp\n',
        stderr: '',
      }),
    });
    assert.equal(analysis.deployment.mode, 'docker');
    assert.ok(analysis.findings.some((finding) => finding.message.includes('Docker')));
    assert.ok(analysis.recommendations.some((recommendation) => recommendation.includes('数据卷路径')));
  } finally {
    cleanupDir(dir);
  }
});

test('adopt reports remote findings for a non-loopback query host', async () => {
  const config = defaultConfig();
  config.ts3.installPath = '/srv/ts3';
  config.ts3.query.host = '10.0.0.8';
  const analysis = await analyzeExistingInstall({
    config,
    fileExists: () => true,
    readFile: () => undefined,
    probePort: async () => true,
  });
  assert.equal(analysis.deployment.mode, 'remote');
  assert.ok(analysis.findings.some((finding) => finding.message.includes('远程主机')));
});
