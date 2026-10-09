import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { downloadFile } from '../src/services/download.ts';
import { cleanupDir, tempDir } from './util.ts';

test('download bounds streamed responses and removes oversized partial files', async () => {
  const dir = tempDir('download-limit'); const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('123456789');
    const path = join(dir, 'archive');
    await assert.rejects(downloadFile('https://example.invalid/archive', path, 8), /exceeds/);
    assert.equal(existsSync(path), false);
    globalThis.fetch = async () => new Response('12345678');
    await downloadFile('https://example.invalid/archive', path, 8);
    assert.equal(readFileSync(path, 'utf8'), '12345678');
    globalThis.fetch = async () => new Response('x', { headers: { 'content-length': '100' } });
    await assert.rejects(downloadFile('https://example.invalid/archive', join(dir, 'too-large'), 8), /too large/);
  } finally { globalThis.fetch = original; cleanupDir(dir); }
});
