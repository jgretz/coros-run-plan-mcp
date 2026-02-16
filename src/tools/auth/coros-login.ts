import { z } from 'zod';
import { defineTool } from '../types.ts';
import { login } from '../../auth/auth.ts';

export const corosLogin = defineTool({
  name: 'coros_login',
  description:
    'Authenticate with COROS Training Hub. Uses env vars by default, or provide credentials directly.',
  inputSchema: {
    email: z
      .string()
      .optional()
      .describe('COROS account email (defaults to COROS_EMAIL env var)'),
    password: z
      .string()
      .optional()
      .describe(
        'COROS account password (defaults to COROS_PASSWORD env var)',
      ),
    region: z
      .enum(['us', 'eu', 'cn'])
      .optional()
      .describe(
        'COROS region (defaults to COROS_REGION env var or "us")',
      ),
  },
  async handler({ email, password, region }) {
    const config =
      email && password
        ? { email, password, region: region ?? 'us' }
        : undefined;

    const result = await login(config);

    if (!result.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Login failed: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Authenticated as user ${result.value.userId}`,
        },
      ],
    };
  },
});
