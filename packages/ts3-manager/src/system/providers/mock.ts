import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ServiceStatus } from '../../domain/models.ts';
import type { AppConfig } from '../../domain/schemas.ts';
import type { ServiceManager } from '../serviceManager.ts';

interface MockState {
  state: ServiceStatus['state'];
  pid: number;
  startedAt: number;
}

export class MockServiceManager implements ServiceManager {
  readonly providerName = 'mock';
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  private statePath(): string {
    return join(this.config.dataDir, 'state', 'mock-service.json');
  }

  private readState(): MockState {
    const path = this.statePath();
    if (!existsSync(path)) {
      return { state: 'stopped', pid: 0, startedAt: 0 };
    }
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<MockState>;
      return {
        state: parsed.state ?? 'stopped',
        pid: parsed.pid ?? 0,
        startedAt: parsed.startedAt ?? 0,
      };
    } catch {
      return { state: 'stopped', pid: 0, startedAt: 0 };
    }
  }

  private writeState(state: MockState): void {
    const path = this.statePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private toStatus(state: MockState): ServiceStatus {
    const uptimeSec = state.startedAt > 0 ? Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)) : undefined;
    return {
      state: state.state,
      provider: this.providerName,
      pid: state.pid > 0 ? state.pid : undefined,
      uptimeSec,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async start(): Promise<ServiceStatus> {
    const current = this.readState();
    if (current.state === 'running') return this.toStatus(current);
    const next: MockState = { state: 'running', pid: 40000 + Math.floor(Math.random() * 1000), startedAt: Date.now() };
    this.writeState(next);
    return this.toStatus(next);
  }

  async stop(): Promise<ServiceStatus> {
    const next: MockState = { state: 'stopped', pid: 0, startedAt: 0 };
    this.writeState(next);
    return this.toStatus(next);
  }

  async restart(): Promise<ServiceStatus> {
    await this.stop();
    return this.start();
  }

  async status(): Promise<ServiceStatus> {
    return this.toStatus(this.readState());
  }
}
