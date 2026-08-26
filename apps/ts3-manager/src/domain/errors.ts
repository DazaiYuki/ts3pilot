export const ErrorCode = {
  VALIDATION: 'VALIDATION_ERROR',
  CONFIG: 'CONFIG_ERROR',
  USER: 'USER_ERROR',
  PERMISSION: 'PERMISSION_DENIED',
  TS3: 'TS3_ERROR',
  TS3_UNVERIFIED: 'TS3_API_UNVERIFIED',
  TS3_UNSUPPORTED: 'TS3_FEATURE_UNSUPPORTED',
  AGENT: 'AGENT_ERROR',
  SYSTEM: 'SYSTEM_COMMAND_ERROR',
  NETWORK: 'NETWORK_TIMEOUT',
  NOT_FOUND: 'NOT_FOUND',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  AUTH: 'AUTH_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  REPLAY: 'REPLAY_DETECTED',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
  INTERNAL: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface AppErrorOptions {
  httpStatus?: number;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly httpStatus: number;
  readonly details: unknown;

  constructor(code: ErrorCodeValue, message: string, options: AppErrorOptions = {}) {
    const cause = options.cause === undefined ? undefined : { cause: options.cause };
    super(message, cause);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = options.httpStatus ?? 500;
    this.details = options.details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function toErrorEnvelope(error: unknown): { code: ErrorCodeValue; message: string } {
  if (isAppError(error)) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: ErrorCode.INTERNAL, message: 'Internal error' };
  }
  return { code: ErrorCode.INTERNAL, message: 'Unknown error' };
}
