import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCUMENTED_ENDPOINTS, ROUTES } from '../src/agent/routeTable.ts';

test('route table matches the documented API surface', () => {
  assert.deepEqual(
    DOCUMENTED_ENDPOINTS,
    [
      'GET /v1/health',
      'GET /v1/info',
      'GET /v1/ts3/status',
      'GET /v1/ts3/clients',
      'GET /v1/ts3/channels',
      'POST /v1/ts3/clients/kick',
      'POST /v1/ts3/clients/ban',
      'POST /v1/ts3/clients/move',
      'POST /v1/ts3/clients/poke',
      'POST /v1/system/start',
      'POST /v1/system/stop',
      'POST /v1/system/restart',
      'GET /v1/system/status',
      'POST /v1/maintenance/update',
      'POST /v1/maintenance/backup',
      'POST /v1/maintenance/restore',
      'POST /v1/agent/pair',
      'POST /v1/agent/rotate-secret',
      'POST /v1/agent/unpair',
      'POST /v1/agent/disable',
    ],
  );
});

test('every hmac route declares a capability except info', () => {
  for (const route of ROUTES) {
    if (route.auth === 'hmac' && route.path !== '/v1/info') {
      assert.ok(route.capability, `missing capability for ${route.method} ${route.path}`);
    }
  }
});
