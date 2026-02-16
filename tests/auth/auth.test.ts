import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ok, err } from '../../src/utils.ts';

const mockReadStoredToken = mock(() => err('No stored token found') as ReturnType<typeof import('../../src/auth/store.ts').readStoredToken>);
const mockWriteStoredToken = mock(() => ok(undefined) as ReturnType<typeof import('../../src/auth/store.ts').writeStoredToken>);
const mockReadAuthConfig = mock(() => ok({ email: 'a@b.com', password: 'p', region: 'us' as const }) as ReturnType<typeof import('../../src/auth/store.ts').readAuthConfig>);
const mockClearStoredToken = mock(() => {});

mock.module('../../src/auth/store.ts', () => ({
  readStoredToken: mockReadStoredToken,
  writeStoredToken: mockWriteStoredToken,
  readAuthConfig: mockReadAuthConfig,
  clearStoredToken: mockClearStoredToken,
}));

const { login, getToken, clearToken, refreshToken } = await import('../../src/auth/auth.ts');

const originalFetch = globalThis.fetch;

function successResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data }),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

describe('auth', () => {
  beforeEach(() => {
    clearToken();
    mockReadStoredToken.mockReset();
    mockWriteStoredToken.mockReset();
    mockReadAuthConfig.mockReset();
    mockClearStoredToken.mockReset();
    mockReadStoredToken.mockImplementation(() => err('No stored token found'));
    mockWriteStoredToken.mockImplementation(() => ok(undefined));
    mockReadAuthConfig.mockImplementation(() => ok({ email: 'a@b.com', password: 'p', region: 'us' as const }));
    mockClearStoredToken.mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('login', () => {
    it('should call API and return token with direct config', async () => {
      const token = { accessToken: 'abc', userId: '123' };
      globalThis.fetch = mock(() => Promise.resolve(successResponse(token))) as unknown as typeof fetch;

      const result = await login({ email: 'x@y.com', password: 'pw', region: 'us' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accessToken).toBe('abc');
        expect(result.value.userId).toBe('123');
      }
    });

    it('should read config from readAuthConfig when not provided', async () => {
      const token = { accessToken: 'def', userId: '456' };
      globalThis.fetch = mock(() => Promise.resolve(successResponse(token))) as unknown as typeof fetch;

      const result = await login();

      expect(result.ok).toBe(true);
      expect(mockReadAuthConfig).toHaveBeenCalledTimes(1);
    });

    it('should return err when readAuthConfig fails', async () => {
      mockReadAuthConfig.mockImplementation(() => err('no config'));

      const result = await login();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('no config');
    });

    it('should return err on HTTP failure', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: () => Promise.resolve(''),
        } as unknown as Response),
      ) as unknown as typeof fetch;

      const result = await login({ email: 'x@y.com', password: 'pw', region: 'us' });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('HTTP 403');
    });

    it('should return err on API error code', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ result: '2001', apiCode: '2001', message: 'Invalid password', data: null }),
        } as unknown as Response),
      ) as unknown as typeof fetch;

      const result = await login({ email: 'x@y.com', password: 'pw', region: 'us' });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Invalid password');
    });
  });

  describe('getToken', () => {
    it('should return cached token after login', async () => {
      const token = { accessToken: 'cached', userId: 'u1' };
      globalThis.fetch = mock(() => Promise.resolve(successResponse(token))) as unknown as typeof fetch;

      await login({ email: 'x@y.com', password: 'pw', region: 'us' });
      const result = await getToken();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.accessToken).toBe('cached');
      // fetch should only be called once (login), not again for getToken
      expect((globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls).toHaveLength(1);
    });

    it('should fall back to stored token', async () => {
      mockReadStoredToken.mockImplementation(() => ok({ accessToken: 'stored', userId: 'u2' }));

      const result = await getToken();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.accessToken).toBe('stored');
    });

    it('should auto-login when no stored token', async () => {
      mockReadStoredToken.mockImplementation(() => err('No stored token found'));
      const token = { accessToken: 'auto', userId: 'u3' };
      globalThis.fetch = mock(() => Promise.resolve(successResponse(token))) as unknown as typeof fetch;

      const result = await getToken();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.accessToken).toBe('auto');
    });
  });

  describe('refreshToken', () => {
    it('should clear cache and re-fetch token', async () => {
      const token1 = { accessToken: 'first', userId: 'u1' };
      const token2 = { accessToken: 'second', userId: 'u1' };
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        return Promise.resolve(successResponse(callCount === 1 ? token1 : token2));
      }) as unknown as typeof fetch;

      await login({ email: 'x@y.com', password: 'pw', region: 'us' });
      const result = await refreshToken();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.accessToken).toBe('second');
      expect(mockClearStoredToken).toHaveBeenCalled();
    });
  });
});
