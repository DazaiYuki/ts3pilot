import { AppError, ErrorCode } from '../domain/errors.ts';
import type { Ts3Channel, Ts3Client, Ts3ServerStatus } from '../domain/models.ts';
import type { BanInput, KickInput, MoveInput, PokeInput, TeamSpeakClient, Ts3FeatureValue } from './teamSpeakClient.ts';

const INITIAL_CLIENTS: Ts3Client[] = [
  { clientId: 1, nickname: 'MockAlice', channelId: 1, clientType: 0, uniqueId: 'mockuid-alice', away: false },
  { clientId: 2, nickname: 'MockBob', channelId: 1, clientType: 0, uniqueId: 'mockuid-bob', away: true },
  { clientId: 3, nickname: 'MockCarol', channelId: 2, clientType: 0, uniqueId: 'mockuid-carol', away: false },
  { clientId: 4, nickname: 'MockServerQuery', channelId: 0, clientType: 1, uniqueId: 'mockuid-query' },
];

const INITIAL_CHANNELS: Ts3Channel[] = [
  { channelId: 1, name: 'Lobby', parentId: 0, order: 0 },
  { channelId: 2, name: 'General', parentId: 0, order: 1 },
  { channelId: 3, name: 'AFK', parentId: 1, order: 0 },
];

const SUPPORTED: readonly Ts3FeatureValue[] = [
  'status',
  'clients.list',
  'channels.list',
  'clients.kick',
  'clients.ban',
  'clients.move',
  'clients.poke',
];

export class MockTeamSpeakClient implements TeamSpeakClient {
  readonly kind = 'mock' as const;

  private readonly clientList: Ts3Client[];
  private readonly channelList: Ts3Channel[];

  constructor() {
    this.clientList = INITIAL_CLIENTS.map((client) => ({ ...client }));
    this.channelList = INITIAL_CHANNELS.map((channel) => ({ ...channel }));
  }

  supports(feature: Ts3FeatureValue): boolean {
    return SUPPORTED.includes(feature);
  }

  async status(): Promise<Ts3ServerStatus> {
    const onlineClients = this.clientList.filter((client) => client.clientType === 0);
    return {
      online: true,
      name: 'Mock Community Server',
      clientsOnline: onlineClients.length,
      maxClients: 32,
      version: 'mock',
      platform: 'development',
      uptimeSec: 3600,
      mock: true,
    };
  }

  async clients(): Promise<Ts3Client[]> {
    return this.clientList.map((client) => ({ ...client }));
  }

  async channels(): Promise<Ts3Channel[]> {
    return this.channelList.map((channel) => ({
      ...channel,
      totalClients: this.clientList.filter((client) => client.channelId === channel.channelId && client.clientType === 0).length,
    }));
  }

  async kickClient(input: KickInput): Promise<{ ok: true }> {
    const client = this.findClient(input.clientId);
    if (input.kickFrom === 'server') {
      this.clientList.splice(this.clientList.indexOf(client), 1);
    } else {
      client.channelId = 0;
    }
    return { ok: true };
  }

  async banClient(input: BanInput): Promise<{ ok: true }> {
    const client = this.findClient(input.clientId);
    this.clientList.splice(this.clientList.indexOf(client), 1);
    return { ok: true };
  }

  async moveClient(input: MoveInput): Promise<{ ok: true }> {
    const client = this.findClient(input.clientId);
    if (!this.channelList.some((channel) => channel.channelId === input.channelId) && input.channelId !== 0) {
      throw new AppError(ErrorCode.TS3, `Channel ${input.channelId} not found`);
    }
    client.channelId = input.channelId;
    return { ok: true };
  }

  async pokeClient(input: PokeInput): Promise<{ ok: true }> {
    this.findClient(input.clientId);
    return { ok: true };
  }

  private findClient(clientId: number): Ts3Client {
    const client = this.clientList.find((entry) => entry.clientId === clientId);
    if (client === undefined) {
      throw new AppError(ErrorCode.TS3, `Client ${clientId} not found`);
    }
    return client;
  }
}
