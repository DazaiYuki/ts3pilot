import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEnvOverrides, defaultConfig, validateConfig } from '../src/domain/schemas.ts';

test('default config validates', () => {
  const config = defaultConfig();
  const validated = validateConfig(JSON.parse(JSON.stringify(config)) as unknown);
  assert.equal(validated.mode, 'development');
  assert.equal(validated.agent.port, 17880);
  assert.equal(validated.agent.host, '127.0.0.1');
  assert.equal(validated.agent.capabilities.includes('server.update'), false);
  assert.equal(validated.agent.capabilities.includes('ts3.clients.kick'), true);
});

test('validateConfig rejects unknown capabilities', () => {
  const config = defaultConfig();
  config.agent.capabilities = ['not-a-capability'];
  assert.throws(() => validateConfig(JSON.parse(JSON.stringify(config)) as unknown));
});

test('applyEnvOverrides applies mode and agent host/port', () => {
  const previousMode = process.env.TS3_MANAGER_MODE;
  const previousHost = process.env.TS3_MANAGER_AGENT_HOST;
  const previousPort = process.env.TS3_MANAGER_AGENT_PORT;
  try {
    process.env.TS3_MANAGER_MODE = 'production';
    process.env.TS3_MANAGER_AGENT_HOST = '127.0.0.1';
    process.env.TS3_MANAGER_AGENT_PORT = '18080';
    const config = applyEnvOverrides(defaultConfig());
    assert.equal(config.mode, 'production');
    assert.equal(config.agent.host, '127.0.0.1');
    assert.equal(config.agent.port, 18080);
  } finally {
    restoreEnv('TS3_MANAGER_MODE', previousMode);
    restoreEnv('TS3_MANAGER_AGENT_HOST', previousHost);
    restoreEnv('TS3_MANAGER_AGENT_PORT', previousPort);
  }
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
