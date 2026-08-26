import { existsSync } from 'node:fs';
import { updateConfig } from '../../config/config.ts';
import { ALL_CAPABILITIES, HIGH_RISK_CAPABILITIES, isCapability } from '../../domain/capabilities.ts';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import { AGENT_HOST_DEFAULT, PORT_AGENT_DEFAULT } from '../../domain/schemas.ts';
import { createPairingState, generatePairingCode, pairingMatches } from '../../security/pairing.ts';
import { randomToken } from '../../security/secrets.ts';
import { flagBool, flagNumber, flagString, hasFlag } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

const TS3_PORTS = [9987, 30033, 10011, 10022, 10080, 10443];

export function runApiCommand(ctx: CliContext, positionals: readonly string[], flags: Record<string, string | boolean>): void {
  const sub = positionals[0];
  switch (sub) {
    case 'status':
      apiStatus(ctx);
      return;
    case 'enable':
      apiEnable(ctx, flags);
      return;
    case 'disable':
      apiDisable(ctx);
      return;
    case 'pair':
      apiPair(ctx, flags);
      return;
    case 'rotate-secret':
      apiRotateSecret(ctx);
      return;
    case 'unpair':
      apiUnpair(ctx);
      return;
    default:
      throw new AppError(ErrorCode.USER, 'usage: api <enable|disable|status|pair|rotate-secret|unpair>');
  }
}

function apiStatus(ctx: CliContext): void {
  const agent = ctx.config.agent;
  printLine(`enabled: ${agent.enabled}`);
  printLine(`node_id: ${ctx.config.nodeId}`);
  printLine(`mode: ${ctx.config.mode}`);
  printLine(`listen: ${agent.host}:${agent.port}`);
  printLine(`remote_mode: ${agent.remoteMode}`);
  printLine(`auth: ${agent.credential.length > 0 ? 'paired' : agent.pairing ? 'pairing-pending' : 'off'}`);
  printLine(`capabilities: ${agent.capabilities.join(', ')}`);
  printLine(`system_provider: ${ctx.services.providerName}`);
}

function apiEnable(ctx: CliContext, flags: Record<string, string | boolean>): void {
  const host = flagString(flags, 'host') ?? AGENT_HOST_DEFAULT;
  const port = flagNumber(flags, 'port') ?? PORT_AGENT_DEFAULT;
  const remote = flagBool(flags, 'remote');
  if ((host === '0.0.0.0' || host === '::') && !remote) {
    throw new AppError(
      ErrorCode.USER,
      `Binding ${host} exposes the agent API to the network. Use --remote only as an explicit advanced deployment mode with TLS/reverse proxy in front.`,
    );
  }
  if (TS3_PORTS.includes(port)) {
    throw new AppError(
      ErrorCode.USER,
      `Port ${port} is reserved for TeamSpeak (voice/file-transfer/query/webquery). Choose a dedicated agent port (default 17880).`,
    );
  }

  const capabilities = new Set(ctx.config.agent.capabilities);
  const capFlags = collectCapFlags(flags);
  for (const cap of capFlags) capabilities.add(cap);
  if (flagBool(flags, 'high-risk')) {
    for (const cap of HIGH_RISK_CAPABILITIES) capabilities.add(cap);
  }
  if (hasFlag(flags, 'cap-all') && flagBool(flags, 'cap-all')) {
    for (const cap of ALL_CAPABILITIES) capabilities.add(cap);
  }

  if (ctx.config.agent.credential.length > 0) {
    throw new AppError(ErrorCode.USER, 'Agent is already paired; use api rotate-secret or api unpair first');
  }

  const code = generatePairingCode();
  updateConfig(ctx.cfgPath, (config) => ({
    ...config,
    mode: flagString(flags, 'mode') === undefined ? config.mode : (flagString(flags, 'mode') as typeof config.mode),
    agent: {
      ...config.agent,
      enabled: true,
      host,
      port,
      remoteMode: remote,
      pairing: createPairingState(code),
      capabilities: [...capabilities].sort(),
    },
  }));

  printLine('Agent API enabled (listening requires: ts3-manager agent)');
  printLine(`node_id: ${ctx.config.nodeId}`);
  printLine(`endpoint: http://${host}:${port}`);
  printLine(`mode: ${remote ? 'REMOTE (advanced, ensure TLS/reverse proxy)' : 'localhost (default, safe)'}`);
  printLine('');
  printLine(`pairing code (valid 15 minutes, single use): ${code}`);
  printLine('Enter this code in the WordPress plugin settings to complete pairing.');
}

function collectCapFlags(flags: Record<string, string | boolean>): string[] {
  const caps: string[] = [];
  for (const [key, value] of Object.entries(flags)) {
    if (key === 'cap' && typeof value === 'string') {
      if (!isCapability(value)) throw new AppError(ErrorCode.USER, `Unknown capability: ${value}`);
      caps.push(value);
    }
  }
  return caps;
}

function apiPair(ctx: CliContext, flags: Record<string, string | boolean>): void {
  const code = flagString(flags, 'code');
  if (code === undefined) throw new AppError(ErrorCode.USER, 'usage: api pair --code <pairing-code>');
  const pairing = ctx.config.agent.pairing;
  if (pairing === undefined || !pairingMatches(pairing, code)) {
    throw new AppError(ErrorCode.USER, 'Invalid or expired pairing code');
  }
  const credential = randomToken();
  updateConfig(ctx.cfgPath, (config) => ({
    ...config,
    agent: { ...config.agent, pairing: undefined, credential },
  }));
  printLine('Pairing completed.');
  printLine(`node_id: ${ctx.config.nodeId}`);
  printLine(`credential (show once, keep secret): ${credential}`);
}

function apiRotateSecret(ctx: CliContext): void {
  if (ctx.config.agent.credential.length === 0) {
    throw new AppError(ErrorCode.USER, 'Agent is not paired');
  }
  const credential = randomToken();
  updateConfig(ctx.cfgPath, (config) => ({
    ...config,
    agent: { ...config.agent, credential },
  }));
  printLine('Credential rotated. Update the WordPress plugin with the new credential (shown once).');
  printLine(`credential: ${credential}`);
}

function apiUnpair(ctx: CliContext): void {
  updateConfig(ctx.cfgPath, (config) => ({
    ...config,
    agent: { ...config.agent, credential: '', pairing: undefined },
  }));
  printLine('Agent unpaired; long-term credential revoked.');
}

function apiDisable(ctx: CliContext): void {
  updateConfig(ctx.cfgPath, (config) => ({
    ...config,
    agent: { ...config.agent, enabled: false, credential: '', pairing: undefined },
  }));
  printLine('Agent API disabled and credential revoked. Restart any running agent process to stop listening.');
}

export function configExists(ctx: CliContext): boolean {
  return existsSync(ctx.cfgPath);
}
