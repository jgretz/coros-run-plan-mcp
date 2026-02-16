import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAuthTools } from './tools/auth-tools.ts';
import { registerProgramTools } from './tools/program-tools.ts';
import { registerScheduleTools } from './tools/schedule-tools.ts';

const server = new McpServer({
  name: 'coros',
  version: '0.1.0',
});

registerAuthTools(server);
registerProgramTools(server);
registerScheduleTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
