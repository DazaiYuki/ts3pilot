import { randomUUID } from 'node:crypto';
import { isCapability, defaultCapabilities } from './capabilities.ts';
import { AppError, ErrorCode } from './errors.ts';
import {
  expectBoolean,
  expectEnum,
  expectNumber,
  expectRecord,
  expectString,
  expectStringArray,
  optionalBoolean,
  optionalNumber,
  optionalString,
  ValidationError,
} from './validate.ts';

export type RunMode = 'development' | 'local-integration' | 'production';
export type SystemProvider = 'auto' | 'systemd' | 'script' | 'mock';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Ts3WebQueryConfig {
  enabled: boolean;
  httpPort: number;
  httpsPort: number;
  baseUrl: string;
  apiKey: string;
  authHeader: string;
  pathPrefix: string;
  verified: boolean;
}

export interface Ts3QueryConfig {
  rawPort: number;
  sshPort: number;
  username: string;
  password: string;
  webQuery: Ts3WebQueryConfig;
}

export interface Ts3Config {
  installPath: string;
  logDir: string;
  startScript: string;
  voicePort: number;
  fileTransferPort: number;
  query: Ts3QueryConfig;
  install: Ts3InstallConfig;
}

export interface Ts3InstallConfig {
  sourceUrl: string;
  sha256: string;
  verified: boolean;
}

export interface PairingState {
  codeHash: string;
  expiresAt: number;
  consumed: boolean;
}

export interface AgentConfig {
  enabled: boolean;
  host: string;
  port: number;
  remoteMode: boolean;
  credential: string;
  capabilities: string[];
  pairing?: PairingState;
  maxBodyBytes: number;
  clockSkewSec: number;
}

export interface SystemConfig {
  provider: SystemProvider;
  unitName: string;
}

export interface LoggingConfig {
  level: LogLevel;
  json: boolean;
}

export type IdentityVerificationField = 'nickname' | 'client_description' | 'client_away_message';

export const IDENTITY_VERIFICATION_FIELDS: readonly IdentityVerificationField[] = [
  'nickname',
  'client_description',
  'client_away_message',
];

export interface IdentityVerifyConfig {
  enabled: boolean;
  pollIntervalMs: number;
  fields: readonly IdentityVerificationField[];
  maxMatchesPerCycle: number;
}

export interface AppConfig {
  schemaVersion: number;
  nodeId: string;
  mode: RunMode;
  dataDir: string;
  ts3: Ts3Config;
  agent: AgentConfig;
  system: SystemConfig;
  logging: LoggingConfig;
  identity: { verify: IdentityVerifyConfig };
}

export const PORT_VOICE = 9987;
export const PORT_FILE_TRANSFER = 30033;
export const PORT_QUERY_RAW = 10011;
export const PORT_QUERY_SSH = 10022;
export const PORT_WEBQUERY_HTTP = 10080;
export const PORT_WEBQUERY_HTTPS = 10443;
export const PORT_AGENT_DEFAULT = 17880;
export const AGENT_HOST_DEFAULT = '127.0.0.1';

export function defaultConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    schemaVersion: 1,
    nodeId: randomUUID(),
    mode: 'development',
    dataDir: '',
    ts3: {
      installPath: '',
      logDir: '',
      startScript: 'ts3server_startscript.sh',
      voicePort: PORT_VOICE,
      fileTransferPort: PORT_FILE_TRANSFER,
      install: {
        sourceUrl: '',
        sha256: '',
        verified: false,
      },
      query: {
        rawPort: PORT_QUERY_RAW,
        sshPort: PORT_QUERY_SSH,
        username: '',
        password: '',
        webQuery: {
          enabled: false,
          httpPort: PORT_WEBQUERY_HTTP,
          httpsPort: PORT_WEBQUERY_HTTPS,
          baseUrl: '',
          apiKey: '',
          authHeader: 'x-api-key',
          pathPrefix: '/api/v1',
          verified: false,
        },
      },
    },
    agent: {
      enabled: false,
      host: AGENT_HOST_DEFAULT,
      port: PORT_AGENT_DEFAULT,
      remoteMode: false,
      credential: '',
      capabilities: defaultCapabilities(),
      maxBodyBytes: 64 * 1024,
      clockSkewSec: 300,
    },
    system: {
      provider: 'auto',
      unitName: 'ts3server.service',
    },
    logging: {
      level: 'info',
      json: false,
    },
    identity: {
      verify: {
        enabled: false,
        pollIntervalMs: 10000,
        fields: ['client_description', 'client_away_message', 'nickname'],
        maxMatchesPerCycle: 5,
      },
    },
    ...overrides,
  };
}

export function validateWebQuery(value: unknown, path: string): Ts3WebQueryConfig {
  const record = expectRecord(value, path);
  return {
    enabled: expectBoolean(record.enabled, `${path}.enabled`),
    httpPort: expectNumber(record.httpPort, `${path}.httpPort`, { integer: true, min: 1, max: 65535 }),
    httpsPort: expectNumber(record.httpsPort, `${path}.httpsPort`, { integer: true, min: 1, max: 65535 }),
    baseUrl: expectString(record.baseUrl ?? '', `${path}.baseUrl`, { max: 512 }),
    apiKey: expectString(record.apiKey ?? '', `${path}.apiKey`, { max: 1024 }),
    authHeader: expectString(record.authHeader ?? 'x-api-key', `${path}.authHeader`, { max: 128 }),
    pathPrefix: expectString(record.pathPrefix ?? '/api/v1', `${path}.pathPrefix`, { max: 256 }),
    verified: expectBoolean(record.verified ?? false, `${path}.verified`),
  };
}

export function validateConfig(value: unknown): AppConfig {
  const record = expectRecord(value, 'config');
  const agentRecord = expectRecord(record.agent ?? {}, 'config.agent');
  const ts3Record = expectRecord(record.ts3 ?? {}, 'config.ts3');
  const queryRecord = expectRecord(ts3Record.query ?? {}, 'config.ts3.query');
  const installRecord = expectRecord(ts3Record.install ?? {}, 'config.ts3.install');
  const systemRecord = expectRecord(record.system ?? {}, 'config.system');
  const loggingRecord = expectRecord(record.logging ?? {}, 'config.logging');
  const identityRecord = expectRecord(record.identity ?? {}, 'config.identity');
  const verifyRecord = expectRecord(identityRecord.verify ?? {}, 'config.identity.verify');
  const fields = expectStringArray(
    verifyRecord.fields ?? ['client_description', 'client_away_message', 'nickname'],
    'config.identity.verify.fields',
  );
  for (const field of fields) {
    if (!(IDENTITY_VERIFICATION_FIELDS as readonly string[]).includes(field)) {
      throw new AppError(ErrorCode.CONFIG, `Unknown identity verification field: ${field}`);
    }
  }
  const capabilities = expectStringArray(agentRecord.capabilities ?? defaultCapabilities(), 'config.agent.capabilities');
  for (const capability of capabilities) {
    if (!isCapability(capability)) {
      throw new AppError(ErrorCode.CONFIG, `Unknown capability: ${capability}`, { httpStatus: 500 });
    }
  }

  return {
    schemaVersion: expectNumber(record.schemaVersion ?? 1, 'config.schemaVersion', { integer: true }),
    nodeId: expectString(record.nodeId ?? randomUUID(), 'config.nodeId', { min: 1, max: 128 }),
    mode: expectEnum(record.mode ?? 'development', 'config.mode', ['development', 'local-integration', 'production'] as const),
    dataDir: expectString(record.dataDir ?? '', 'config.dataDir', { max: 1024 }),
    ts3: {
      installPath: expectString(ts3Record.installPath ?? '', 'config.ts3.installPath', { max: 1024 }),
      logDir: expectString(ts3Record.logDir ?? '', 'config.ts3.logDir', { max: 1024 }),
      startScript: expectString(ts3Record.startScript ?? 'ts3server_startscript.sh', 'config.ts3.startScript', { max: 512 }),
      voicePort: expectNumber(ts3Record.voicePort ?? PORT_VOICE, 'config.ts3.voicePort', { integer: true, min: 1, max: 65535 }),
      fileTransferPort: expectNumber(ts3Record.fileTransferPort ?? PORT_FILE_TRANSFER, 'config.ts3.fileTransferPort', { integer: true, min: 1, max: 65535 }),
      install: {
        sourceUrl: expectString(installRecord.sourceUrl ?? '', 'config.ts3.install.sourceUrl', { max: 1024 }),
        sha256: expectString(installRecord.sha256 ?? '', 'config.ts3.install.sha256', { max: 128 }),
        verified: expectBoolean(installRecord.verified ?? false, 'config.ts3.install.verified'),
      },
      query: {
        rawPort: expectNumber(queryRecord.rawPort ?? PORT_QUERY_RAW, 'config.ts3.query.rawPort', { integer: true, min: 1, max: 65535 }),
        sshPort: expectNumber(queryRecord.sshPort ?? PORT_QUERY_SSH, 'config.ts3.query.sshPort', { integer: true, min: 1, max: 65535 }),
        username: expectString(queryRecord.username ?? '', 'config.ts3.query.username', { max: 256 }),
        password: expectString(queryRecord.password ?? '', 'config.ts3.query.password', { max: 1024 }),
        webQuery: validateWebQuery(queryRecord.webQuery ?? {}, 'config.ts3.query.webQuery'),
      },
    },
    agent: {
      enabled: expectBoolean(agentRecord.enabled ?? false, 'config.agent.enabled'),
      host: expectString(agentRecord.host ?? AGENT_HOST_DEFAULT, 'config.agent.host', { max: 128 }),
      port: expectNumber(agentRecord.port ?? PORT_AGENT_DEFAULT, 'config.agent.port', { integer: true, min: 1, max: 65535 }),
      remoteMode: expectBoolean(agentRecord.remoteMode ?? false, 'config.agent.remoteMode'),
      credential: expectString(agentRecord.credential ?? '', 'config.agent.credential', { max: 1024 }),
      capabilities,
      pairing: optionalRecordPairing(agentRecord.pairing),
      maxBodyBytes: expectNumber(agentRecord.maxBodyBytes ?? 64 * 1024, 'config.agent.maxBodyBytes', { integer: true, min: 1024, max: 10 * 1024 * 1024 }),
      clockSkewSec: expectNumber(agentRecord.clockSkewSec ?? 300, 'config.agent.clockSkewSec', { integer: true, min: 1, max: 3600 }),
    },
    system: {
      provider: expectEnum(systemRecord.provider ?? 'auto', 'config.system.provider', ['auto', 'systemd', 'script', 'mock'] as const),
      unitName: expectString(systemRecord.unitName ?? 'ts3server.service', 'config.system.unitName', { max: 256 }),
    },
    logging: {
      level: expectEnum(loggingRecord.level ?? 'info', 'config.logging.level', ['debug', 'info', 'warn', 'error'] as const),
      json: expectBoolean(loggingRecord.json ?? false, 'config.logging.json'),
    },
    identity: {
      verify: {
        enabled: expectBoolean(verifyRecord.enabled ?? false, 'config.identity.verify.enabled'),
        pollIntervalMs: expectNumber(verifyRecord.pollIntervalMs ?? 10000, 'config.identity.verify.pollIntervalMs', { integer: true, min: 2000, max: 600000 }),
        fields: fields as IdentityVerificationField[],
        maxMatchesPerCycle: expectNumber(verifyRecord.maxMatchesPerCycle ?? 5, 'config.identity.verify.maxMatchesPerCycle', { integer: true, min: 1, max: 100 }),
      },
    },
  };
}

function optionalRecordPairing(value: unknown): PairingState | undefined {
  if (value === undefined || value === null) return undefined;
  const record = expectRecord(value, 'config.agent.pairing');
  return {
    codeHash: expectString(record.codeHash, 'config.agent.pairing.codeHash', { min: 1 }),
    expiresAt: expectNumber(record.expiresAt, 'config.agent.pairing.expiresAt', { integer: true }),
    consumed: expectBoolean(record.consumed ?? false, 'config.agent.pairing.consumed'),
  };
}

export interface KickBody {
  clientId: number;
  reason?: string;
  kickFrom: 'channel' | 'server';
}

export function validateKickBody(value: unknown): KickBody {
  const record = expectRecord(value, 'body');
  return {
    clientId: expectNumber(record.clientId, 'body.clientId', { integer: true, min: 1 }),
    reason: optionalString(record.reason, 'body.reason', { max: 512 }),
    kickFrom: expectEnum(record.kickFrom ?? 'channel', 'body.kickFrom', ['channel', 'server'] as const),
  };
}

export interface BanBody {
  clientId: number;
  reason?: string;
  timeSeconds?: number;
}

export function validateBanBody(value: unknown): BanBody {
  const record = expectRecord(value, 'body');
  return {
    clientId: expectNumber(record.clientId, 'body.clientId', { integer: true, min: 1 }),
    reason: optionalString(record.reason, 'body.reason', { max: 512 }),
    timeSeconds: optionalNumber(record.timeSeconds, 'body.timeSeconds', { integer: true, min: 0, max: 31536000 }),
  };
}

export interface MoveBody {
  clientId: number;
  channelId: number;
}

export function validateMoveBody(value: unknown): MoveBody {
  const record = expectRecord(value, 'body');
  return {
    clientId: expectNumber(record.clientId, 'body.clientId', { integer: true, min: 1 }),
    channelId: expectNumber(record.channelId, 'body.channelId', { integer: true, min: 0 }),
  };
}

export interface PokeBody {
  clientId: number;
  message: string;
}

export function validatePokeBody(value: unknown): PokeBody {
  const record = expectRecord(value, 'body');
  return {
    clientId: expectNumber(record.clientId, 'body.clientId', { integer: true, min: 1 }),
    message: expectString(record.message, 'body.message', { min: 1, max: 512 }),
  };
}

export interface ChannelCreateBody {
  name: string;
  parentId?: number;
  order?: number;
}

export function validateChannelCreateBody(value: unknown): ChannelCreateBody {
  const record = expectRecord(value, 'body');
  return {
    name: expectString(record.name, 'body.name', { min: 1, max: 100 }),
    parentId: optionalNumber(record.parentId, 'body.parentId', { integer: true, min: 0 }),
    order: optionalNumber(record.order, 'body.order', { integer: true, min: 0, max: 100000 }),
  };
}

export interface ChannelEditBody {
  channelId: number;
  name?: string;
  topic?: string;
  description?: string;
}

export function validateChannelEditBody(value: unknown): ChannelEditBody {
  const record = expectRecord(value, 'body');
  return {
    channelId: expectNumber(record.channelId, 'body.channelId', { integer: true, min: 1 }),
    name: optionalString(record.name, 'body.name', { min: 1, max: 100 }),
    topic: optionalString(record.topic, 'body.topic', { max: 255 }),
    description: optionalString(record.description, 'body.description', { max: 8192 }),
  };
}

export interface ChannelDeleteBody {
  channelId: number;
  force?: boolean;
}

export function validateChannelDeleteBody(value: unknown): ChannelDeleteBody {
  const record = expectRecord(value, 'body');
  return {
    channelId: expectNumber(record.channelId, 'body.channelId', { integer: true, min: 1 }),
    force: optionalBoolean(record.force, 'body.force'),
  };
}

export interface ChannelMoveBody {
  channelId: number;
  parentId?: number;
  order?: number;
}

export function validateChannelMoveBody(value: unknown): ChannelMoveBody {
  const record = expectRecord(value, 'body');
  return {
    channelId: expectNumber(record.channelId, 'body.channelId', { integer: true, min: 1 }),
    parentId: optionalNumber(record.parentId, 'body.parentId', { integer: true, min: 0 }),
    order: optionalNumber(record.order, 'body.order', { integer: true, min: 0, max: 100000 }),
  };
}

export interface PairBody {
  pairingCode: string;
}

export function validatePairBody(value: unknown): PairBody {
  const record = expectRecord(value, 'body');
  return {
    pairingCode: expectString(record.pairingCode, 'body.pairingCode', { min: 6, max: 64 }),
  };
}

export interface SystemActionBody {
  action: 'start' | 'stop' | 'restart' | 'status';
}

export function validateSystemActionBody(value: unknown): SystemActionBody {
  const record = expectRecord(value, 'body');
  return {
    action: expectEnum(record.action, 'body.action', ['start', 'stop', 'restart', 'status'] as const),
  };
}

export interface MaintenanceBackupBody {
  destPath?: string;
}

export function validateMaintenanceBackupBody(value: unknown): MaintenanceBackupBody {
  const record = expectRecord(value, 'body');
  return {
    destPath: optionalString(record.destPath, 'body.destPath', { max: 1024 }),
  };
}

export interface MaintenanceRestoreBody {
  archivePath: string;
  destPath?: string;
  dryRun?: boolean;
  force?: boolean;
}

export function validateMaintenanceRestoreBody(value: unknown): MaintenanceRestoreBody {
  const record = expectRecord(value, 'body');
  return {
    archivePath: expectString(record.archivePath, 'body.archivePath', { min: 1, max: 1024 }),
    destPath: optionalString(record.destPath, 'body.destPath', { max: 1024 }),
    dryRun: optionalBoolean(record.dryRun, 'body.dryRun'),
    force: optionalBoolean(record.force, 'body.force'),
  };
}

export interface IdentityChallengeRegisterBody {
  wpUserId: number;
  code: string;
  expiresAt?: number;
  webhookUrl: string;
  webhookSecret: string;
}

export function validateIdentityChallengeRegisterBody(value: unknown): IdentityChallengeRegisterBody {
  const record = expectRecord(value, 'body');
  const webhookUrl = expectString(record.webhookUrl, 'body.webhookUrl', { min: 1, max: 1024 });
  const parsed = safeParseUrl(webhookUrl);
  if (parsed === undefined || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.hostname.length === 0) {
    throw new ValidationError('body.webhookUrl must be a valid http(s) URL');
  }
  return {
    wpUserId: expectNumber(record.wpUserId, 'body.wpUserId', { integer: true, min: 1 }),
    code: expectString(record.code, 'body.code', { min: 6, max: 64, pattern: /^[A-Za-z0-9]+$/ }),
    expiresAt: optionalNumber(record.expiresAt, 'body.expiresAt', { integer: true, min: 1 }),
    webhookUrl,
    webhookSecret: expectString(record.webhookSecret, 'body.webhookSecret', { min: 16, max: 1024 }),
  };
}

function safeParseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export function applyEnvOverrides(config: AppConfig): AppConfig {
  const next = { ...config };
  const mode = process.env.TS3_MANAGER_MODE;
  if (mode === 'development' || mode === 'local-integration' || mode === 'production') {
    next.mode = mode;
  }
  const host = process.env.TS3_MANAGER_AGENT_HOST;
  if (host) next.agent = { ...next.agent, host };
  const port = Number(process.env.TS3_MANAGER_AGENT_PORT);
  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    next.agent = { ...next.agent, port };
  }
  return next;
}
