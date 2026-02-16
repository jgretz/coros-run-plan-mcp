import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ok, err, formatError } from '../utils.ts';
import type { Result, AuthToken, AuthConfig } from '../types.ts';

const CONFIG_DIR = join(homedir(), '.config', 'coros-mcp');
const TOKEN_PATH = join(CONFIG_DIR, 'auth.json');

export function readStoredToken(): Result<AuthToken, string> {
  if (!existsSync(TOKEN_PATH)) {
    return err('No stored token found');
  }

  try {
    const raw = readFileSync(TOKEN_PATH, 'utf-8');
    const data = JSON.parse(raw) as AuthToken;
    if (!data.accessToken || !data.userId) {
      return err('Stored token is malformed');
    }
    return ok(data);
  } catch (e) {
    return err(formatError('Failed to read stored token', e));
  }
}

export function writeStoredToken(token: AuthToken): Result<void, string> {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), 'utf-8');
    chmodSync(TOKEN_PATH, 0o600);
    return ok(undefined);
  } catch (e) {
    return err(formatError('Failed to write token', e));
  }
}

export function clearStoredToken(): void {
  try {
    if (existsSync(TOKEN_PATH)) {
      unlinkSync(TOKEN_PATH);
    }
  } catch (e) {
    console.warn('Failed to clear stored token:', e);
  }
}

export function readAuthConfig(): Result<AuthConfig, string> {
  const email = process.env.COROS_EMAIL;
  const password = process.env.COROS_PASSWORD;
  const regionRaw = process.env.COROS_REGION ?? 'us';

  if (!email || !password) {
    return err('COROS_EMAIL and COROS_PASSWORD env vars are required');
  }

  if (regionRaw === 'us' || regionRaw === 'eu' || regionRaw === 'cn') {
    return ok({ email, password, region: regionRaw });
  }

  return err(`Invalid COROS_REGION: ${regionRaw}. Must be us, eu, or cn`);
}
