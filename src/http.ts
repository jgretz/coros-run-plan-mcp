import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer } from './server.ts';
import { authGate, protectedResourceMetadata } from './http/auth.ts';

export const app = new Hono();

app.get('/ping', (c) => c.json({ alive: true }));

// OAuth protected-resource metadata (RFC 9728) — public, so clients can
// discover the authorization server.
app.use('/.well-known/*', cors());
app.get('/.well-known/oauth-protected-resource', (c) => c.json(protectedResourceMetadata()));

app.use('/mcp', authGate);

// Stateless Streamable HTTP: a fresh server + transport per request.
app.all('/mcp', async (c) => {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

export default {
  port: Number(process.env.PORT ?? 3000),
  hostname: '0.0.0.0',
  fetch: app.fetch,
};
