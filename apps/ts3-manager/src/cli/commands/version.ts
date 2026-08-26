import { readFileSync } from 'node:fs';
import { AUTH_PROTOCOL_VERSION } from '../../security/hmac.ts';
import { printLine } from '../print.ts';

export function runVersionCommand(): void {
  const packageJson = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  printLine(`ts3-manager ${packageJson.version}`);
  printLine(`agent protocol v${AUTH_PROTOCOL_VERSION}`);
  printLine(`node ${process.version} on ${process.platform}`);
}
