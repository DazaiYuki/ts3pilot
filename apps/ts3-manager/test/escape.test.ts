import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeQueryValue, parseKeyValueLine, splitEntries, unescapeQueryValue } from '../src/ts3/escape.ts';

test('escapeQueryValue escapes TS3 special characters', () => {
  assert.equal(escapeQueryValue('a b'), 'a\\sb');
  assert.equal(escapeQueryValue('a|b'), 'a\\pb');
  assert.equal(escapeQueryValue('a/b'), 'a\\/b');
  assert.equal(escapeQueryValue('a\\b'), 'a\\\\b');
});

test('unescapeQueryValue reverses escaping', () => {
  assert.equal(unescapeQueryValue('a\\sb'), 'a b');
  assert.equal(unescapeQueryValue('a\\pb'), 'a|b');
  assert.equal(unescapeQueryValue('a\\/b'), 'a/b');
  assert.equal(unescapeQueryValue('a\\\\b'), 'a\\b');
});

test('parseKeyValueLine parses escaped key/value pairs', () => {
  assert.deepEqual(parseKeyValueLine('clid=1 client_nickname=Mock\\sUser client_type=0'), {
    clid: '1',
    client_nickname: 'Mock User',
    client_type: '0',
  });
});

test('splitEntries splits on pipe', () => {
  assert.deepEqual(splitEntries('a=1|b=2'), ['a=1', 'b=2']);
});
