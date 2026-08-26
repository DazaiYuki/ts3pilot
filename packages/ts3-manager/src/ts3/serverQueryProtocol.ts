import { AppError, ErrorCode } from '../domain/errors.ts';
import { escapeQueryValue, parseKeyValueLine, splitEntries, unescapeQueryValue } from './escape.ts';

export interface QueryParams {
  [key: string]: string | number | boolean;
}

export interface QueryError {
  id: string;
  msg: string;
  extra: Record<string, string>;
}

export interface QueryNotification {
  event: string;
  params: Record<string, string>;
}

export interface ParsedQueryResponse {
  entries: Record<string, string>[];
  error: QueryError;
  notifications: QueryNotification[];
}

/**
 * Build a ServerQuery command line.
 *
 * Parameter names are restricted to [A-Za-z0-9_] and values are escaped with
 * the TS3 escape rules. This is the only place where query text is assembled,
 * so business code can never inject arbitrary query fragments.
 */
export function buildCommand(name: string, params: QueryParams = {}): string {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new AppError(ErrorCode.VALIDATION, `Invalid ServerQuery command name: ${name}`);
  }
  const parts: string[] = [name];
  for (const [key, value] of Object.entries(params)) {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      throw new AppError(ErrorCode.VALIDATION, `Invalid ServerQuery parameter name: ${key}`);
    }
    const rendered = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    parts.push(`${key}=${escapeQueryValue(rendered)}`);
  }
  return `${parts.join(' ')}\n`;
}

export function parseErrorLine(line: string): QueryError {
  const params = parseKeyValueLine(line.replace(/^error\s+/, ''));
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'id' && key !== 'msg') extra[key] = value;
  }
  return {
    id: params.id ?? '',
    msg: unescapeQueryValue(params.msg ?? ''),
    extra,
  };
}

/**
 * Parse a full ServerQuery response (one or more data lines, terminated by an
 * `error id=... msg=...` line). `notify*` lines are reported separately and
 * never treated as command data.
 */
export function parseRawResponse(raw: string): ParsedQueryResponse {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entries: Record<string, string>[] = [];
  const notifications: QueryNotification[] = [];
  let error: QueryError | undefined;

  for (const line of lines) {
    if (line.startsWith('error ')) {
      error = parseErrorLine(line);
      break;
    }
    if (line.startsWith('notify')) {
      const space = line.indexOf(' ');
      const event = space === -1 ? line : line.slice(0, space);
      const rest = space === -1 ? '' : line.slice(space + 1);
      notifications.push({ event, params: parseKeyValueLine(rest) });
      continue;
    }
    for (const entry of splitEntries(line)) {
      entries.push(parseKeyValueLine(entry));
    }
  }

  if (error === undefined) {
    throw new AppError(ErrorCode.TS3, 'ServerQuery response is missing the terminating error line');
  }
  return { entries, error, notifications };
}

export function responseHasError(response: ParsedQueryResponse): boolean {
  return response.error.id !== '0';
}

export function assertOk(response: ParsedQueryResponse): ParsedQueryResponse {
  if (responseHasError(response)) {
    throw new AppError(ErrorCode.TS3, `ServerQuery error: ${response.error.msg}`, {
      details: { id: response.error.id, extra: response.error.extra },
    });
  }
  return response;
}
