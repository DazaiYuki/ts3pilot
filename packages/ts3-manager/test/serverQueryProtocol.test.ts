import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommand, parseErrorLine, parseRawResponse } from '../src/ts3/serverQueryProtocol.ts';

test('buildCommand escapes values and rejects invalid parameter names', () => {
  assert.equal(
    buildCommand('clientkick', { clid: 1, reasonid: 4, reasonmsg: 'a b|c' }),
    'clientkick clid=1 reasonid=4 reasonmsg=a\\sb\\pc\n',
  );
  assert.equal(buildCommand('use', { sid: 1 }), 'use sid=1\n');
  assert.equal(buildCommand('channeldelete', { cid: 2, force: true }), 'channeldelete cid=2 force=1\n');
  assert.throws(() => buildCommand('clientkick', { 'bad param': 1 }));
  assert.throws(() => buildCommand('not a command'));
});

test('parseRawResponse parses multi-line entries with escaped values', () => {
  const raw = [
    'cid=1 channel_name=Lobby pid=0 channel_order=0 total_clients=2',
    'cid=2 channel_name=General\\s\\/\\pRoom pid=1 channel_order=1 total_clients=0',
    'error id=0 msg=ok',
  ].join('\n');
  const parsed = parseRawResponse(raw);
  assert.equal(parsed.error.id, '0');
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.entries[0]?.channel_name, 'Lobby');
  assert.equal(parsed.entries[1]?.channel_name, 'General /|Room');
  assert.equal(parsed.notifications.length, 0);
});

test('parseRawResponse separates notifications from command data', () => {
  const raw = ['notifyclientleftview clid=9', 'error id=0 msg=ok'].join('\n');
  const parsed = parseRawResponse(raw);
  assert.equal(parsed.entries.length, 0);
  assert.equal(parsed.notifications.length, 1);
  assert.equal(parsed.notifications[0]?.event, 'notifyclientleftview');
  assert.equal(parsed.notifications[0]?.params.clid, '9');
});

test('parseRawResponse throws when the terminating error line is missing', () => {
  assert.throws(() => parseRawResponse('clid=1 client_nickname=Alice'));
});

test('parseErrorLine extracts id, msg and extra fields', () => {
  assert.deepEqual(parseErrorLine('error id=0 msg=ok'), { id: '0', msg: 'ok', extra: {} });
  const denied = parseErrorLine('error id=771 msg=insufficient\\sclient\\spermissions failed_permid=123');
  assert.equal(denied.id, '771');
  assert.equal(denied.msg, 'insufficient client permissions');
  assert.equal(denied.extra.failed_permid, '123');
});
