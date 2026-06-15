import { eq } from 'drizzle-orm';
import { ok, err, formatError } from '../utils.ts';
import type { Result, AuthToken, AuthConfig } from '../types.ts';
import { getDb } from '../db/index.ts';
import { corosTokens } from '../db/schema.ts';

const TOKEN_ID = 'default';

export async function readStoredToken(): Promise<Result<AuthToken, string>> {
  try {
    const rows = await getDb()
      .select()
      .from(corosTokens)
      .where(eq(corosTokens.id, TOKEN_ID))
      .limit(1);

    const row = rows[0];
    if (!row) return err('No stored token found');
    if (!row.token.accessToken || !row.token.userId) {
      return err('Stored token is malformed');
    }
    return ok(row.token);
  } catch (e) {
    return err(formatError('Failed to read stored token', e));
  }
}

export async function writeStoredToken(token: AuthToken): Promise<Result<void, string>> {
  try {
    await getDb()
      .insert(corosTokens)
      .values({ id: TOKEN_ID, token })
      .onConflictDoUpdate({
        target: corosTokens.id,
        set: { token, updatedAt: new Date() },
      });
    return ok(undefined);
  } catch (e) {
    return err(formatError('Failed to write token', e));
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    await getDb().delete(corosTokens).where(eq(corosTokens.id, TOKEN_ID));
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
