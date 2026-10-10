import assert from 'node:assert/strict';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { defaultConfig } from '../src/domain/schemas.ts';
import { createLogger } from '../src/logging/logger.ts';
import { createServiceManager } from '../src/system/factory.ts';
import { ScriptServiceManager } from '../src/system/providers/script.ts';
import { cleanupDir, tempDir } from './util.ts';

test('standalone script adoption controls service from its installation directory and reports stopped exit zero', { skip: process.platform !== 'linux' }, async () => {
  const dir = tempDir('standalone-script');
  try {
    const cfg = defaultConfig(); cfg.ts3.installPath = dir; cfg.mode = 'production';
    const script = join(dir, cfg.ts3.startScript);
    writeFileSync(script, `#!/bin/sh\n[ "$PWD" = '${dir}' ] || exit 9\ncase "$1" in\nstart|restart) touch running ;;\nstop) rm -f running ;;\nstatus) if [ -f running ]; then echo 'Server is running with PID: 123'; else echo 'Server is not running'; fi ;;\nesac\n`);
    chmodSync(script, 0o755);
    const manager = createServiceManager(cfg, createLogger('error', false));
    assert.equal(manager.providerName, 'script');
    assert.equal(await manager.isAvailable(), true);
    assert.equal((await manager.status()).state, 'stopped');
    assert.equal((await manager.start()).state, 'running');
    assert.equal((await manager.status()).pid, 123);
    assert.equal((await manager.restart()).state, 'running');
    assert.equal((await manager.stop()).state, 'stopped');
    cfg.system.provider = 'systemd';
    assert.equal(createServiceManager(cfg, createLogger('error', false)).providerName, 'systemd');
    cfg.system.provider = 'auto'; cfg.ts3.deployment.kind = 'remote';
    assert.notEqual(createServiceManager(cfg, createLogger('error', false)).providerName, 'script');
    cfg.ts3.installPath = join(dir, 'missing');
    assert.equal(await new ScriptServiceManager(cfg).isAvailable(), false);
  } finally { cleanupDir(dir); }
});
