import { join } from 'node:path';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import { createBackupArchive, DEFAULT_BACKUP_INCLUDES, restoreBackupArchive } from '../../system/backupEngine.ts';
import { flagBool, flagString } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runBackupCommand(ctx: CliContext, flags: Record<string, string | boolean>): Promise<void> {
  const rootDir = ctx.config.ts3.installPath;
  if (rootDir.length === 0) {
    throw new AppError(ErrorCode.USER, 'Backup requires ts3.installPath to be configured');
  }
  const include = (flagString(flags, 'include') ?? '').split(',').filter((entry) => entry.length > 0);
  const dest = flagString(flags, 'dest') ?? join(ctx.config.dataDir, 'backups', `ts3-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`);
  const manifest = await createBackupArchive({
    rootDir,
    include: include.length > 0 ? include : DEFAULT_BACKUP_INCLUDES,
    archivePath: dest,
  });
  printLine(`backup archive created: ${dest}`);
  printLine(`files: ${manifest.files.length}`);
  printLine(`created_at: ${manifest.createdAt}`);
}

export async function runRestoreCommand(ctx: CliContext, flags: Record<string, string | boolean>): Promise<void> {
  const archivePath = flagString(flags, 'backup');
  if (archivePath === undefined) throw new AppError(ErrorCode.USER, 'Restore requires --backup <archive.tar.gz>');
  const allowedRoot = ctx.config.ts3.installPath;
  if (allowedRoot.length === 0) throw new AppError(ErrorCode.USER, 'Restore requires ts3.installPath to be configured');
  const dest = flagString(flags, 'dest') ?? allowedRoot;

  const dryRun = !flagBool(flags, 'force');
  if (!dryRun && ctx.config.mode === 'development' && process.env.TS3_MANAGER_ALLOW_DESTRUCTIVE !== '1') {
    throw new AppError(
      ErrorCode.USER,
      'Restore is destructive and disabled in development mode. Set TS3_MANAGER_ALLOW_DESTRUCTIVE=1 only in an isolated test environment.',
    );
  }
  const result = await restoreBackupArchive({
    archivePath,
    targetRoot: dest,
    allowedRoot,
    dryRun,
    force: !dryRun,
  });
  if (result.dryRun) {
    printLine(result.ok ? 'dry-run preflight passed' : 'dry-run preflight failed');
  } else {
    printLine(result.ok ? `restored ${result.restoredFiles.length} file(s) to ${dest}` : 'restore failed');
  }
  for (const error of result.errors) printLine(`  error: ${error}`);
  if (!result.ok) {
    throw new AppError(ErrorCode.USER, 'Restore preflight or execution failed');
  }
}
