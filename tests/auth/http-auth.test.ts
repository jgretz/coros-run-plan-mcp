import { describe, it, expect, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { bearerAuth } from '../../src/http/auth.ts';

function makeApp() {
  const app = new Hono();
  app.use('/mcp', bearerAuth);
  app.all('/mcp', (c) => c.json({ ok: true }));
  return app;
}

const original = process.env.MCP_AUTH_TOKEN;

afterEach(() => {
  if (original === undefined) delete process.env.MCP_AUTH_TOKEN;
  else process.env.MCP_AUTH_TOKEN = original;
});

describe('bearerAuth', () => {
  it('returns 503 when MCP_AUTH_TOKEN is not configured', async () => {
    delete process.env.MCP_AUTH_TOKEN;
    const res = await makeApp().request('/mcp', { method: 'POST' });
    expect(res.status).toBe(503);
  });

  it('returns 401 when the Authorization header is missing', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret';
    const res = await makeApp().request('/mcp', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on a wrong token', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret';
    const res = await makeApp().request('/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
    });
    expect(res.status).toBe(401);
  });

  it('passes through with the correct token', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret';
    const res = await makeApp().request('/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    });
    expect(res.status).toBe(200);
  });
});
