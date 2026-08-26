import { createConnection, type Socket } from 'node:net';
import { AppError, ErrorCode } from '../domain/errors.ts';
import { parseKeyValueLine } from './escape.ts';
import { buildCommand, parseErrorLine, parseRawResponse, type ParsedQueryResponse, type QueryNotification, type QueryParams } from './serverQueryProtocol.ts';

export interface ServerQueryConnectionOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  sid?: number;
  timeoutMs?: number;
}

interface PendingCommand {
  resolve: (response: ParsedQueryResponse) => void;
  reject: (error: unknown) => void;
  timer: NodeJS.Timeout;
}

/**
 * Long-lived TeamSpeak 3 ServerQuery TCP connection.
 *
 * Commands are serialized (one outstanding at a time), matching the ServerQuery
 * request/response model. `notify*` events are delivered through the
 * notification callback. The banner/login/use handshake is based on the
 * documented ServerQuery behaviour and MUST be verified against a live server;
 * contract tests use a fake TCP server speaking the same wire format.
 */
export class ServerQueryConnection {
  private readonly options: ServerQueryConnectionOptions;
  private socket: Socket | undefined;
  private buffer = '';
  private connected = false;
  private closed = false;
  private pendingData: string[] = [];
  private readonly queue: PendingCommand[] = [];
  private notificationHandler: ((notification: QueryNotification) => void) | undefined;

  constructor(options: ServerQueryConnectionOptions) {
    this.options = options;
  }

  onNotification(handler: (notification: QueryNotification) => void): void {
    this.notificationHandler = handler;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.closed) {
      throw new AppError(ErrorCode.TS3, 'ServerQuery connection is closed');
    }

    const socket = createConnection({ host: this.options.host, port: this.options.port });
    this.socket = socket;
    const timeoutMs = this.options.timeoutMs ?? 8000;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let bannerSeen = false;
      let loginDone = false;
      let handshakeBuffer = '';

      const timer = setTimeout(() => {
        settle(new AppError(ErrorCode.NETWORK, 'ServerQuery connect timed out'));
      }, timeoutMs);

      const settle = (error?: unknown): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error !== undefined) {
          socket.destroy();
          reject(error);
          return;
        }
        this.connected = true;
        this.buffer = handshakeBuffer;
        socket.on('data', (chunk: Buffer) => this.onData(chunk));
        this.processBuffer();
        resolve();
      };

      socket.once('error', (error) => {
        settle(new AppError(ErrorCode.TS3, `ServerQuery connection error: ${error.message}`));
      });
      socket.once('close', () => {
        this.connected = false;
        this.failAll(new AppError(ErrorCode.TS3, 'ServerQuery connection closed'));
      });

      socket.on('data', (chunk: Buffer) => {
        handshakeBuffer += chunk.toString('utf8');
        if (!bannerSeen) {
          const newline = handshakeBuffer.indexOf('\n');
          if (newline === -1) return;
          const banner = handshakeBuffer.slice(0, newline).trim();
          handshakeBuffer = handshakeBuffer.slice(newline + 1);
          if (!banner.startsWith('TS3')) {
            settle(new AppError(ErrorCode.TS3, `Unexpected ServerQuery banner: ${banner}`));
            return;
          }
          bannerSeen = true;
          socket.write(
            buildCommand('login', {
              client_login_name: this.options.username,
              client_login_password: this.options.password,
            }),
          );
        } else if (!loginDone) {
          const line = takeLine(handshakeBuffer);
          if (line === undefined) return;
          if (!line.startsWith('error ')) {
            settle(new AppError(ErrorCode.TS3, `Unexpected login response: ${line}`));
            return;
          }
          const loginError = parseErrorLine(line);
          if (loginError.id !== '0') {
            settle(new AppError(ErrorCode.AUTH, `ServerQuery login failed: ${loginError.msg}`));
            return;
          }
          loginDone = true;
          socket.write(buildCommand('use', { sid: this.options.sid ?? 1 }));
        } else {
          const line = takeLine(handshakeBuffer);
          if (line === undefined) return;
          if (!line.startsWith('error ')) {
            settle(new AppError(ErrorCode.TS3, `Unexpected use response: ${line}`));
            return;
          }
          const useError = parseErrorLine(line);
          if (useError.id !== '0') {
            settle(new AppError(ErrorCode.TS3, `ServerQuery use failed: ${useError.msg}`));
            return;
          }
          settle();
        }
      });
    });
  }

  async command(name: string, params: QueryParams = {}): Promise<ParsedQueryResponse> {
    await this.connect();
    if (this.socket === undefined) {
      throw new AppError(ErrorCode.TS3, 'ServerQuery socket is unavailable');
    }
    const socket = this.socket;
    return new Promise<ParsedQueryResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rejectHead(new AppError(ErrorCode.NETWORK, 'ServerQuery command timed out'));
      }, this.options.timeoutMs ?? 8000);
      this.queue.push({ resolve, reject, timer });
      try {
        socket.write(buildCommand(name, params));
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.socket !== undefined && !this.socket.destroyed) {
      try {
        this.socket.write('quit\n');
      } catch {
        // ignore
      }
      this.socket.destroy();
    }
    this.socket = undefined;
    this.connected = false;
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf8');
    this.processBuffer();
  }

  private processBuffer(): void {
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line.length === 0) continue;
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (line.startsWith('notify')) {
      const space = line.indexOf(' ');
      const event = space === -1 ? line : line.slice(0, space);
      const rest = space === -1 ? '' : line.slice(space + 1);
      this.notificationHandler?.({ event, params: parseKeyValueLine(rest) });
      return;
    }
    if (line.startsWith('error ')) {
      this.pendingData.push(line);
      const raw = this.pendingData.join('\n');
      this.pendingData = [];
      let response: ParsedQueryResponse;
      try {
        response = parseRawResponse(raw);
      } catch (error) {
        this.rejectHead(error);
        return;
      }
      this.settleHead(response);
      return;
    }
    this.pendingData.push(line);
  }

  private settleHead(response: ParsedQueryResponse): void {
    const pending = this.queue.shift();
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    pending.resolve(response);
  }

  private rejectHead(error: unknown): void {
    const pending = this.queue.shift();
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  private failAll(error: unknown): void {
    while (this.queue.length > 0) {
      this.rejectHead(error);
    }
  }
}

function takeLine(buffer: string): string | undefined {
  const newline = buffer.indexOf('\n');
  if (newline === -1) return undefined;
  return buffer.slice(0, newline).trim();
}
