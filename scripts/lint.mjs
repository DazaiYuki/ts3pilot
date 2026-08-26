import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SKIP = new Set(['node_modules', 'dist', 'vendor', '.git', '.npm-cache', 'tmp', 'build']);
const FORBIDDEN = [
  [/child_process/, 'child_process must only be used inside system/processRunner.ts'],
  [/execSync/, 'execSync is forbidden'],
  [/\bexec\(/, 'exec( is forbidden'],
  [/shell_exec/, 'shell_exec is forbidden'],
  [/\bany\b\s*[);,\]}]/, 'explicit any is forbidden'],
];

const errors = [];
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (extname(full) === '.ts' || extname(full) === '.mjs') files.push(full);
  }
}

walk(ROOT);

for (const file of files) {
  const src = readFileUtf8(file);
  const relative = file.replace(ROOT, '').replace(/^[\\/]/, '');
  if (src.includes('\t')) errors.push(`${relative}: contains tab characters`);
  if (/\s+$/.test(src)) errors.push(`${relative}: trailing whitespace`);
  if (relative.includes('processRunner') === false) {
    for (const [re, msg] of FORBIDDEN) {
      if (re.test(src)) errors.push(`${relative}: ${msg}`);
    }
  }
  if (relative.startsWith('packages') && !relative.endsWith('index.ts')) {
    if (/console\.(log|error)\(/.test(src)) errors.push(`${relative}: use the structured logger instead of console`);
  }
}

function readFileUtf8(p) {
  return readFileSync(p, 'utf8');
}

if (errors.length) {
  console.error(`lint: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`lint: OK (${files.length} files checked)`);
}
