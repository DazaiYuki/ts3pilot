import { AppError, ErrorCode } from './errors.ts';

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION, message, { httpStatus: 400, details });
  }
}

export function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${path} must be an object`, { path });
  }
  return value as Record<string, unknown>;
}

export interface StringOptions {
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export function expectString(value: unknown, path: string, options: StringOptions = {}): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${path} must be a string`, { path });
  }
  if (options.min !== undefined && value.length < options.min) {
    throw new ValidationError(`${path} must be at least ${options.min} characters`, { path });
  }
  if (options.max !== undefined && value.length > options.max) {
    throw new ValidationError(`${path} must be at most ${options.max} characters`, { path });
  }
  if (options.pattern !== undefined && !options.pattern.test(value)) {
    throw new ValidationError(`${path} has an invalid format`, { path });
  }
  return value;
}

export interface NumberOptions {
  integer?: boolean;
  min?: number;
  max?: number;
}

export function expectNumber(value: unknown, path: string, options: NumberOptions = {}): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(`${path} must be a number`, { path });
  }
  if (options.integer === true && !Number.isInteger(value)) {
    throw new ValidationError(`${path} must be an integer`, { path });
  }
  if (options.min !== undefined && value < options.min) {
    throw new ValidationError(`${path} must be >= ${options.min}`, { path });
  }
  if (options.max !== undefined && value > options.max) {
    throw new ValidationError(`${path} must be <= ${options.max}`, { path });
  }
  return value;
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${path} must be a boolean`, { path });
  }
  return value;
}

export function expectStringArray(value: unknown, path: string, options: StringOptions = {}): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${path} must be an array of strings`, { path });
  }
  return value.map((entry, index) => expectString(entry, `${path}[${index}]`, options));
}

export function expectEnum<T extends readonly string[]>(value: unknown, path: string, values: T): T[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    throw new ValidationError(`${path} must be one of: ${values.join(', ')}`, { path });
  }
  return value as T[number];
}

export function optionalString(
  value: unknown,
  path: string,
  options: StringOptions = {},
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return expectString(value, path, options);
}

export function optionalNumber(
  value: unknown,
  path: string,
  options: NumberOptions = {},
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return expectNumber(value, path, options);
}

export function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return expectBoolean(value, path);
}
