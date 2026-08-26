import assert from 'node:assert/strict';
import { createServer, type Server, type Socket } from 'node:net';
import test from 'node:test';
import { ServerQueryConnection } from '../src/ts3/serverQueryConnection.ts';

interface FakeServer {
  server: Server;
  port: number;
}

function startFakeTs3(handler: (socket: Socket) => void): Promise<FakeServer> {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      socket.on('error', () => {
        // Client disconnects (ECONNRESET) are expected in tests.
      });
      handler(socket);
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        reject(new Error('failed to bind fake TS3 server'));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

function respond(socket: Socket, lines: string[]): void {
  socket.write(`${lines.join('\n')}\n\r`);
}

function defaultScript(socket: Socket): void {
  socket.write('TS3\n\r');
  socket.on('data', (chunk: Buffer) => {
    const commands = chunk.toString('utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    for (const command of commands) {
      if (command.startsWith('login')) {
        if (command.includes('baduser')) {
          respond(socket, ['error id=2582 msg=invalid\\sloginname\\sor\\spassword']);
        } else {
          respond(socket, ['error id=0 msg=ok']);
        }
      } else if (command.startsWith('use')) {
        respond(socket, ['error id=0 msg=ok']);
      } else if (command.startsWith('serverinfo')) {
        respond(socket, [
          'virtualserver_name=Contract\\sTest virtualserver_clientsonline=5 virtualserver_maxclients=32 virtualserver_version=3.13.7 virtualserver_uptime=1234',
          'error id=0 msg=ok',
        ]);
      } else if (command.startsWith('clientlist')) {
        respond(socket, [
          'clid=1 cid=2 client_nickname=Alice\\sAway client_type=0 client_away=1 client_unique_identifier=abc|clid=3 cid=1 client_nickname=Bob client_type=0 client_away=0 client_unique_identifier=def',
          'error id=0 msg=ok',
        ]);
      } else if (command.startsWith('channelcreate')) {
        respond(socket, ['cid=10', 'error id=0 msg=ok']);
      } else {
        respond(socket, ['error id=0 msg=ok']);
      }
    }
  });
}

test('ServerQuery connection performs banner/login/use handshake and commands', async () => {
  const { server, port } = await startFakeTs3(defaultScript);
  try {
    const connection = new ServerQueryConnection({
      host: '127.0.0.1',
      port,
      username: 'admin',
      password: 'secret',
      timeoutMs: 3000,
    });
    const status = await connection.command('serverinfo');
    assert.equal(status.error.id, '0');
    assert.equal(status.entries[0]?.virtualserver_name, 'Contract Test');
    assert.equal(status.entries[0]?.virtualserver_clientsonline, '5');

    const clients = await connection.command('clientlist');
    assert.equal(clients.entries.length, 2);
    assert.equal(clients.entries[0]?.client_nickname, 'Alice Away');
    assert.equal(clients.entries[1]?.client_nickname, 'Bob');

    const created = await connection.command('channelcreate', { channel_name: 'New Lobby', cpid: 0 });
    assert.equal(created.entries[0]?.cid, '10');
    await connection.close();
  } finally {
    server.close();
  }
});

test('ServerQuery login failure surfaces a domain error', async () => {
  const { server, port } = await startFakeTs3(defaultScript);
  try {
    const connection = new ServerQueryConnection({
      host: '127.0.0.1',
      port,
      username: 'baduser',
      password: 'wrong',
      timeoutMs: 3000,
    });
    await assert.rejects(() => connection.connect(), /login failed/);
  } finally {
    server.close();
  }
});

test('ServerQuery notifications are delivered to the handler', async () => {
  const { server, port } = await startFakeTs3((socket) => {
    socket.write('TS3\n\r');
    socket.on('data', (chunk: Buffer) => {
      const commands = chunk.toString('utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
      for (const command of commands) {
        if (command.startsWith('login')) respond(socket, ['error id=0 msg=ok']);
        else if (command.startsWith('use')) {
          respond(socket, ['error id=0 msg=ok']);
          socket.write('notifyclientleftview clid=9\n\r');
        } else {
          respond(socket, ['error id=0 msg=ok']);
        }
      }
    });
  });
  try {
    const connection = new ServerQueryConnection({
      host: '127.0.0.1',
      port,
      username: 'admin',
      password: 'secret',
      timeoutMs: 3000,
    });
    const notifications: Array<{ event: string; clid?: string }> = [];
    connection.onNotification((notification) => {
      notifications.push({ event: notification.event, clid: notification.params.clid });
    });
    await connection.command('serverinfo');
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.event, 'notifyclientleftview');
    assert.equal(notifications[0]?.clid, '9');
    await connection.close();
  } finally {
    server.close();
  }
});
