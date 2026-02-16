import { REGION_URLS } from '../config.ts';
import { ok, err, formatError, isApiSuccess } from '../utils.ts';
import type { Result, ApiResponse, AuthToken } from '../types.ts';
import { getToken, refreshToken, getRegion } from '../auth/auth.ts';

function getBaseUrl(): string {
  return REGION_URLS[getRegion()];
}

function authHeaders(token: AuthToken): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    accesstoken: token.accessToken,
    yfheader: JSON.stringify({ userId: token.userId }),
  };
}

type ApiError = {
  message: string;
  status?: number;
};

type RequestOptions = {
  method: 'GET' | 'POST';
  path: `/${string}`;
  body?: unknown;
  rawBody?: string; // pre-serialized JSON, bypasses JSON.stringify
  params?: Record<string, string>;
};

async function request<T>(opts: RequestOptions, token: AuthToken): Promise<Result<T, ApiError>> {
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}${opts.path}`);

  if (opts.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      url.searchParams.set(key, value);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: opts.method,
      headers: authHeaders(token),
      body: opts.rawBody ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return err({ message: `HTTP ${response.status} ${response.statusText} at ${opts.path}: ${text}`, status: response.status });
    }

    const data = (await response.json()) as ApiResponse<T>;

    if (!isApiSuccess(data)) {
      return err({ message: `API error at ${opts.path}: ${data.message} (code: ${data.result || data.apiCode})` });
    }

    return ok(data.data);
  } catch (e) {
    return err({ message: formatError(`Request failed at ${opts.path}`, e) });
  }
}

function mapResult<T>(result: Result<T, ApiError>): Result<T, string> {
  return result.ok ? result : err(result.error.message);
}

// Authenticated request with auto-retry on 401
export async function apiRequest<T>(opts: RequestOptions): Promise<Result<T, string>> {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return tokenResult;

  const result = await request<T>(opts, tokenResult.value);

  // retry once on auth error
  if (!result.ok && result.error.status === 401) {
    const refreshResult = await refreshToken();
    if (!refreshResult.ok) return refreshResult;
    return mapResult(await request<T>(opts, refreshResult.value));
  }

  return mapResult(result);
}

export async function apiGet<T>(path: `/${string}`, params?: Record<string, string>): Promise<Result<T, string>> {
  return apiRequest<T>({ method: 'GET', path, params });
}

export async function apiPost<T>(path: `/${string}`, body?: unknown, params?: Record<string, string>): Promise<Result<T, string>> {
  return apiRequest<T>({ method: 'POST', path, body, params });
}

export async function apiPostRaw<T>(path: `/${string}`, rawBody: string): Promise<Result<T, string>> {
  return apiRequest<T>({ method: 'POST', path, rawBody });
}
