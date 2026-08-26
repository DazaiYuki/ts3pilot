import { spawn } from 'node:child_process';

export interface ProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  overflow: boolean;
}

export function runProcess(binary: string, args: readonly string[], options: ProcessOptions = {}): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolve, reject) => {
    for (const arg of args) {
      if (typeof arg !== 'string' || arg.includes('\0')) {
        reject(new Error('Invalid process argument'));
        return;
      }
    }
    const maxBytes = options.maxBufferBytes ?? 10 * 1024 * 1024;
    let child;
    try {
      child = spawn(binary, [...args], {
        cwd: options.cwd,
        env: options.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = '';
    let stderr = '';
    let overflow = false;
    let timedOut = false;

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < maxBytes) stdout += chunk.toString('utf8');
      else overflow = true;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < maxBytes) stderr += chunk.toString('utf8');
    });

    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
          }, options.timeoutMs);

    child.on('error', (error) => {
      if (timer !== undefined) clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (timer !== undefined) clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stdout, stderr, timedOut, overflow });
    });
  });
}
