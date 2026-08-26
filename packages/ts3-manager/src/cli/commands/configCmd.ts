import { existsSync } from 'node:fs';
import { defaultConfigPath, readConfig, writeConfig } from '../../config/config.ts';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import { defaultConfig, type AppConfig } from '../../domain/schemas.ts';
import { printJson, printLine } from '../print.ts';

export function runConfigCommand(positionals: readonly string[], configPath?: string): void {
  const sub = positionals[0] ?? 'show';
  const path = configPath ?? defaultConfigPath();
  switch (sub) {
    case 'init': {
      if (existsSync(path)) {
        printLine(`config already exists at ${path}`);
      } else {
        const config = readConfigSafe(path);
        writeConfig(path, config);
        printLine(`created config at ${path}`);
      }
      return;
    }
    case 'path':
      printLine(path);
      return;
    case 'validate': {
      readConfig(path);
      printLine('config OK');
      return;
    }
    case 'show':
      printJson(redactConfig(readConfig(path)));
      return;
    case 'get': {
      const key = positionals[1];
      if (key === undefined) throw new AppError(ErrorCode.USER, 'usage: config get <dotted.key>');
      const value = getPath(readConfig(path), key);
      printJson(value);
      return;
    }
    case 'set': {
      const key = positionals[1];
      const value = positionals[2];
      if (key === undefined || value === undefined) {
        throw new AppError(ErrorCode.USER, 'usage: config set <dotted.key> <value>');
      }
      const current = readConfig(path);
      setPath(current, key, coerce(value));
      writeConfig(path, current);
      readConfig(path);
      printLine('config updated');
      return;
    }
    default:
      throw new AppError(ErrorCode.USER, `unknown config subcommand: ${sub}`);
  }
}

function readConfigSafe(path: string): AppConfig {
  try {
    return readConfig(path);
  } catch {
    const config = defaultConfig();
    config.dataDir = path.replace(/config\.json$/, '').replace(/[\\/]$/, '');
    return config;
  }
}

export function redactConfig(config: AppConfig): Record<string, unknown> {
  return {
    schemaVersion: config.schemaVersion,
    nodeId: config.nodeId,
    mode: config.mode,
    dataDir: config.dataDir,
    ts3: {
      installPath: config.ts3.installPath,
      logDir: config.ts3.logDir,
      startScript: config.ts3.startScript,
      voicePort: config.ts3.voicePort,
      fileTransferPort: config.ts3.fileTransferPort,
      install: {
        sourceUrl: config.ts3.install.sourceUrl,
        sha256: config.ts3.install.sha256 ? '[REDACTED]' : '',
        verified: config.ts3.install.verified,
      },
      query: {
        rawPort: config.ts3.query.rawPort,
        sshPort: config.ts3.query.sshPort,
        username: config.ts3.query.username,
        password: config.ts3.query.password ? '[REDACTED]' : '',
        webQuery: {
          enabled: config.ts3.query.webQuery.enabled,
          httpPort: config.ts3.query.webQuery.httpPort,
          httpsPort: config.ts3.query.webQuery.httpsPort,
          baseUrl: config.ts3.query.webQuery.baseUrl,
          apiKey: config.ts3.query.webQuery.apiKey ? '[REDACTED]' : '',
          authHeader: config.ts3.query.webQuery.authHeader,
          pathPrefix: config.ts3.query.webQuery.pathPrefix,
          verified: config.ts3.query.webQuery.verified,
        },
      },
    },
    agent: {
      enabled: config.agent.enabled,
      host: config.agent.host,
      port: config.agent.port,
      remoteMode: config.agent.remoteMode,
      credential: config.agent.credential ? '[REDACTED]' : '',
      capabilities: config.agent.capabilities,
      pairing: config.agent.pairing ? { expiresAt: config.agent.pairing.expiresAt, consumed: config.agent.pairing.consumed } : undefined,
      maxBodyBytes: config.agent.maxBodyBytes,
      clockSkewSec: config.agent.clockSkewSec,
    },
    system: config.system,
    logging: config.logging,
  };
}

function getPath(config: AppConfig, dottedKey: string): unknown {
  let current: unknown = config;
  for (const part of dottedKey.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setPath(config: AppConfig, dottedKey: string, value: unknown): void {
  const parts = dottedKey.split('.');
  let current: Record<string, unknown> = config as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (typeof next !== 'object' || next === null) {
      throw new AppError(ErrorCode.USER, `config key not found: ${dottedKey}`);
    }
    current = next as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1] as string;
  if (!(leaf in current)) throw new AppError(ErrorCode.USER, `config key not found: ${dottedKey}`);
  current[leaf] = value;
}

function coerce(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}
