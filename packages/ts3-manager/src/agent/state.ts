import { readConfig, updateConfig, writeConfig } from '../config/config.ts';
import type { AppConfig } from '../domain/schemas.ts';

export class AgentState {
  private readonly configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  load(): AppConfig {
    return readConfig(this.configPath);
  }

  update(updater: (config: AppConfig) => AppConfig): AppConfig {
    return updateConfig(this.configPath, updater);
  }

  save(config: AppConfig): void {
    writeConfig(this.configPath, config);
  }
}
