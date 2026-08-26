import type { Ts3Channel, Ts3Client, Ts3ServerStatus } from '../domain/models.ts';

export const Ts3Feature = {
  STATUS: 'status',
  CLIENTS_LIST: 'clients.list',
  CHANNELS_LIST: 'channels.list',
  CHANNEL_CREATE: 'channels.create',
  CHANNEL_EDIT: 'channels.edit',
  CHANNEL_DELETE: 'channels.delete',
  CHANNEL_MOVE: 'channels.move',
  CLIENT_KICK: 'clients.kick',
  CLIENT_BAN: 'clients.ban',
  CLIENT_MOVE: 'clients.move',
  CLIENT_POKE: 'clients.poke',
} as const;

export type Ts3FeatureValue = (typeof Ts3Feature)[keyof typeof Ts3Feature];

export interface KickInput {
  clientId: number;
  reason?: string;
  kickFrom: 'channel' | 'server';
}

export interface BanInput {
  clientId: number;
  reason?: string;
  timeSeconds?: number;
}

export interface MoveInput {
  clientId: number;
  channelId: number;
}

export interface PokeInput {
  clientId: number;
  message: string;
}

export interface ChannelCreateInput {
  name: string;
  parentId?: number;
  order?: number;
}

export interface ChannelEditInput {
  channelId: number;
  name?: string;
  topic?: string;
  description?: string;
}

export interface ChannelDeleteInput {
  channelId: number;
  force?: boolean;
}

export interface ChannelMoveInput {
  channelId: number;
  parentId?: number;
  order?: number;
}

export interface TeamSpeakClient {
  readonly kind: 'mock' | 'webquery' | 'serverquery';
  supports(feature: Ts3FeatureValue): boolean;
  status(): Promise<Ts3ServerStatus>;
  clients(): Promise<Ts3Client[]>;
  channels(): Promise<Ts3Channel[]>;
  channelCreate(input: ChannelCreateInput): Promise<{ channelId: number }>;
  channelEdit(input: ChannelEditInput): Promise<{ ok: true }>;
  channelDelete(input: ChannelDeleteInput): Promise<{ ok: true }>;
  channelMove(input: ChannelMoveInput): Promise<{ ok: true }>;
  kickClient(input: KickInput): Promise<{ ok: true }>;
  banClient(input: BanInput): Promise<{ ok: true }>;
  moveClient(input: MoveInput): Promise<{ ok: true }>;
  pokeClient(input: PokeInput): Promise<{ ok: true }>;
}
