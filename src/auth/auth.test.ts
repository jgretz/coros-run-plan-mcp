import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { clearToken } from './auth.ts';

// md5 is internal but we can verify the login flow behavior
describe('auth', () => {
  beforeEach(() => {
    clearToken();
  });

  it('should export login, getToken, clearToken, refreshToken', async () => {
    const auth = await import('./auth.ts');
    expect(typeof auth.login).toBe('function');
    expect(typeof auth.getToken).toBe('function');
    expect(typeof auth.clearToken).toBe('function');
    expect(typeof auth.refreshToken).toBe('function');
  });
});
