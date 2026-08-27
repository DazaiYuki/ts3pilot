import { join } from 'node:path';
import type { AppConfig, DeploymentKind } from '../domain/schemas.ts';

export type DeploymentMode = 'native' | 'docker' | 'remote' | 'unknown';

export interface DeploymentCapabilities {
  /** ServerQuery / WebQuery network operations (status, clients, channels, kicks). */
  serverQuery: boolean;
  /** Local filesystem access to the TS3 install (backup, restore, logs, install). */
  filesystem: boolean;
  /** Optional Docker exec/cp bridge configured by the user. */
  dockerExec: boolean;
  /** A fresh TS3 server can be installed on this host by the CLI. */
  install: boolean;
}

export interface DeploymentProfile {
  mode: DeploymentMode;
  kind: DeploymentKind | 'unknown';
  capabilities: DeploymentCapabilities;
  dockerContainer?: string;
  details: string[];
}

export interface DeploymentDependencies {
  config: AppConfig;
  platform: NodeJS.Platform;
  fileExists(path: string): boolean;
  runCommand(command: string, args: readonly string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', '::1', 'localhost']);

/**
 * Detect how the managed TS3 instance is deployed relative to this host.
 *
 * - native:  TS3 binary + files live on this machine (classic install / systemd).
 * - docker:  TS3 runs in a container reachable on loopback; query works, files
 *            require a host volume path or `docker cp`.
 * - remote:  TS3 ServerQuery is pointed at a non-loopback host; query works,
 *            filesystem operations are unavailable on this host.
 * - unknown: no signal yet (fresh setup, mock mode).
 */
export async function detectDeployment(deps: DeploymentDependencies): Promise<DeploymentProfile> {
  const config = deps.config;
  const explicit = config.ts3.deployment.kind;
  if (explicit !== 'auto') {
    return profileFor(explicit, config.ts3.deployment.dockerContainer, config, [
      `explicit deployment kind '${explicit}' from config`,
    ]);
  }

  const queryHost = config.ts3.query.host.trim().toLowerCase();
  if (queryHost.length > 0 && !LOOPBACK_HOSTS.has(queryHost)) {
    return {
      mode: 'remote',
      kind: 'remote',
      capabilities: { serverQuery: true, filesystem: false, dockerExec: false, install: false },
      details: [
        `ServerQuery host ${config.ts3.query.host} is not loopback; treating TS3 as remote.`,
        'Query operations work through the Agent; backup/restore/install/systemd need the TS3 host itself.',
      ],
    };
  }

  const installPath = config.ts3.installPath;
  const hasNativeBinary = installPath.length > 0 && deps.fileExists(join(installPath, 'ts3server'));
  if (hasNativeBinary) {
    return profileFor('native', '', config, ['ts3server binary found in ts3.installPath']);
  }

  const configuredContainer = config.ts3.deployment.dockerContainer.trim();
  if (configuredContainer.length > 0) {
    return profileFor('docker', configuredContainer, config, ['docker container name/id from config']);
  }

  try {
    const result = await deps.runCommand('docker', ['ps', '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Ports}}']);
    if (result.exitCode === 0) {
      const container = findTs3Container(result.stdout);
      if (container !== undefined) {
        return profileFor('docker', container, config, ['TeamSpeak container detected via `docker ps`']);
      }
    }
  } catch {
    // docker CLI is not available or not running; fall through.
  }

  return {
    mode: 'unknown',
    kind: 'unknown',
    capabilities: { serverQuery: false, filesystem: false, dockerExec: false, install: false },
    details: [
      installPath.length > 0
        ? `ts3.installPath is set (${installPath}) but no ts3server binary or Docker container was found`
        : 'ts3.installPath is empty and no Docker container was found (development/mock mode)',
    ],
  };
}

function profileFor(
  kind: Exclude<DeploymentKind, 'auto'>,
  dockerContainer: string,
  config: AppConfig,
  details: string[],
): DeploymentProfile {
  switch (kind) {
    case 'native':
      return {
        mode: 'native',
        kind,
        capabilities: { serverQuery: true, filesystem: true, dockerExec: false, install: true },
        details: [...details, 'Full local control: query, backup, restore, logs, install and systemd are available.'],
      };
    case 'docker':
      return {
        mode: 'docker',
        kind,
        dockerContainer,
        capabilities: { serverQuery: true, filesystem: false, dockerExec: true, install: false },
        details: [
          ...details,
          'Query operations work over the mapped ServerQuery port.',
          'Filesystem operations need a host volume path in ts3.installPath (or a future docker cp bridge).',
        ],
      };
    case 'remote':
      return {
        mode: 'remote',
        kind,
        capabilities: { serverQuery: true, filesystem: false, dockerExec: false, install: false },
        details: [
          ...details,
          `ServerQuery host is ${config.ts3.query.host}; query-only control plane.`,
        ],
      };
    default:
      return {
        mode: 'unknown',
        kind,
        capabilities: { serverQuery: false, filesystem: false, dockerExec: false, install: false },
        details,
      };
  }
}

export function findTs3Container(dockerPsOutput: string): string | undefined {
  for (const line of dockerPsOutput.split(/\r?\n/)) {
    const fields = line.split('\t');
    if (fields.length < 4) continue;
    const [id, name, image, ports] = fields as [string, string, string, string];
    const haystack = `${image} ${ports}`.toLowerCase();
    if (haystack.includes('teamspeak') || haystack.includes('9987/udp') || haystack.includes('10011/tcp')) {
      return name.length > 0 ? name : id;
    }
  }
  return undefined;
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase());
}
