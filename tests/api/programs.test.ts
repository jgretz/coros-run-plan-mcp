import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ok } from '../../src/utils.ts';

const mockGetToken = mock(() => Promise.resolve(ok({ accessToken: 'tok', userId: 'u1' })));
const mockRefreshToken = mock(() => Promise.resolve(ok({ accessToken: 'tok', userId: 'u1' })));

mock.module('../../src/auth/auth.ts', () => ({
  getToken: mockGetToken,
  refreshToken: mockRefreshToken,
}));

mock.module('../../src/auth/store.ts', () => ({
  readAuthConfig: mock(() => ok({ email: 'a@b.com', password: 'p', region: 'us' as const })),
}));

const { deletePrograms } = await import('../../src/api/programs.ts');

const originalFetch = globalThis.fetch;

describe('deletePrograms', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should reject non-numeric IDs', async () => {
    const result = await deletePrograms(['abc']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('must be numeric');
  });

  it('should accept valid numeric IDs', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data: null }),
        text: () => Promise.resolve(''),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await deletePrograms(['123456789012345678']);

    expect(result.ok).toBe(true);
  });
});
