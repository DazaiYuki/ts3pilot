import { createWriteStream, rmSync } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AppError, ErrorCode } from '../domain/errors.ts';

/** Enforce download limits even when Content-Length is absent or misleading. */
export async function downloadFile(url: string, destPath: string, maxBytes: number): Promise<void> {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(300000) });
  if (!response.ok || response.body === null) {
    throw new AppError(ErrorCode.NETWORK, `Download failed: HTTP ${response.status}`, { httpStatus: 502 });
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) {
    await response.body.cancel();
    throw new AppError(ErrorCode.VALIDATION, `Archive too large (${contentLength} bytes)`);
  }
  let bytes = 0;
  const limit = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    bytes += chunk.length;
    callback(bytes > maxBytes ? new AppError(ErrorCode.VALIDATION, `Archive exceeds ${maxBytes} bytes`) : null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream), limit, createWriteStream(destPath));
  } catch (error) {
    rmSync(destPath, { force: true });
    throw error;
  }
}
