import assert from 'node:assert/strict';
import test from 'node:test';
import { MockTeamSpeakClient } from '../src/ts3/mock.ts';

test('mock TS3 client returns deterministic status/clients/channels', async () => {
  const client = new MockTeamSpeakClient();
  const status = await client.status();
  assert.equal(status.online, true);
  assert.equal(status.mock, true);
  const clients = await client.clients();
  assert.equal(clients.length, 4);
  const channels = await client.channels();
  assert.equal(channels.length, 3);
});

test('mock TS3 client supports kick/move/ban/poke', async () => {
  const client = new MockTeamSpeakClient();
  await client.kickClient({ clientId: 1, kickFrom: 'channel' });
  const afterChannelKick = await client.clients();
  assert.equal(afterChannelKick.find((c) => c.clientId === 1)?.channelId, 0);
  await client.moveClient({ clientId: 2, channelId: 3 });
  assert.equal((await client.clients()).find((c) => c.clientId === 2)?.channelId, 3);
  await client.kickClient({ clientId: 3, kickFrom: 'server' });
  assert.equal((await client.clients()).some((c) => c.clientId === 3), false);
  await client.banClient({ clientId: 4 });
  assert.equal((await client.clients()).some((c) => c.clientId === 4), false);
  await client.pokeClient({ clientId: 2, message: 'hello' });
});

test('mock TS3 client supports channel create/edit/delete/move', async () => {
  const client = new MockTeamSpeakClient();
  const created = await client.channelCreate({ name: 'New Lobby', parentId: 1, order: 5 });
  assert.ok(created.channelId > 3);
  await client.channelEdit({ channelId: created.channelId, name: 'Renamed', topic: 'hello' });
  const channels = await client.channels();
  const channel = channels.find((entry) => entry.channelId === created.channelId);
  assert.equal(channel?.name, 'Renamed');
  assert.equal(channel?.topic, 'hello');
  await client.channelMove({ channelId: created.channelId, parentId: 2, order: 1 });
  assert.equal((await client.channels()).find((entry) => entry.channelId === created.channelId)?.parentId, 2);
  await client.channelDelete({ channelId: created.channelId });
  assert.equal((await client.channels()).some((entry) => entry.channelId === created.channelId), false);
});

test('mock TS3 client rejects unknown clients', async () => {
  const client = new MockTeamSpeakClient();
  await assert.rejects(() => client.kickClient({ clientId: 999, kickFrom: 'server' }));
});
