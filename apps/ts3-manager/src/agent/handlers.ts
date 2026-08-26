import { hasCapability } from '../domain/capabilities.ts';
import { AppError, ErrorCode } from '../domain/errors.ts';
import type { HealthInfo } from '../domain/models.ts';
import {
  validateChannelCreateBody,
  validateChannelDeleteBody,
  validateChannelEditBody,
  validateChannelMoveBody,
  validateIdentityChallengeRegisterBody,
  validateBanBody,
  validateKickBody,
  validateMoveBody,
  validatePairBody,
  validatePokeBody,
  validateSystemActionBody,
  type AppConfig,
} from '../domain/schemas.ts';
import type { ChallengeStore } from '../identity/challengeStore.ts';
import type { Logger } from '../logging/logger.ts';
import { pairingMatches } from '../security/pairing.ts';
import { randomToken, sha256Hex } from '../security/secrets.ts';
import type { ServiceManager } from '../system/serviceManager.ts';
import type { TeamSpeakClient, Ts3FeatureValue } from '../ts3/teamSpeakClient.ts';
import type { AgentState } from './state.ts';
import type { RouteSpec } from './routeTable.ts';

export interface HandlerContext {
  config: AppConfig;
  body: unknown;
  requestId: string;
  logger: Logger;
  ts3: TeamSpeakClient;
  services: ServiceManager;
  state: AgentState;
  route: RouteSpec;
  identityStore: ChallengeStore | undefined;
}

export interface HandlerResult {
  status: number;
  data: unknown;
  closeAfter?: boolean;
}

function requireFeature(ts3: TeamSpeakClient, feature: Ts3FeatureValue): void {
  if (!ts3.supports(feature)) {
    throw new AppError(
      ErrorCode.TS3_UNSUPPORTED,
      `TS3 feature not supported by provider '${ts3.kind}': ${feature}`,
      { httpStatus: 501 },
    );
  }
}

export function healthHandler(ctx: HandlerContext): HandlerResult {
  const data: HealthInfo = {
    status: 'ok',
    service: 'ts3-agent',
    protocolVersion: 1,
    nodeId: ctx.config.nodeId,
    mode: ctx.config.mode,
    systemProvider: ctx.services.providerName,
    ts3Provider: ctx.ts3.kind,
  };
  return { status: 200, data };
}

export function infoHandler(ctx: HandlerContext): HandlerResult {
  return {
    status: 200,
    data: {
      nodeId: ctx.config.nodeId,
      mode: ctx.config.mode,
      protocolVersion: 1,
      capabilities: ctx.config.agent.capabilities,
      systemProvider: ctx.services.providerName,
      ts3Provider: ctx.ts3.kind,
      remoteMode: ctx.config.agent.remoteMode,
      listening: { host: ctx.config.agent.host, port: ctx.config.agent.port },
    },
  };
}

export async function serverStatusHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'status');
  return { status: 200, data: await ctx.ts3.status() };
}

export async function clientsHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'clients.list');
  return { status: 200, data: await ctx.ts3.clients() };
}

export async function channelsHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'channels.list');
  return { status: 200, data: await ctx.ts3.channels() };
}

export async function channelCreateHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'channels.create');
  const input = validateChannelCreateBody(ctx.body);
  return { status: 200, data: await ctx.ts3.channelCreate(input) };
}

export async function channelEditHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'channels.edit');
  const input = validateChannelEditBody(ctx.body);
  return { status: 200, data: await ctx.ts3.channelEdit(input) };
}

export async function channelDeleteHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'channels.delete');
  const input = validateChannelDeleteBody(ctx.body);
  return { status: 200, data: await ctx.ts3.channelDelete(input) };
}

export async function channelMoveHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'channels.move');
  const input = validateChannelMoveBody(ctx.body);
  return { status: 200, data: await ctx.ts3.channelMove(input) };
}

export async function kickHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'clients.kick');
  const input = validateKickBody(ctx.body);
  return { status: 200, data: await ctx.ts3.kickClient(input) };
}

export async function banHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'clients.ban');
  const input = validateBanBody(ctx.body);
  return { status: 200, data: await ctx.ts3.banClient(input) };
}

export async function moveHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'clients.move');
  const input = validateMoveBody(ctx.body);
  return { status: 200, data: await ctx.ts3.moveClient(input) };
}

export async function pokeHandler(ctx: HandlerContext): Promise<HandlerResult> {
  requireFeature(ctx.ts3, 'clients.poke');
  const input = validatePokeBody(ctx.body);
  return { status: 200, data: await ctx.ts3.pokeClient(input) };
}

export async function systemActionHandler(ctx: HandlerContext): Promise<HandlerResult> {
  const body = validateSystemActionBody(ctx.body);
  switch (body.action) {
    case 'start':
      return { status: 200, data: await ctx.services.start() };
    case 'stop':
      return { status: 200, data: await ctx.services.stop() };
    case 'restart':
      return { status: 200, data: await ctx.services.restart() };
    case 'status':
      return { status: 200, data: await ctx.services.status() };
  }
}

export function maintenanceHandler(_ctx: HandlerContext): HandlerResult {
  throw new AppError(
    ErrorCode.NOT_IMPLEMENTED,
    'Maintenance operations are planned but not implemented in this MVP; use the CLI for local backup/restore.',
    { httpStatus: 501 },
  );
}

export function pairHandler(ctx: HandlerContext): HandlerResult {
  const body = validatePairBody(ctx.body);
  const state = ctx.state.load();
  if (state.agent.pairing === undefined || !pairingMatches(state.agent.pairing, body.pairingCode)) {
    throw new AppError(ErrorCode.AUTH, 'Invalid, expired or already consumed pairing code', { httpStatus: 401 });
  }
  const credential = randomToken();
  const next = ctx.state.update((config) => ({
    ...config,
    agent: {
      ...config.agent,
      pairing: undefined,
      credential,
    },
  }));
  ctx.logger.info('pairing completed', { nodeId: next.nodeId });
  return {
    status: 200,
    data: {
      nodeId: next.nodeId,
      credential,
      protocolVersion: 1,
    },
  };
}

export function rotateSecretHandler(ctx: HandlerContext): HandlerResult {
  const current = ctx.state.load();
  if (!current.agent.credential) {
    throw new AppError(ErrorCode.AUTH, 'Agent is not paired; run api enable + pair first', { httpStatus: 401 });
  }
  const credential = randomToken();
  const next = ctx.state.update((config) => ({
    ...config,
    agent: { ...config.agent, credential },
  }));
  ctx.logger.info('agent credential rotated', { nodeId: next.nodeId });
  return { status: 200, data: { nodeId: next.nodeId, credential } };
}

export function unpairHandler(ctx: HandlerContext): HandlerResult {
  ctx.state.update((config) => ({
    ...config,
    agent: { ...config.agent, credential: '', pairing: undefined },
  }));
  ctx.logger.info('agent unpaired');
  return { status: 200, data: { ok: true } };
}

export function disableHandler(ctx: HandlerContext): HandlerResult {
  ctx.state.update((config) => ({
    ...config,
    agent: { ...config.agent, enabled: false, credential: '', pairing: undefined },
  }));
  ctx.logger.warn('agent API disabled via API');
  return { status: 200, data: { ok: true }, closeAfter: true };
}

export function capabilityForRoute(route: RouteSpec, granted: readonly string[]): void {
  if (route.capability !== undefined && !hasCapability(granted, route.capability)) {
    throw new AppError(ErrorCode.PERMISSION, `Capability required: ${route.capability}`, { httpStatus: 403 });
  }
}

export function identityChallengeRegisterHandler(ctx: HandlerContext): HandlerResult {
  const body = validateIdentityChallengeRegisterBody(ctx.body);
  if (ctx.identityStore === undefined) {
    throw new AppError(ErrorCode.AGENT, 'Identity challenge store is not available', { httpStatus: 500 });
  }
  const expiresAt = body.expiresAt ?? Date.now() + 10 * 60 * 1000;
  ctx.identityStore.register({
    codeHash: sha256Hex(body.code),
    wpUserId: body.wpUserId,
    expiresAt,
    attempts: 0,
    consumed: false,
    webhook: { url: body.webhookUrl, secret: body.webhookSecret },
    delivered: false,
  });
  ctx.logger.info('identity challenge registered', { wpUserId: body.wpUserId, expiresAt });
  return { status: 200, data: { ok: true, expiresAt } };
}
