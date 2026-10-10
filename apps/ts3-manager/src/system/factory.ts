import type { AppConfig } from '../domain/schemas.ts';
import type { Logger } from '../logging/logger.ts';
import type { ServiceManager } from './serviceManager.ts';
import { MockServiceManager } from './providers/mock.ts';
import { ScriptServiceManager } from './providers/script.ts';
import { SystemdServiceManager } from './providers/systemd.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function createServiceManager(config: AppConfig, logger: Logger): ServiceManager {
  if (config.system.provider === 'mock') {
    logger.info('Service provider: mock (explicit)');
    return new MockServiceManager(config);
  }
  if (process.platform === 'win32') {
    logger.warn('Windows development environment: using mock ServiceManager (systemd/script providers are Linux-only)');
    return new MockServiceManager(config);
  }
  if (config.system.provider === 'systemd') return new SystemdServiceManager(config);
  if (config.system.provider === 'script') return new ScriptServiceManager(config);
  const unitPresent = ['/etc/systemd/system', '/usr/lib/systemd/system', '/lib/systemd/system'].some(path => existsSync(join(path, config.system.unitName)));
  const local = config.ts3.deployment.kind === 'native' || (config.ts3.deployment.kind === 'auto' && ['localhost', '127.0.0.1', '::1'].includes(config.ts3.query.host));
  if (!unitPresent && local && config.ts3.installPath && existsSync(join(config.ts3.installPath, config.ts3.startScript))) {
    logger.info('Service provider: auto -> script for existing standalone installation');
    return new ScriptServiceManager(config);
  }
  logger.info('Service provider: auto -> systemd on Linux');
  return new SystemdServiceManager(config);
}
