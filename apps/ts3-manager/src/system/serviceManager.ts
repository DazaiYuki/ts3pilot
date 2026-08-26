import type { ServiceStatus } from '../domain/models.ts';

export interface ServiceManager {
  readonly providerName: string;
  isAvailable(): Promise<boolean>;
  start(): Promise<ServiceStatus>;
  stop(): Promise<ServiceStatus>;
  restart(): Promise<ServiceStatus>;
  status(): Promise<ServiceStatus>;
}
