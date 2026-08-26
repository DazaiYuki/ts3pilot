import { AppError, ErrorCode } from '../domain/errors.ts';
import type { Ts3Channel, Ts3Client, Ts3ServerStatus } from '../domain/models.ts';
import type { AppConfig } from '../domain/schemas.ts';
import { unescapeQueryValue } from './escape.ts';
import { ServerQueryConnection } from './serverQueryConnection.ts';
import { assertOk } from './serverQueryProtocol.ts';
import type {
  BanInput,
  ClientDetails,
  ChannelCreateInput,
  ChannelDeleteInput,
  ChannelEditInput,
  ChannelMoveInput,
  KickInput,
  MoveInput,
  PokeInput,
  TeamSpeakClient,
  Ts3FeatureValue,
} from './teamSpeakClient.ts';

const SUPPORTED: readonly Ts3FeatureValue[] = [
  'status',
  'clients.list',
  'channels.list',
  'channels.create',
  'channels.edit',
  'channels.delete',
  'channels.move',
  'clients.kick',
  'clients.ban',
  'clients.move',
  'clients.poke',
];

/**
 * ServerQuery (TCP 10011) client.
 *
 * The command/response layer is contract-tested against a fake TCP server that
 * speaks the same wire format; the exact escape/command semantics still need a
 * final pass against a live TeamSpeak server (see sandbox/README.md).
 */
export class ServerQueryTeamSpeakClient implements TeamSpeakClient {
  readonly kind = 'serverquery' as const;

  private readonly config: AppConfig;
  private connection: ServerQueryConnection | undefined;

  constructor(config: AppConfig) {
    this.config = config;
  }

  supports(feature: Ts3FeatureValue): boolean {
    return SUPPORTED.includes(feature);
  }

  private async conn(): Promise<ServerQueryConnection> {
    if (this.connection === undefined) {
      const query = this.config.ts3.query;
      if (query.username.length === 0 || query.password.length === 0) {
        throw new AppError(ErrorCode.CONFIG, 'ServerQuery credentials (ts3.query.username/password) are not configured');
      }
      this.connection = new ServerQueryConnection({
        host: '127.0.0.1',
        port: query.rawPort,
        username: query.username,
        password: query.password,
      });
    }
    return this.connection;
  }

  async status(): Promise<Ts3ServerStatus> {
    const response = assertOk(await (await this.conn()).command('serverinfo'));
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
    const response = assertOk(await (await this.conn()).command('clientlist'));
    return response.entries.map((entry) => ({
      clientId: toNumber(entry.clid) ?? 0,
      nickname: unescapeQueryValue(entry.client_nickname ?? ''),
      channelId: toNumber(entry.cid) ?? 0,
      clientType: toNumber(entry.client_type) ?? 0,
      uniqueId: entry.client_unique_identifier !== undefined ? unescapeQueryValue(entry.client_unique_identifier) : undefined,
      away: entry.client_away === '1',
    }));
  }

  async clientDetails(clientId: number): Promise<ClientDetails> {
    const response = assertOk(await (await this.conn()).command('clientinfo', { clid: clientId }));
    const first = response.entries[0] ?? {};
    return {
      description: first.client_description !== undefined ? unescapeQueryValue(first.client_description) : undefined,
      awayMessage: first.client_away_message !== undefined ? unescapeQueryValue(first.client_away_message) : undefined,
    };
  }

  async channels(): Promise<Ts3Channel[]> {
    const response = assertOk(await (await this.conn()).command('channellist'));
    return response.entries.map((entry) => ({
      channelId: toNumber(entry.cid) ?? 0,
      name: unescapeQueryValue(entry.channel_name ?? ''),
      parentId: toNumber(entry.pid) ?? 0,
      order: toNumber(entry.channel_order),
      totalClients: toNumber(entry.total_clients),
      topic: entry.channel_topic !== undefined ? unescapeQueryValue(entry.channel_topic) : undefined,
    }));
  }

  async channelCreate(input: ChannelCreateInput): Promise<{ channelId: number }> {
    const response = assertOk(
      await (await this.conn()).command('channelcreate', {
        channel_name: input.name,
        cpid: input.parentId ?? 0,
        channel_order: input.order ?? 0,
      }),
    );
    return { channelId: toNumber(response.entries[0]?.cid) ?? 0 };
  }

  async channelEdit(input: ChannelEditInput): Promise<{ ok: true }> {
    const params: Record<string, string | number> = { cid: input.channelId };
    if (input.name !== undefined) params.channel_name = input.name;
    if (input.topic !== undefined) params.channel_topic = input.topic;
    if (input.description !== undefined) params.channel_description = input.description;
    assertOk(await (await this.conn()).command('channeledit', params));
    return { ok: true };
  }

  async channelDelete(input: ChannelDeleteInput): Promise<{ ok: true }> {
    assertOk(
      await (await this.conn()).command('channeldelete', {
        cid: input.channelId,
        force: input.force ?? false,
      }),
    );
    return { ok: true };
  }

  async channelMove(input: ChannelMoveInput): Promise<{ ok: true }> {
    assertOk(
      await (await this.conn()).command('channelmove', {
        cid: input.channelId,
        cpid: input.parentId ?? 0,
        order: input.order ?? 0,
      }),
    );
    return { ok: true };
  }

  async kickClient(input: KickInput): Promise<{ ok: true }> {
    assertOk(
      await (await this.conn()).command('clientkick', {
        clid: input.clientId,
        reasonid: input.kickFrom === 'server' ? 5 : 4,
        reasonmsg: input.reason ?? '',
      }),
    );
    return { ok: true };
  }

  async banClient(input: BanInput): Promise<{ ok: true }> {
    assertOk(
      await (await this.conn()).command('banclient', {
        clid: input.clientId,
        banreason: input.reason ?? '',
        time: input.timeSeconds ?? 0,
      }),
    );
    return { ok: true };
  }

  async moveClient(input: MoveInput): Promise<{ ok: true }> {
    assertOk(await (await this.conn()).command('clientmove', { clid: input.clientId, cid: input.channelId }));
    return { ok: true };
  }

  async pokeClient(input: PokeInput): Promise<{ ok: true }> {
    assertOk(await (await this.conn()).command('clientpoke', { clid: input.clientId, msg: input.message }));
    return { ok: true };
  }
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
