import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.ts';

// Local dev entry — stdio transport. The hosted entry is src/http.ts.
const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
