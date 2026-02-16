import { REGION_URLS } from '../config.ts';
import { ok, err, type Result, type ApiResponse, type AuthToken } from '../types.ts';
import { getToken, refreshToken } from '../auth/auth.ts';
import { readAuthConfig } from '../auth/store.ts';

function getBaseUrl(): string {
  const config = readAuthConfig();
  const region = config.ok ? config.value.region : 'us';
  return REGION_URLS[region];
}

function authHeaders(token: AuthToken): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    accesstoken: token.accessToken,
    yfheader: JSON.stringify({ userId: token.userId }),
  };
}

type RequestOptions = {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  rawBody?: string; // pre-serialized JSON, bypasses JSON.stringify
  params?: Record<string, string>;
};

async function request<T>(opts: RequestOptions, token: AuthToken): Promise<Result<T, string>> {
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
      return err(`HTTP ${response.status} ${response.statusText} at ${opts.path}: ${text}`);
    }

    const data = (await response.json()) as ApiResponse<T>;

    const debugData = Array.isArray(data.data) && data.data.length > 0
      ? `array[${data.data.length}], first keys: ${Object.keys(data.data[0])}`
      : `keys: ${Object.keys(data.data ?? {})}`;
    console.error(`[coros] ${opts.method} ${opts.path} -> result: ${data.result ?? data.apiCode}, ${debugData}`);

    if (data.result !== '0000' && data.apiCode !== '0000') {
      return err(`API error at ${opts.path}: ${data.message} (code: ${data.result || data.apiCode})`);
    }

    return ok(data.data);
  } catch (e) {
    return err(`Request failed at ${opts.path}: ${e}`);
  }
}

// Authenticated request with auto-retry on 401
export async function apiRequest<T>(opts: RequestOptions): Promise<Result<T, string>> {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return tokenResult;

  const result = await request<T>(opts, tokenResult.value);

  // retry once on auth error
  if (!result.ok && result.error.includes('HTTP 401')) {
    const refreshResult = await refreshToken();
    if (!refreshResult.ok) return refreshResult;
    return request<T>(opts, refreshResult.value);
  }

  return result;
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<Result<T, string>> {
  return apiRequest<T>({ method: 'GET', path, params });
}

export async function apiPost<T>(path: string, body?: unknown, params?: Record<string, string>): Promise<Result<T, string>> {
  return apiRequest<T>({ method: 'POST', path, body, params });
}

export async function apiPostRaw<T>(path: string, rawBody: string): Promise<Result<T, string>> {
  return apiRequest<T>({ method: 'POST', path, rawBody });
}
