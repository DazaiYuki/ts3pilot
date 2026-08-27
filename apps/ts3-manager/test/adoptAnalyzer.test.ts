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

    const after = readdirSync(install).sort();
    assert.deepEqual(after, before);
  } finally {
    cleanupDir(dir);
  }
});
