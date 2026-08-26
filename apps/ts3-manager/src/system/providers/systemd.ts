import { AppError, ErrorCode } from '../../domain/errors.ts';
import type { ServiceStatus } from '../../domain/models.ts';
import type { AppConfig } from '../../domain/schemas.ts';
import { runProcess } from '../processRunner.ts';
import type { ServiceManager } from '../serviceManager.ts';

export class SystemdServiceManager implements ServiceManager {
  readonly providerName = 'systemd';
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private unitName(): string {
    return this.config.system.unitName;
  }

  private guard(): void {
    if (process.platform === 'win32') {
      throw new AppError(ErrorCode.UNSUPPORTED_PLATFORM, 'systemd provider is only available on Linux');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (process.platform === 'win32') return false;
    try {
      const result = await runProcess('systemctl', ['--version'], { timeoutMs: 5000 });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  private async run(action: 'start' | 'stop' | 'restart'): Promise<ServiceStatus> {
    this.guard();
    const result = await runProcess('systemctl', ['--no-pager', action, this.unitName()], { timeoutMs: 60000 });
    if (result.exitCode !== 0) {
      throw new AppError(ErrorCode.SYSTEM, `systemctl ${action} failed: ${result.stderr.trim() || `exit ${result.exitCode}`}`);
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
    const result = await runProcess('systemctl', ['--no-pager', '--lines=0', 'status', this.unitName()], { timeoutMs: 15000 });
    const active = result.stdout.match(/Active:\s*([a-z()]+)/i)?.[1] ?? '';
    const pid = Number(result.stdout.match(/Main PID:\s*(\d+)/i)?.[1] ?? 0);
    const state: ServiceStatus['state'] = active.includes('running')
      ? 'running'
      : active.includes('dead')
        ? 'stopped'
        : active.includes('activating')
          ? 'starting'
          : active.includes('deactivating')
            ? 'stopping'
            : 'unknown';
    return {
      state,
      provider: this.providerName,
      pid: pid > 0 ? pid : undefined,
      message: result.exitCode === 0 ? undefined : result.stderr.trim() || undefined,
    };
  }
}
