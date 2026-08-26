import type { Ts3Channel, Ts3Client, Ts3ServerStatus } from '../domain/models.ts';

export const Ts3Feature = {
  STATUS: 'status',
  CLIENTS_LIST: 'clients.list',
  CHANNELS_LIST: 'channels.list',
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

export interface TeamSpeakClient {
  readonly kind: 'mock' | 'webquery' | 'serverquery';
  supports(feature: Ts3FeatureValue): boolean;
  status(): Promise<Ts3ServerStatus>;
  clients(): Promise<Ts3Client[]>;
  channels(): Promise<Ts3Channel[]>;
  kickClient(input: KickInput): Promise<{ ok: true }>;
  banClient(input: BanInput): Promise<{ ok: true }>;
  moveClient(input: MoveInput): Promise<{ ok: true }>;
  pokeClient(input: PokeInput): Promise<{ ok: true }>;
}
