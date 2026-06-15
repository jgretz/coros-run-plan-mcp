import { Hono } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createServer } from './server.ts';
import { bearerAuth } from './http/auth.ts';

export const app = new Hono();

app.get('/ping', (c) => c.json({ alive: true }));

app.use('/mcp', bearerAuth);

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
