import { join } from 'node:path';
import { AppError, ErrorCode } from '../../domain/errors.ts';
import { backupDirName, createBackup, executeRestore, planRestore } from '../../services/backup.ts';
import { flagBool, flagString } from '../args.ts';
import type { CliContext } from '../context.ts';
import { printLine } from '../print.ts';

export async function runBackupCommand(ctx: CliContext, flags: Record<string, string | boolean>): Promise<void> {
  const source = flagString(flags, 'source') ?? ctx.config.ts3.installPath;
  if (source.length === 0) {
    throw new AppError(ErrorCode.USER, 'Backup source required: configure ts3.installPath or pass --source');
  }
  const dest = flagString(flags, 'dest') ?? join(ctx.config.dataDir, 'backups', backupDirName());
  const manifest = await createBackup(source, dest);
  printLine(`backup created at ${dest}`);
  printLine(`files: ${manifest.files.length}`);
  printLine(`source: ${manifest.sourceDir}`);
}

export async function runRestoreCommand(ctx: CliContext, flags: Record<string, string | boolean>): Promise<void> {
  const backupDir = flagString(flags, 'backup');
  if (backupDir === undefined) throw new AppError(ErrorCode.USER, 'Restore requires --backup <directory>');
  const dest = flagString(flags, 'dest') ?? ctx.config.ts3.installPath;
  if (dest.length === 0) throw new AppError(ErrorCode.USER, 'Restore destination required: configure ts3.installPath or pass --dest');

  if (flagBool(flags, 'dry-run') || !flagBool(flags, 'force')) {
    const plan = await planRestore(backupDir, dest);
    printLine(`dry-run restore plan: ${plan.files.length} file(s) -> ${plan.destDir}`);
    if (plan.files.length <= 20) {
      for (const file of plan.files) printLine(`  ${file}`);
    }
    printLine('re-run with --force to apply (destructive, audited operation)');
    return;
  }

  if (ctx.config.mode === 'development' && process.env.TS3_MANAGER_ALLOW_DESTRUCTIVE !== '1') {
    throw new AppError(
      ErrorCode.USER,
      'Restore is destructive and disabled in development mode. Set TS3_MANAGER_ALLOW_DESTRUCTIVE=1 only in an isolated test environment.',
    );
  }
  const plan = await executeRestore(backupDir, dest);
  printLine(`restored ${plan.files.length} file(s) to ${plan.destDir}`);
}
