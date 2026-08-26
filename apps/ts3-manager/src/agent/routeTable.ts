import { Capability } from '../domain/capabilities.ts';
import type { HandlerResult } from './handlers.ts';
import {
  banHandler,
  channelCreateHandler,
  channelDeleteHandler,
  channelEditHandler,
  channelMoveHandler,
  channelsHandler,
  clientsHandler,
  disableHandler,
  healthHandler,
  infoHandler,
  kickHandler,
  maintenanceHandler,
  moveHandler,
  pairHandler,
  pokeHandler,
  rotateSecretHandler,
  serverStatusHandler,
  systemActionHandler,
  unpairHandler,
} from './handlers.ts';
import type { HandlerContext } from './handlers.ts';

export type AuthMode = 'public' | 'hmac' | 'pairing';

export interface RouteSpec {
  method: 'GET' | 'POST';
  path: string;
  auth: AuthMode;
  capability?: string;
  action?: 'start' | 'stop' | 'restart' | 'status';
  handler: (ctx: HandlerContext) => Promise<HandlerResult> | HandlerResult;
}

export const ROUTES: readonly RouteSpec[] = [
  { method: 'GET', path: '/v1/health', auth: 'public', handler: healthHandler },
  { method: 'GET', path: '/v1/info', auth: 'hmac', handler: infoHandler },
  { method: 'GET', path: '/v1/ts3/status', auth: 'hmac', capability: Capability.TS3_STATUS, handler: serverStatusHandler },
  { method: 'GET', path: '/v1/ts3/clients', auth: 'hmac', capability: Capability.TS3_CLIENTS_LIST, handler: clientsHandler },
  { method: 'GET', path: '/v1/ts3/channels', auth: 'hmac', capability: Capability.TS3_CHANNELS_LIST, handler: channelsHandler },
  { method: 'POST', path: '/v1/ts3/channels/create', auth: 'hmac', capability: Capability.TS3_CHANNELS_CREATE, handler: channelCreateHandler },
  { method: 'POST', path: '/v1/ts3/channels/edit', auth: 'hmac', capability: Capability.TS3_CHANNELS_EDIT, handler: channelEditHandler },
  { method: 'POST', path: '/v1/ts3/channels/delete', auth: 'hmac', capability: Capability.TS3_CHANNELS_DELETE, handler: channelDeleteHandler },
  { method: 'POST', path: '/v1/ts3/channels/move', auth: 'hmac', capability: Capability.TS3_CHANNELS_MOVE, handler: channelMoveHandler },
  { method: 'POST', path: '/v1/ts3/clients/kick', auth: 'hmac', capability: Capability.TS3_CLIENTS_KICK, handler: kickHandler },
  { method: 'POST', path: '/v1/ts3/clients/ban', auth: 'hmac', capability: Capability.TS3_CLIENTS_BAN, handler: banHandler },
  { method: 'POST', path: '/v1/ts3/clients/move', auth: 'hmac', capability: Capability.TS3_CLIENTS_MOVE, handler: moveHandler },
  { method: 'POST', path: '/v1/ts3/clients/poke', auth: 'hmac', capability: Capability.TS3_CLIENTS_POKE, handler: pokeHandler },
  { method: 'POST', path: '/v1/system/start', auth: 'hmac', capability: Capability.SERVER_START, action: 'start', handler: systemActionHandler },
  { method: 'POST', path: '/v1/system/stop', auth: 'hmac', capability: Capability.SERVER_STOP, action: 'stop', handler: systemActionHandler },
  { method: 'POST', path: '/v1/system/restart', auth: 'hmac', capability: Capability.SERVER_RESTART, action: 'restart', handler: systemActionHandler },
  { method: 'GET', path: '/v1/system/status', auth: 'hmac', capability: Capability.SERVER_STATUS, action: 'status', handler: systemActionHandler },
  { method: 'POST', path: '/v1/maintenance/update', auth: 'hmac', capability: Capability.SERVER_UPDATE, handler: maintenanceHandler },
  { method: 'POST', path: '/v1/maintenance/backup', auth: 'hmac', capability: Capability.SERVER_BACKUP, handler: maintenanceHandler },
  { method: 'POST', path: '/v1/maintenance/restore', auth: 'hmac', capability: Capability.SERVER_RESTORE, handler: maintenanceHandler },
  { method: 'POST', path: '/v1/agent/pair', auth: 'pairing', capability: Capability.AGENT_PAIR, handler: pairHandler },
  { method: 'POST', path: '/v1/agent/rotate-secret', auth: 'hmac', capability: Capability.AGENT_ROTATE_SECRET, handler: rotateSecretHandler },
  { method: 'POST', path: '/v1/agent/unpair', auth: 'hmac', capability: Capability.AGENT_UNPAIR, handler: unpairHandler },
  { method: 'POST', path: '/v1/agent/disable', auth: 'hmac', capability: Capability.AGENT_API_DISABLE, handler: disableHandler },
];

export function findRoute(method: string, path: string): { route: RouteSpec; methodMismatch: boolean } | undefined {
  const byPath = ROUTES.filter((route) => route.path === path);
  if (byPath.length === 0) return undefined;
  const exact = byPath.find((route) => route.method === method);
  if (exact !== undefined) return { route: exact, methodMismatch: false };
  return { route: byPath[0] as RouteSpec, methodMismatch: true };
}

export const DOCUMENTED_ENDPOINTS: readonly string[] = ROUTES.map((route) => `${route.method} ${route.path}`);
