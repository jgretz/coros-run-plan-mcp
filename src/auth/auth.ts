import { REGION_URLS, ACCOUNT_TYPE_EMAIL } from '../config.ts';
import { ok, err, formatError, isApiSuccess } from '../utils.ts';
import type { Result, AuthToken, AuthConfig, ApiResponse, LoginData, Region } from '../types.ts';
import { readStoredToken, writeStoredToken, readAuthConfig, clearStoredToken } from './store.ts';

function md5(input: string): string {
  const hasher = new Bun.CryptoHasher('md5');
  hasher.update(input);
  return hasher.digest('hex');
}

let cachedToken: AuthToken | null = null;

export async function login(config?: AuthConfig): Promise<Result<AuthToken, string>> {
  let cfg: AuthConfig;
  if (config) {
    cfg = config;
  } else {
    const configResult = readAuthConfig();
    if (!configResult.ok) return configResult;
    cfg = configResult.value;
  }
  const baseUrl = REGION_URLS[cfg.region];

  const body = {
    account: cfg.email,
    accountType: ACCOUNT_TYPE_EMAIL,
    pwd: md5(cfg.password),
  };

  try {
    const response = await fetch(`${baseUrl}/account/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return err(`Login failed: HTTP ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ApiResponse<LoginData>;

    if (!isApiSuccess(data)) {
      return err(`Login failed: ${data.message} (code: ${data.result || data.apiCode})`);
    }

    const token: AuthToken = {
      accessToken: data.data.accessToken,
      userId: data.data.userId,
    };

    cachedToken = token;

    const storeResult = writeStoredToken(token);
    if (!storeResult.ok) {
      // non-fatal — token works, just not persisted
      console.warn(`Warning: ${storeResult.error}`);
    }

    return ok(token);
  } catch (e) {
    return err(formatError('Login request failed', e));
  }
}

export async function getToken(): Promise<Result<AuthToken, string>> {
  // 1. Return cached token
  if (cachedToken) return ok(cachedToken);

  // 2. Try stored token
  const stored = readStoredToken();
  if (stored.ok) {
    cachedToken = stored.value;
    return stored;
  }

  // 3. Try auto-login from env vars
  const configResult = readAuthConfig();
  if (!configResult.ok) {
    return err('Not authenticated. Use coros_login tool or set COROS_EMAIL/COROS_PASSWORD env vars.');
  }

  return login(configResult.value);
}

export function clearToken(): void {
  cachedToken = null;
  clearStoredToken();
}

export async function refreshToken(): Promise<Result<AuthToken, string>> {
  clearToken();
  return getToken();
}

export function getRegion(): Region {
  const regionRaw = process.env.COROS_REGION ?? 'us';
  if (regionRaw === 'us' || regionRaw === 'eu' || regionRaw === 'cn') {
    return regionRaw;
  }
  console.warn(`Invalid COROS_REGION "${regionRaw}", defaulting to "us"`);
  return 'us';
}
