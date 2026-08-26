import { AppError, ErrorCode } from '../domain/errors.ts';

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[name] = next;
        i += 1;
      } else {
        flags[name] = true;
      }
      continue;
    }
    positionals.push(arg);
  }
  return { positionals, flags };
}

export function flagString(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === 'string' ? value : undefined;
}

export function requireFlag(flags: Record<string, string | boolean>, name: string): string {
  const value = flagString(flags, name);
  if (value === undefined) {
    throw new AppError(ErrorCode.USER, `Missing required flag: --${name}`);
  }
  return value;
}

export function flagNumber(flags: Record<string, string | boolean>, name: string): number | undefined {
  const value = flagString(flags, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new AppError(ErrorCode.USER, `Flag --${name} must be an integer`);
  }
  return parsed;
}

export function flagBool(flags: Record<string, string | boolean>, name: string): boolean {
  const value = flags[name];
  return value === true || value === 'true' || value === '1';
}

export function hasFlag(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] !== undefined;
}
