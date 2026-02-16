import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { login } from '../auth/auth.ts';
import type { Region } from '../types.ts';

export function registerAuthTools(server: McpServer) {
  server.tool(
    'coros_login',
    'Authenticate with COROS Training Hub. Uses env vars by default, or provide credentials directly.',
    {
      email: z.string().optional().describe('COROS account email (defaults to COROS_EMAIL env var)'),
      password: z.string().optional().describe('COROS account password (defaults to COROS_PASSWORD env var)'),
      region: z.enum(['us', 'eu', 'cn']).optional().describe('COROS region (defaults to COROS_REGION env var or "us")'),
    },
    async ({ email, password, region }) => {
      const config = email && password
        ? { email, password, region: (region ?? 'us') as Region }
        : undefined;

      const result = await login(config);

      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Login failed: ${result.error}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: `Authenticated as user ${result.value.userId}` }],
      };
    },
  );
}
