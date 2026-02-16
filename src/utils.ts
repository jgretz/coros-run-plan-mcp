import type { Result, ApiResponse } from './types.ts';

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function formatError(msg: string, e: unknown): string {
  return `${msg}: ${e instanceof Error ? e.message : String(e)}`;
}

export function isApiSuccess(response: ApiResponse<unknown>): boolean {
  return response.result === '0000' || response.apiCode === '0000';
}
