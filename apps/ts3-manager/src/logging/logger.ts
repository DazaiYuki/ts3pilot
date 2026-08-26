import { inspect } from 'node:util';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SECRET_KEY_PATTERN = /(secret|credential|token|api[-_]?key|password|passwd|pairing)/i;
const SECRET_VALUE_PATTERN = /^[A-Za-z0-9_-]{24,}$/;
const NON_SECRET_KEYS = new Set(['nodeId', 'requestId', 'eventId']);

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}

function redact(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (meta === undefined) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (
      SECRET_KEY_PATTERN.test(key) ||
      (!NON_SECRET_KEYS.has(key) && typeof value === 'string' && SECRET_VALUE_PATTERN.test(value))
    ) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = value;
    }
  }
  return out;
}

class ConsoleLogger implements Logger {
  private readonly level: LogLevel;
  private readonly json: boolean;
  private readonly baseMeta: Record<string, unknown>;

  constructor(level: LogLevel, json: boolean, baseMeta: Record<string, unknown>) {
    this.level = level;
    this.json = json;
    this.baseMeta = baseMeta;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  child(meta: Record<string, unknown>): Logger {
    return new ConsoleLogger(this.level, this.json, { ...this.baseMeta, ...meta });
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const safeMeta = redact({ ...this.baseMeta, ...meta });
    const timestamp = new Date().toISOString();
    if (this.json) {
      process.stdout.write(`${JSON.stringify({ timestamp, level, message, ...safeMeta })}\n`);
      return;
    }
    const metaText = safeMeta && Object.keys(safeMeta).length > 0 ? ` ${inspect(safeMeta, { breakLength: 120 })}` : '';
    const prefix = level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN' : level === 'debug' ? 'DEBUG' : 'INFO';
    process.stdout.write(`${timestamp} ${prefix} ${message}${metaText}\n`);
  }
}

export function createLogger(level: LogLevel, json: boolean, baseMeta: Record<string, unknown> = {}): Logger {
  return new ConsoleLogger(level, json, baseMeta);
}
