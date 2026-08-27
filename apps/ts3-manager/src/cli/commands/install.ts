import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import {
  DEFAULT_TS3_VERSION,
  MAX_ARCHIVE_BYTES,
  runInstall,
  type InstallerDependencies,
} from '../../services/installer.ts';
import { runProcess } from '../../system/processRunner.ts';
import { flagBool, flagString } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runInstallCommand(ctx: CliContext, flags: Record<string, string | boolean>): Promise<void> {
  const version = flagString(flags, 'version') ?? DEFAULT_TS3_VERSION;
  const installPath = flagString(flags, 'install-path') ?? ctx.config.ts3.installPath;
  const acceptEula = flagBool(flags, 'accept-eula');
  const setupFirewall = flagBool(flags, 'setup-firewall');

  if (!acceptEula) {
    printLine('');
    printLine('============================================================');
    printLine('  请阅读 TeamSpeak 官方许可协议（EULA），并确认你同意其条款。');
    printLine('  Please read the TeamSpeak EULA and confirm you accept it.');
    printLine('  确认后使用 --accept-eula 参数重新执行安装。');
    printLine('============================================================');
    printLine('');
    throw new AppError(ErrorCode.USER, 'EULA not accepted; pass --accept-eula to proceed');
  }
  if (installPath.length === 0) {
    throw new AppError(ErrorCode.USER, 'install requires --install-path or a configured ts3.installPath');
  }

  const deps: InstallerDependencies = {
    platform: process.platform,
    mode: ctx.config.mode,
    logger: ctx.logger,
    runProcess: (bin, args, opts) => runProcess(bin, args, opts),
    download: downloadFile,
  };

  const result = await runInstall(
    {
      version,
      installPath,
      acceptEula,
      setupFirewall,
      sourceUrl: flagString(flags, 'source-url') ?? (ctx.config.ts3.install.sourceUrl.length > 0 ? ctx.config.ts3.install.sourceUrl : undefined),
      expectedSha256: flagString(flags, 'expected-sha256') ?? (ctx.config.ts3.install.sha256.length > 0 ? ctx.config.ts3.install.sha256 : undefined),
      force: flagBool(flags, 'force'),
      user: flagString(flags, 'user') ?? 'ts3',
      group: flagString(flags, 'group') ?? 'ts3',
    },
    deps,
  );

  printLine(result.mocked ? 'install (mock): completed in development/mock mode' : 'install completed');
  printLine(`version: ${result.version}`);
  printLine(`install_path: ${result.installPath}`);
  printLine(`eula accepted: ${result.eulaAccepted ? 'yes' : 'no'}`);
  printLine(`download_url: ${result.downloadUrl ?? '(mock)'}`);
  if (result.firewall.tool !== 'none') {
    printLine(`firewall (${result.firewall.tool}): ${result.firewall.opened.join(', ')}`);
  } else {
    printLine('firewall: skipped (use --setup-firewall on Linux with ufw/firewalld)');
  }
  if (result.systemdUnit !== undefined) {
    printLine('');
    printLine('Generated ts3server.service (hardened unit):');
    printLine(result.systemdUnit);
    printLine('Next steps:');
    printLine(`  1. chown -R ts3:ts3 ${result.installPath}`);
    printLine('  2. Save the unit above to /etc/systemd/system/ts3server.service');
    printLine('  3. systemctl daemon-reload && systemctl enable --now ts3server.service');
    printLine('  4. Run "ts3-manager doctor" to verify.');
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok || response.body === null) {
    throw new AppError(ErrorCode.NETWORK, `Download failed: HTTP ${response.status} for ${url}`, { httpStatus: 502 });
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_ARCHIVE_BYTES) {
    throw new AppError(ErrorCode.VALIDATION, `Archive too large (${contentLength} bytes)`);
  }
  const body = response.body as unknown as import('node:stream/web').ReadableStream;
  await pipeline(Readable.fromWeb(body), createWriteStream(destPath));
}
