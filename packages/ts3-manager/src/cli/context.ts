import { defaultConfigPath, ensureConfig, readConfig } from '../config/config.ts';
import type { AppConfig } from '../domain/schemas.ts';
import { createLogger, type Logger } from '../logging/logger.ts';
import { createServiceManager } from '../system/factory.ts';
import type { ServiceManager } from '../system/serviceManager.ts';
import { createTs3Client } from '../ts3/factory.ts';
import type { TeamSpeakClient } from '../ts3/teamSpeakClient.ts';

export interface CliContext {
  cfgPath: string;
  config: AppConfig;
  logger: Logger;
  services: ServiceManager;
  ts3(): TeamSpeakClient;
}

export function createCliContext(options: { configPath?: string } = {}): CliContext {
  const cfgPath = options.configPath ?? defaultConfigPath();
  const config = ensureConfig(cfgPath);
  const logger = createLogger(config.logging.level, config.logging.json, { nodeId: config.nodeId });
  const services = createServiceManager(config, logger);
  let cachedTs3: TeamSpeakClient | undefined;
  return {
    cfgPath,
    config,
    logger,
    services,
    ts3() {
      if (cachedTs3 === undefined) {
        cachedTs3 = createTs3Client(readConfig(cfgPath), logger);
      }
      return cachedTs3;
    },
  };
}
