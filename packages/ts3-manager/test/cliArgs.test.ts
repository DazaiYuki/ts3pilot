import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs } from '../src/cli/args.ts';

test('parseArgs handles flags, values and positionals', () => {
  const parsed = parseArgs(['api', 'enable', '--host', '127.0.0.1', '--port=18080', '--high-risk']);
  assert.deepEqual(parsed.positionals, ['api', 'enable']);
  assert.equal(parsed.flags.host, '127.0.0.1');
  assert.equal(parsed.flags.port, '18080');
  assert.equal(parsed.flags['high-risk'], true);
});

test('parseArgs stops flag parsing after --', () => {
  const parsed = parseArgs(['logs', '--', '--lines']);
  assert.deepEqual(parsed.positionals, ['logs', '--lines']);
});
