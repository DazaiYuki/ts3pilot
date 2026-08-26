import { AppError, ErrorCode } from '../../domain/errors.ts';
import { flagBool } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export function runInstallCommand(ctx: CliContext, flags: Record<string, string | boolean>): void {
  const install = ctx.config.ts3.install;
  const steps = [
    `1. Verify official TeamSpeak source (URL + SHA-256) and license terms; no URL is hard-coded in this project.`,
    `2. Create a dedicated unprivileged system user (e.g. ts3) owning ${ctx.config.ts3.installPath || '<installPath>'}.`,
    `3. Download the verified tarball from the configured source and verify SHA-256.`,
    `4. Extract into the install path and set restrictive file permissions.`,
    `5. Install a hardened systemd unit (dedicated user, NoNewPrivileges, PrivateTmp, ProtectSystem=full).`,
    `6. Enable and start the unit; run 'ts3-manager doctor' to verify.`,
  ];
  for (const step of steps) printLine(step);

  if (!flagBool(flags, 'execute')) {
    printLine('');
    printLine('Plan only. Re-run with --execute to perform installation (Linux only).');
    return;
  }
  if (process.platform === 'win32') {
    throw new AppError(ErrorCode.UNSUPPORTED_PLATFORM, 'Install requires Linux; use the mock provider on Windows for development.');
  }
  if (!install.verified || install.sourceUrl.length === 0 || install.sha256.length === 0) {
    throw new AppError(
      ErrorCode.NOT_IMPLEMENTED,
      'Installation execution requires a verified official source (ts3.install.sourceUrl + sha256 + verified=true). ' +
        'Verify against official TeamSpeak documentation before enabling; the download/verify/extract pipeline is the next implementation milestone.',
    );
  }
  throw new AppError(ErrorCode.NOT_IMPLEMENTED, 'Installation execution pipeline is planned; only the plan is available in this MVP.');
}
