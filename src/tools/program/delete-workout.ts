import { z } from 'zod';
import { defineTool } from '../types.ts';
import { deletePrograms } from '../../api/programs.ts';

export const deleteWorkout = defineTool({
  name: 'delete_workout',
  description: 'Delete one or more saved workouts by ID.',
  inputSchema: {
    programIds: z
      .array(z.string())
      .min(1)
      .describe('Array of workout program IDs to delete'),
  },
  async handler({ programIds }) {
    const result = await deletePrograms(programIds);
    if (!result.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to delete: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Deleted ${programIds.length} workout(s).`,
        },
      ],
    };
  },
});
