export interface Ts3ServerStatus {
  online: boolean;
  name?: string;
  clientsOnline?: number;
  maxClients?: number;
  version?: string;
  platform?: string;
  uptimeSec?: number;
  mock?: boolean;
}

export interface Ts3Client {
  clientId: number;
  nickname: string;
  channelId: number;
  clientType: number;
  uniqueId?: string;
  away?: boolean;
}

export interface Ts3Channel {
  channelId: number;
  name: string;
  parentId: number;
  order?: number;
  totalClients?: number;
  topic?: string;
}

export type ServiceState = 'running' | 'stopped' | 'starting' | 'stopping' | 'unknown';

export interface ServiceStatus {
  state: ServiceState;
  provider: string;
  pid?: number;
  uptimeSec?: number;
  message?: string;
}

export interface ApiStatusInfo {
  enabled: boolean;
  host: string;
  port: number;
  nodeId: string;
  authEnabled: boolean;
  capabilities: readonly string[];
  remoteMode: boolean;
  provider: string;
}

export interface HealthInfo {
  status: 'ok';
  service: 'ts3-agent';
  protocolVersion: number;
  nodeId: string;
  mode: string;
  systemProvider: string;
  ts3Provider: string;
}
