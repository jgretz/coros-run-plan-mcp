import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { corosLogin } from '../../../src/tools/auth/coros-login.ts';

const originalFetch = globalThis.fetch;
const origEnv = { ...process.env };

function successResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data }),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

describe('coros_login', () => {
  beforeEach(() => {
    process.env.COROS_EMAIL = 'env@test.com';
    process.env.COROS_PASSWORD = 'envpw';
    process.env.COROS_REGION = 'us';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.COROS_EMAIL = origEnv.COROS_EMAIL;
    process.env.COROS_PASSWORD = origEnv.COROS_PASSWORD;
    process.env.COROS_REGION = origEnv.COROS_REGION;
  });

  it('should return userId on success', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(successResponse({ accessToken: 'tok', userId: 'u1' })),
    ) as unknown as typeof fetch;

    const result = await corosLogin.handler({ email: 'a@b.com', password: 'secret', region: 'us' }, {} as never);

    expect(result.content[0]!.text).toContain('u1');
    expect(result.isError).toBeUndefined();
  });

  it('should succeed without explicit credentials using env vars', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(successResponse({ accessToken: 'tok', userId: 'u2' })),
    ) as unknown as typeof fetch;

    const result = await corosLogin.handler({}, {} as never);

    expect(result.content[0]!.text).toContain('u2');
    expect(result.isError).toBeUndefined();
  });

  it('should return isError on HTTP failure', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('bad creds'),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await corosLogin.handler({ email: 'a@b.com', password: 'wrong', region: 'us' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Login failed');
  });

  it('should return isError on API error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ result: '2001', apiCode: '2001', message: 'Invalid password', data: null }),
        text: () => Promise.resolve(''),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await corosLogin.handler({ email: 'a@b.com', password: 'wrong', region: 'us' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Invalid password');
  });
});
