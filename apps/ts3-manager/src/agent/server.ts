import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { AppError, ErrorCode, isAppError, toErrorEnvelope } from '../domain/errors.ts';
import { validatePairBody } from '../domain/schemas.ts';
import type { Logger } from '../logging/logger.ts';
import { AUTH_PROTOCOL_VERSION, bodyHash, verifySignature } from '../security/hmac.ts';
import { NonceStore } from '../security/nonceStore.ts';
import { pairingMatches } from '../security/pairing.ts';
import { TokenBucketLimiter } from '../security/rateLimit.ts';
import { randomHex } from '../security/secrets.ts';
import type { ServiceManager } from '../system/serviceManager.ts';
import type { ChallengeStore } from '../identity/challengeStore.ts';
import type { TeamSpeakClient } from '../ts3/teamSpeakClient.ts';
import { capabilityForRoute } from './handlers.ts';
import { findRoute } from './routeTable.ts';
import { AgentState } from './state.ts';

export interface AgentServerHandle {
  url: string;
  port: number;
  close(): Promise<void>;
}

interface AgentDependencies {
  ts3: TeamSpeakClient;
  services: ServiceManager;
  logger: Logger;
  identityStore?: ChallengeStore;
}

export async function startAgentServer(
  configPath: string,
  deps: AgentDependencies,
  options: { listenPort?: number } = {},
): Promise<AgentServerHandle> {
  const state = new AgentState(configPath);
  const initial = state.load();
  const nonces = new NonceStore(initial.agent.clockSkewSec * 1000 * 2);
  const generalLimiter = new TokenBucketLimiter(120, 4);
  const pairingLimiter = new TokenBucketLimiter(10, 1);
  let closeRequested = false;

  const server = createServer((req, res) => {
    void handleRequest(req, res, {
      state,
      nonces,
      generalLimiter,
      pairingLimiter,
      onDisable: () => {
        if (closeRequested) return;
        closeRequested = true;
        setTimeout(() => {
          server.close();
        }, 50);
      },
      ...deps,
    }).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: { code: ErrorCode.INTERNAL, message: 'Internal error' } });
      }
      res.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.listenPort ?? initial.agent.port, initial.agent.host, () => resolve());
  });

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : initial.agent.port;
  const url = `http://${initial.agent.host}:${port}`;
  return {
    url,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        try {
          server.closeAllConnections?.();
        } catch {
          // The server may already have been closed (e.g. by /v1/agent/disable).
        }
        server.close(() => resolve());
      }),
  };
}

interface RequestContext extends AgentDependencies {
  state: AgentState;
  nonces: NonceStore;
  generalLimiter: TokenBucketLimiter;
  pairingLimiter: TokenBucketLimiter;
  onDisable: () => void;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, ctx: RequestContext): Promise<void> {
  const requestId = randomHex(6);
  const config = ctx.state.load();
  const ip = req.socket.remoteAddress ?? 'unknown';
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const method = req.method ?? 'GET';

  const found = findRoute(method, path);
  if (found === undefined) {
    sendError(res, 404, new AppError(ErrorCode.NOT_FOUND, `No such endpoint: ${method} ${path}`, { httpStatus: 404 }), requestId);
    return;
  }
  if (found.methodMismatch) {
    sendError(res, 405, new AppError(ErrorCode.VALIDATION, `Method ${method} not allowed for ${path}`, { httpStatus: 405 }), requestId);
    return;
  }
  const route = found.route;

  try {
    const rawBody = await readBody(req, config.agent.maxBodyBytes);
    const body = parseBody(rawBody);

    const limiter = route.path === '/v1/agent/pair' ? ctx.pairingLimiter : ctx.generalLimiter;
    if (!limiter.consume(`ip:${ip}`)) {
      ctx.logger.warn('rate limited', { requestId, ip, path });
      sendError(res, 429, new AppError(ErrorCode.RATE_LIMITED, 'Too many requests', { httpStatus: 429 }), requestId);
      return;
    }

    if (route.auth !== 'public') {
      authenticate(route.auth, req, rawBody, method, path, config, ctx, body);
    }
    capabilityForRoute(route, config.agent.capabilities);

    const result = await route.handler({
      config,
      body,
      requestId,
      logger: ctx.logger,
      ts3: ctx.ts3,
      services: ctx.services,
      state: ctx.state,
      route,
      identityStore: ctx.identityStore,
    });
    sendJson(res, result.status, { ok: true, data: result.data });
    ctx.logger.info('request completed', { requestId, ip, method, path, status: result.status });
    if (result.closeAfter === true) {
      ctx.onDisable();
    }
  } catch (error) {
    const status = isAppError(error) ? error.httpStatus : 500;
    const envelope = toErrorEnvelope(error);
    ctx.logger.warn('request failed', { requestId, ip, method, path, status, code: envelope.code });
    sendError(res, status, error, requestId);
  }
}

function authenticate(
  mode: 'hmac' | 'pairing',
  req: IncomingMessage,
  rawBody: string,
  method: string,
  path: string,
  config: ReturnType<AgentState['load']>,
  ctx: RequestContext,
  body: unknown,
): void {
  let secret = '';
  if (mode === 'pairing') {
    const pairBody = validatePairBody(body);
    if (config.agent.pairing === undefined) {
      throw new AppError(ErrorCode.AUTH, 'No pairing code is active', { httpStatus: 401 });
    }
    if (!pairingMatches(config.agent.pairing, pairBody.pairingCode)) {
      throw new AppError(ErrorCode.AUTH, 'Invalid pairing code', { httpStatus: 401 });
    }
    secret = pairBody.pairingCode;
  } else {
    secret = config.agent.credential;
    if (secret.length === 0) {
      throw new AppError(ErrorCode.AUTH, 'Agent is not paired', { httpStatus: 401 });
    }
  }

  const timestamp = req.headers['x-ts3cops-timestamp'];
  const nonce = req.headers['x-ts3cops-nonce'];
  const signature = req.headers['x-ts3cops-signature'];
  if (typeof timestamp !== 'string' || typeof nonce !== 'string' || typeof signature !== 'string') {
    throw new AppError(ErrorCode.AUTH, 'Missing authentication headers', { httpStatus: 401 });
  }
  const timestampNumber = Number(timestamp);
  if (!Number.isInteger(timestampNumber)) {
    throw new AppError(ErrorCode.AUTH, 'Invalid timestamp header', { httpStatus: 401 });
  }
  const skew = config.agent.clockSkewSec;
  if (Math.abs(Date.now() / 1000 - timestampNumber) > skew) {
    throw new AppError(ErrorCode.AUTH, 'Request timestamp is outside the allowed window', { httpStatus: 401 });
  }
  if (!ctx.nonces.checkAndStore(nonce)) {
    throw new AppError(ErrorCode.REPLAY, 'Replayed nonce detected', { httpStatus: 401 });
  }
  const valid = verifySignature(
    secret,
    {
      timestamp,
      nonce,
      method,
      path,
      bodyHash: bodyHash(rawBody),
    },
    signature,
  );
  if (!valid) {
    throw new AppError(ErrorCode.AUTH, 'Invalid signature', { httpStatus: 401 });
  }
}

async function readBody(req: IncomingMessage, limitBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limitBytes) {
      throw new AppError(ErrorCode.VALIDATION, 'Request body too large', { httpStatus: 413 });
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseBody(rawBody: string): unknown {
  if (rawBody.length === 0) return {};
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new AppError(ErrorCode.VALIDATION, 'Request body must be valid JSON', { httpStatus: 400 });
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, status: number, error: unknown, requestId: string): void {
  const envelope = toErrorEnvelope(error);
  sendJson(res, status, { ok: false, error: { ...envelope, requestId } });
}

export function protocolVersion(): number {
  return AUTH_PROTOCOL_VERSION;
}
