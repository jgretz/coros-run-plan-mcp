import { z } from 'zod';
import { defineTool } from '../types.ts';
import { getProgram } from '../../api/programs.ts';

export const getWorkout = defineTool({
  name: 'get_workout',
  description:
    'Get full details of a saved workout by ID, including all exercise steps.',
  inputSchema: {
    id: z.string().describe('The workout ID'),
  },
  async handler({ id }) {
    const result = await getProgram(id);
    if (!result.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to get workout: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result.value, null, 2),
        },
      ],
    };
  },
});
