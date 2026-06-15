import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools/index.ts';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'coros',
    version: '0.1.0',
  });
  registerTools(server);
  return server;
}
