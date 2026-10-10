import { join } from 'node:path';
import { accessSync, constants } from 'node:fs';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import type { ServiceStatus } from '../../domain/models.ts';
import type { AppConfig } from '../../domain/schemas.ts';
import { runProcess } from '../processRunner.ts';
import type { ServiceManager } from '../serviceManager.ts';

export class ScriptServiceManager implements ServiceManager {
  readonly providerName = 'script';
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private scriptPath(): string {
    if (!this.config.ts3.installPath) {
      throw new AppError(ErrorCode.CONFIG, 'ts3.installPath is not configured');
    }
    return join(this.config.ts3.installPath, this.config.ts3.startScript);
  }

  private guard(): void {
    if (process.platform === 'win32') {
      throw new AppError(ErrorCode.UNSUPPORTED_PLATFORM, 'script provider is only available on Linux');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (process.platform === 'win32') return false;
    try { accessSync(this.scriptPath(), constants.X_OK); return true; } catch { return false; }
  }

  private async run(verb: 'start' | 'stop' | 'restart' | 'status'): Promise<ServiceStatus> {
    this.guard();
    const result = await runProcess(this.scriptPath(), [verb], { cwd: this.config.ts3.installPath, timeoutMs: 60000 });
    if (result.exitCode !== 0) {
      throw new AppError(ErrorCode.SYSTEM, `${this.scriptPath()} ${verb} failed: ${result.stderr.trim() || `exit ${result.exitCode}`}`);
    }
    return this.status();
  }

  async start(): Promise<ServiceStatus> {
    return this.run('start');
  }

  async stop(): Promise<ServiceStatus> {
    return this.run('stop');
  }

  async restart(): Promise<ServiceStatus> {
    return this.run('restart');
  }

  async status(): Promise<ServiceStatus> {
    this.guard();
    const result = await runProcess(this.scriptPath(), ['status'], { cwd: this.config.ts3.installPath, timeoutMs: 15000 });
    const message = (result.stdout || result.stderr).trim();
    const stopped = /server is not running|no server running/i.test(message);
    const running = /server is running/i.test(message);
    const pid = message.match(/PID\s*:?\s*(\d+)/i)?.[1];
    return { state: result.timedOut || result.overflow ? 'unknown' : stopped ? 'stopped' : running && result.exitCode === 0 ? 'running' : 'unknown',
      provider: this.providerName, pid: running && pid ? Number(pid) : undefined, message: message || undefined };
  }
}
