import { AppError, ErrorCode } from '../domain/errors.ts';
import type { AppConfig } from '../domain/schemas.ts';
import type { Logger } from '../logging/logger.ts';
import { MockTeamSpeakClient } from './mock.ts';
import { ServerQueryTeamSpeakClient } from './serverQuery.ts';
import type { TeamSpeakClient } from './teamSpeakClient.ts';
import { WebQueryTeamSpeakClient } from './webQuery.ts';

export function createTs3Client(config: AppConfig, logger: Logger): TeamSpeakClient {
  const webQuery = config.ts3.query.webQuery;
  const hasServerQueryCredentials = config.ts3.query.username.length > 0 && config.ts3.query.password.length > 0;

  if (webQuery.enabled && webQuery.verified) {
    logger.info('TS3 client: WebQuery');
    return new WebQueryTeamSpeakClient(config);
  }
  if (hasServerQueryCredentials) {
    logger.info('TS3 client: ServerQuery');
    return new ServerQueryTeamSpeakClient(config);
  }
  if (config.mode === 'production') {
    throw new AppError(
      ErrorCode.CONFIG,
      'Production mode requires a verified TS3 connection (WebQuery verified or ServerQuery credentials)',
    );
  }
  logger.warn('No verified TS3 connection configured; using mock TeamSpeak client (development only)');
  return new MockTeamSpeakClient();
}
