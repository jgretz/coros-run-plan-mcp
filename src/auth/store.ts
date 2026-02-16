import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ok, err, type Result, type AuthToken, type AuthConfig, type Region } from '../types.ts';

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
    return err(`Failed to read stored token: ${e}`);
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
    return err(`Failed to write token: ${e}`);
  }
}

export function clearStoredToken(): void {
  try {
    if (existsSync(TOKEN_PATH)) {
      writeFileSync(TOKEN_PATH, '', 'utf-8');
    }
  } catch {
    // best effort
  }
}

export function readAuthConfig(): Result<AuthConfig, string> {
  const email = process.env.COROS_EMAIL;
  const password = process.env.COROS_PASSWORD;
  const region = (process.env.COROS_REGION ?? 'us') as Region;

  if (!email || !password) {
    return err('COROS_EMAIL and COROS_PASSWORD env vars are required');
  }

  if (!['us', 'eu', 'cn'].includes(region)) {
    return err(`Invalid COROS_REGION: ${region}. Must be us, eu, or cn`);
  }

  return ok({ email, password, region });
}
