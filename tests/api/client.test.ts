import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ok, err } from '../../src/utils.ts';

const mockGetToken = mock(() => Promise.resolve(ok({ accessToken: 'tok', userId: 'u1' })));
const mockRefreshToken = mock(() => Promise.resolve(ok({ accessToken: 'tok2', userId: 'u1' })));

mock.module('../../src/auth/auth.ts', () => ({
  getToken: mockGetToken,
  refreshToken: mockRefreshToken,
  getRegion: () => 'us' as const,
}));

const { apiGet, apiPost, apiRequest } = await import('../../src/api/client.ts');

const originalFetch = globalThis.fetch;

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown>; text?: () => Promise<string> }) {
  const defaults = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data: {} }),
    text: () => Promise.resolve(''),
  };
  globalThis.fetch = mock(() => Promise.resolve({ ...defaults, ...response } as Response)) as unknown as typeof fetch;
}

describe('apiClient', () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    mockRefreshToken.mockReset();
    mockGetToken.mockImplementation(() => Promise.resolve(ok({ accessToken: 'tok', userId: 'u1' })));
    mockRefreshToken.mockImplementation(() => Promise.resolve(ok({ accessToken: 'tok2', userId: 'u1' })));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('apiGet', () => {
    it('should return parsed data on success', async () => {
      const payload = { items: [1, 2, 3] };
      mockFetch({ json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data: payload }) });

      const result = await apiGet<{ items: number[] }>('/test/path');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual(payload);
    });
  });

  describe('apiPost', () => {
    it('should send body as JSON', async () => {
      mockFetch({ json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data: 'ok' }) });

      const body = { name: 'test' };
      const result = await apiPost<string>('/test/post', body);

      expect(result.ok).toBe(true);
      const call = (globalThis.fetch as unknown as ReturnType<typeof mock>).mock.calls[0]!;
      expect(call[1]?.body).toBe(JSON.stringify(body));
    });
  });

  describe('HTTP errors', () => {
    it('should return err with status code on HTTP failure', async () => {
      mockFetch({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('server broke'),
      });

      const result = await apiGet('/fail');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('HTTP 500');
        expect(result.error).toContain('server broke');
      }
    });
  });

  describe('API errors', () => {
    it('should return err with message when result is not 0000', async () => {
      mockFetch({
        json: () => Promise.resolve({ result: '1001', apiCode: '1001', message: 'Bad request', data: null }),
      });

      const result = await apiGet('/api-err');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Bad request');
        expect(result.error).toContain('1001');
      }
    });
  });

  describe('401 retry', () => {
    it('should refresh token and retry on 401', async () => {
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () => Promise.resolve(''),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data: 'retried' }),
          text: () => Promise.resolve(''),
        } as Response);
      }) as unknown as typeof fetch;

      const result = await apiGet<string>('/auth-retry');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('retried');
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should propagate refresh error when retry fails', async () => {
      mockFetch({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve(''),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRefreshToken.mockImplementation((() => Promise.resolve(err('refresh failed'))) as any);

      const result = await apiGet('/auth-fail');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('refresh failed');
    });
  });

  describe('network errors', () => {
    it('should return err when fetch throws', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('network down'))) as unknown as typeof fetch;

      const result = await apiGet('/net-err');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('network down');
    });
  });
});
