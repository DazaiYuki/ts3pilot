import { CLI_VERSION } from '../../version.ts';
import { AUTH_PROTOCOL_VERSION } from '../../security/hmac.ts';
import { printLine } from '../print.ts';

export function runVersionCommand(): void {
  printLine(`ts3pilot ${CLI_VERSION}`);
  printLine(`agent protocol v${AUTH_PROTOCOL_VERSION}`);
  printLine(`node ${process.version} on ${process.platform}`);
}
