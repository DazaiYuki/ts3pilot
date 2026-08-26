import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface LogFileResult {
  file: string;
  lines: string[];
}

export function readLogFiles(directory: string, maxLines: number): LogFileResult[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(directory).filter((name) => name.endsWith('.log'));
  } catch {
    return [];
  }
  entries.sort((left, right) => statSync(join(directory, right)).mtimeMs - statSync(join(directory, left)).mtimeMs);
  const results: LogFileResult[] = [];
  let remaining = maxLines;
  for (const name of entries) {
    if (remaining <= 0) break;
    const filePath = join(directory, name);
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
    const taken = lines.slice(-remaining);
    results.push({ file: name, lines: taken });
    remaining -= taken.length;
  }
  return results;
}

export function mockLogLines(maxLines: number): string[] {
  const lines: string[] = [];
  const now = Date.now();
  for (let i = 1; i <= maxLines; i += 1) {
    const timestamp = new Date(now - (maxLines - i) * 60000).toISOString();
    lines.push(`${timestamp} mock log line ${i}: development mock provider (no real TS3 log available)`);
  }
  return lines;
}
