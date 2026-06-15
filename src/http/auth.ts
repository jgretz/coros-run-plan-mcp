import type { Context, Next } from 'hono';

// Bearer-token gate for the hosted MCP endpoint. Fails closed: if
// MCP_AUTH_TOKEN is not configured the endpoint is unusable rather than open.
export async function bearerAuth(c: Context, next: Next): Promise<Response | void> {
  const expected = process.env.MCP_AUTH_TOKEN;
  if (!expected) {
    return c.json({ error: 'Server misconfigured: MCP_AUTH_TOKEN is not set' }, 503);
  }

  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (token !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
}
