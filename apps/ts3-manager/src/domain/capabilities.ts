export const Capability = {
  TS3_STATUS: 'ts3.status',
  TS3_CLIENTS_LIST: 'ts3.clients.list',
  TS3_CLIENTS_KICK: 'ts3.clients.kick',
  TS3_CLIENTS_BAN: 'ts3.clients.ban',
  TS3_CLIENTS_MOVE: 'ts3.clients.move',
  TS3_CLIENTS_POKE: 'ts3.clients.poke',
  TS3_CHANNELS_LIST: 'ts3.channels.list',
  TS3_CHANNELS_CREATE: 'ts3.channels.create',
  TS3_CHANNELS_EDIT: 'ts3.channels.edit',
  TS3_CHANNELS_DELETE: 'ts3.channels.delete',
  TS3_CHANNELS_MOVE: 'ts3.channels.move',
  TS3_SERVER_CONFIG_READ: 'ts3.server.config.read',
  TS3_SERVER_CONFIG_WRITE: 'ts3.server.config.write',
  SERVER_START: 'server.start',
  SERVER_STOP: 'server.stop',
  SERVER_RESTART: 'server.restart',
  SERVER_STATUS: 'server.status',
  SERVER_UPDATE: 'server.update',
  SERVER_BACKUP: 'server.backup',
  SERVER_RESTORE: 'server.restore',
  AGENT_PAIR: 'agent.pair',
  AGENT_UNPAIR: 'agent.unpair',
  AGENT_ROTATE_SECRET: 'agent.rotate-secret',
  AGENT_API_DISABLE: 'agent.api.disable',
  IDENTITY_CHALLENGE_REGISTER: 'identity.challenge.register',
} as const;

export type CapabilityValue = (typeof Capability)[keyof typeof Capability];

export const HIGH_RISK_CAPABILITIES: readonly CapabilityValue[] = [
  Capability.SERVER_UPDATE,
  Capability.SERVER_RESTORE,
  Capability.SERVER_RESTART,
];

export const ALL_CAPABILITIES: readonly CapabilityValue[] = Object.values(Capability);

export function isCapability(value: unknown): value is CapabilityValue {
  return typeof value === 'string' && (ALL_CAPABILITIES as readonly string[]).includes(value);
}

export function defaultCapabilities(): CapabilityValue[] {
  const highRisk = HIGH_RISK_CAPABILITIES as readonly string[];
  return ALL_CAPABILITIES.filter((capability) => !highRisk.includes(capability));
}

export function hasCapability(granted: readonly string[], required: string): boolean {
  return granted.includes(required);
}
