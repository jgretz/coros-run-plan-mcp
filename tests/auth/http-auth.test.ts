import { describe, it, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { authGate } from '../../src/http/auth.ts';

function makeApp() {
  const app = new Hono();
  app.use('/mcp', authGate);
  app.all('/mcp', (c) => c.json({ ok: true }));
  return app;
}

const orig = {
  token: process.env.MCP_AUTH_TOKEN,
  issuer: process.env.OAUTH_ISSUER,
  resource: process.env.MCP_RESOURCE,
};

function setEnv(k: string, v: string | undefined) {
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

afterEach(() => {
  setEnv('MCP_AUTH_TOKEN', orig.token);
  setEnv('OAUTH_ISSUER', orig.issuer);
  setEnv('MCP_RESOURCE', orig.resource);
});

describe('authGate', () => {
  it('401 with WWW-Authenticate resource_metadata when no token', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret';
    process.env.MCP_RESOURCE = 'https://x.fly.dev/mcp';
    delete process.env.OAUTH_ISSUER;
    const res = await makeApp().request('/mcp', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate') ?? '').toContain('/.well-known/oauth-protected-resource');
  });

  it('401 on a wrong token when no AS is configured', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret';
    process.env.MCP_RESOURCE = 'https://x.fly.dev/mcp';
    delete process.env.OAUTH_ISSUER;
    const res = await makeApp().request('/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
    });
    expect(res.status).toBe(401);
  });

  it('passes through with the correct static token', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret';
    process.env.MCP_RESOURCE = 'https://x.fly.dev/mcp';
    const res = await makeApp().request('/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    });
    expect(res.status).toBe(200);
  });
});
