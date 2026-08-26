import { AppError, ErrorCode } from '../domain/errors.ts';
import type { Ts3Channel, Ts3Client, Ts3ServerStatus } from '../domain/models.ts';
import type { AppConfig } from '../domain/schemas.ts';
import type {
  BanInput,
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

/**
 * TS3 WebQuery adapter.
 *
 * TeamSpeak's WebQuery API surface is deliberately NOT hard-coded from memory:
 * the exact paths, headers and response shapes must be verified against the
 * official TeamSpeak 3 documentation before `ts3.query.webQuery.verified`
 * is set to true. Until then every call fails with TS3_API_UNVERIFIED.
 */
const ENDPOINTS = {
  status: '/server',
  clients: '/clientlist',
  channels: '/channellist',
} as const;

export class WebQueryTeamSpeakClient implements TeamSpeakClient {
  readonly kind = 'webquery' as const;

  private readonly baseUrl: string;
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    const webQuery = config.ts3.query.webQuery;
    this.baseUrl = (webQuery.baseUrl || `http://127.0.0.1:${webQuery.httpPort}`).replace(/\/+$/, '');
  }

  supports(feature: Ts3FeatureValue): boolean {
    const actionFeatures: readonly string[] = [
      'clients.kick',
      'clients.ban',
      'clients.move',
      'clients.poke',
      'channels.create',
      'channels.edit',
      'channels.delete',
      'channels.move',
    ];
    return this.config.ts3.query.webQuery.verified && !actionFeatures.includes(feature);
  }

  private async request<T>(path: string): Promise<T> {
    const webQuery = this.config.ts3.query.webQuery;
    if (!webQuery.verified) {
      throw new AppError(
        ErrorCode.TS3_UNVERIFIED,
        'WebQuery API mapping is not verified against official TeamSpeak documentation; set ts3.query.webQuery.verified=true only after verification.',
        { httpStatus: 501 },
      );
    }
    if (webQuery.apiKey.length === 0) {
      throw new AppError(ErrorCode.CONFIG, 'WebQuery API key is not configured', { httpStatus: 500 });
    }
    const url = `${this.baseUrl}${webQuery.pathPrefix}${path}`;
    const response = await fetch(url, {
      headers: { [webQuery.authHeader]: webQuery.apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new AppError(ErrorCode.TS3, `WebQuery HTTP ${response.status}`, { httpStatus: 502 });
    }
    return (await response.json()) as T;
  }

  async status(): Promise<Ts3ServerStatus> {
    return this.request<Ts3ServerStatus>(ENDPOINTS.status);
  }

  async clients(): Promise<Ts3Client[]> {
    return this.request<Ts3Client[]>(ENDPOINTS.clients);
  }

  async channels(): Promise<Ts3Channel[]> {
    return this.request<Ts3Channel[]>(ENDPOINTS.channels);
  }

  async channelCreate(_input: ChannelCreateInput): Promise<{ channelId: number }> {
    throw new AppError(ErrorCode.TS3_UNSUPPORTED, 'WebQuery channel mutations require verified mappings; use ServerQuery or the mock client', { httpStatus: 501 });
  }

  async channelEdit(_input: ChannelEditInput): Promise<{ ok: true }> {
    throw new AppError(ErrorCode.TS3_UNSUPPORTED, 'WebQuery channel mutations require verified mappings; use ServerQuery or the mock client', { httpStatus: 501 });
  }

  async channelDelete(_input: ChannelDeleteInput): Promise<{ ok: true }> {
    throw new AppError(ErrorCode.TS3_UNSUPPORTED, 'WebQuery channel mutations require verified mappings; use ServerQuery or the mock client', { httpStatus: 501 });
  }

  async channelMove(_input: ChannelMoveInput): Promise<{ ok: true }> {
    throw new AppError(ErrorCode.TS3_UNSUPPORTED, 'WebQuery channel mutations require verified mappings; use ServerQuery or the mock client', { httpStatus: 501 });
  }

  async kickClient(_input: KickInput): Promise<{ ok: true }> {
    throw new AppError(ErrorCode.TS3_UNSUPPORTED, 'WebQuery client actions require verified mappings; use ServerQuery or the mock client', { httpStatus: 501 });
  }

  async banClient(_input: BanInput): Promise<{ ok: true }> {
    throw new AppError(ErrorCode.TS3_UNSUPPORTED, 'WebQuery client actions require verified mappings; use ServerQuery or the mock client', { httpStatus: 501 });
  }

  async moveClient(_input: MoveInput): Promise<{ ok: true }> {
    throw new AppError(ErrorCode.TS3_UNSUPPORTED, 'WebQuery client actions require verified mappings; use ServerQuery or the mock client', { httpStatus: 501 });
  }

  async pokeClient(_input: PokeInput): Promise<{ ok: true }> {
    throw new AppError(ErrorCode.TS3_UNSUPPORTED, 'WebQuery client actions require verified mappings; use ServerQuery or the mock client', { httpStatus: 501 });
  }
}
