import { createConnection, type Socket } from 'node:net';
import { AppError, ErrorCode } from '../domain/errors.ts';
import type { Ts3Channel, Ts3Client, Ts3ServerStatus } from '../domain/models.ts';
import type { AppConfig } from '../domain/schemas.ts';
import { escapeQueryValue, parseKeyValueLine, splitEntries, unescapeQueryValue } from './escape.ts';
import type { BanInput, KickInput, MoveInput, PokeInput, TeamSpeakClient, Ts3FeatureValue } from './teamSpeakClient.ts';

const SUPPORTED: readonly Ts3FeatureValue[] = ['status', 'clients.list', 'channels.list', 'clients.kick', 'clients.ban', 'clients.move', 'clients.poke'];

interface QueryResponse {
  entries: Record<string, string>[];
  error: Record<string, string>;
}

export class ServerQueryTeamSpeakClient implements TeamSpeakClient {
  readonly kind = 'serverquery' as const;
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  supports(feature: Ts3FeatureValue): boolean {
    return SUPPORTED.includes(feature);
  }

  private async execute(command: string, parameters: Record<string, string | number> = {}): Promise<QueryResponse> {
    const query = this.config.ts3.query;
    if (query.username.length === 0 || query.password.length === 0) {
      throw new AppError(ErrorCode.CONFIG, 'ServerQuery credentials (ts3.query.username/password) are not configured');
    }
    const paramText = Object.entries(parameters)
      .map(([key, value]) => `${key}=${escapeQueryValue(String(value))}`)
      .join(' ');
    const fullCommand = `${command}${paramText.length > 0 ? ` ${paramText}` : ''}\n`;

    return new Promise<QueryResponse>((resolve, reject) => {
      const socket = createConnection({ host: '127.0.0.1', port: query.rawPort });
      let buffer = '';
      const lines: string[] = [];
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(new AppError(ErrorCode.NETWORK, 'ServerQuery timed out'));
        }
      }, 8000);

      socket.on('connect', () => {
        socket.write(`login client_login_name=${escapeQueryValue(query.username)} client_login_password=${escapeQueryValue(query.password)}\n`);
      });
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const newlineIndex = buffer.lastIndexOf('\n');
        if (newlineIndex === -1) return;
        const complete = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        lines.push(...complete.split('\n').map((line) => line.trim()).filter((line) => line.length > 0));
        this.processLines(lines, fullCommand, timer, socket, resolve, reject, () => {
          settled = true;
        });
      });
      socket.on('error', (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new AppError(ErrorCode.TS3, `ServerQuery connection error: ${error.message}`));
        }
      });
    });
  }

  private processLines(
    lines: string[],
    _fullCommand: string,
    timer: NodeJS.Timeout,
    socket: Socket,
    resolve: (value: QueryResponse) => void,
    reject: (reason: unknown) => void,
    markSettled: () => void,
  ): void {
    const errorIndex = lines.findIndex((line) => line.startsWith('error '));
    if (errorIndex === -1) return;
    clearTimeout(timer);
    markSettled();
    socket.end();

    const error = parseKeyValueLine(lines[errorIndex] as string);
    const entries = lines.slice(0, errorIndex).flatMap((line) => splitEntries(line).map((entry) => parseKeyValueLine(entry)));
    if (error.id !== '0') {
      reject(new AppError(ErrorCode.TS3, `ServerQuery error: ${unescapeQueryValue(error.msg ?? 'unknown')}`));
      return;
    }
    resolve({ entries, error });
  }

  async status(): Promise<Ts3ServerStatus> {
    const response = await this.execute('serverinfo');
    const first = response.entries[0] ?? {};
    return {
      online: true,
      name: first.virtualserver_name !== undefined ? unescapeQueryValue(first.virtualserver_name) : undefined,
      clientsOnline: toNumber(first.virtualserver_clientsonline),
      maxClients: toNumber(first.virtualserver_maxclients),
      version: first.virtualserver_version !== undefined ? unescapeQueryValue(first.virtualserver_version) : undefined,
      uptimeSec: toNumber(first.virtualserver_uptime),
    };
  }

  async clients(): Promise<Ts3Client[]> {
    const response = await this.execute('clientlist');
    return response.entries.map((entry) => ({
      clientId: toNumber(entry.clid) ?? 0,
      nickname: unescapeQueryValue(entry.client_nickname ?? ''),
      channelId: toNumber(entry.cid) ?? 0,
      clientType: toNumber(entry.client_type) ?? 0,
      uniqueId: entry.client_unique_identifier !== undefined ? unescapeQueryValue(entry.client_unique_identifier) : undefined,
      away: entry.client_away === '1',
    }));
  }

  async channels(): Promise<Ts3Channel[]> {
    const response = await this.execute('channellist');
    return response.entries.map((entry) => ({
      channelId: toNumber(entry.cid) ?? 0,
      name: unescapeQueryValue(entry.channel_name ?? ''),
      parentId: toNumber(entry.pid) ?? 0,
      order: toNumber(entry.channel_order),
      totalClients: toNumber(entry.total_clients),
    }));
  }

  async kickClient(input: KickInput): Promise<{ ok: true }> {
    await this.execute('clientkick', {
      clid: input.clientId,
      reasonid: input.kickFrom === 'server' ? 5 : 4,
      reasonmsg: input.reason ?? '',
    });
    return { ok: true };
  }

  async banClient(input: BanInput): Promise<{ ok: true }> {
    await this.execute('banclient', {
      clid: input.clientId,
      banreason: input.reason ?? '',
      time: input.timeSeconds ?? 0,
    });
    return { ok: true };
  }

  async moveClient(input: MoveInput): Promise<{ ok: true }> {
    await this.execute('clientmove', { clid: input.clientId, cid: input.channelId });
    return { ok: true };
  }

  async pokeClient(input: PokeInput): Promise<{ ok: true }> {
    await this.execute('clientpoke', { clid: input.clientId, msg: input.message });
    return { ok: true };
  }
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
