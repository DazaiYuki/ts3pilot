import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAgentUnit, generateServerUnit, validateUnitName } from '../src/system/systemdGenerator.ts';

test('server unit includes hardening directives and correct paths', () => {
  const unit = generateServerUnit({ user: 'ts3', group: 'ts3', installPath: '/srv/ts3' });
  assert.match(unit, /NoNewPrivileges=true/);
  assert.match(unit, /ProtectSystem=strict/);
  assert.match(unit, /PrivateTmp=true/);
  assert.match(unit, /ProtectHome=read-only/);
  assert.match(unit, /MemoryDenyWriteExecute=true/);
  assert.match(unit, /User=ts3/);
  assert.match(unit, /WorkingDirectory=\/srv\/ts3/);
  assert.match(unit, /ReadWritePaths=\/srv\/ts3/);
  assert.match(unit, /Type=forking/);
});

test('agent unit includes environment and hardening', () => {
  const unit = generateAgentUnit({
    user: 'ts3agent',
    group: 'ts3agent',
    execStart: '/usr/bin/node /opt/ts3-ops/dist/cli/index.js agent',
    configPath: '/etc/ts3-ops/config.json',
    installPath: '/srv/ts3',
  });
  assert.match(unit, /NoNewPrivileges=true/);
  assert.match(unit, /ProtectSystem=strict/);
  assert.doesNotMatch(unit, /^MemoryDenyWriteExecute=true/m);
  assert.match(unit, /JIT/);
  assert.match(unit, /Environment=TS3_MANAGER_CONFIG=\/etc\/ts3-ops\/config.json/);
  assert.match(unit, /User=ts3agent/);
});

test('unit name validation', () => {
  assert.equal(validateUnitName('ts3server.service'), true);
  assert.equal(validateUnitName('ts3-agent.service'), true);
  assert.equal(validateUnitName('../evil'), false);
  assert.equal(validateUnitName('has space'), false);
});
