import { z } from 'zod';
import { defineTool } from '../types.ts';
import { getProgram } from '../../api/programs.ts';
import { capOutput, formatProgram, stripProgram } from '../../utils.ts';

export const getWorkout = defineTool({
  name: 'get_workout',
  description:
    'Get full details of a saved workout by ID, including all exercise steps.',
  inputSchema: {
    id: z.string().describe('The workout ID'),
    detail: z
      .enum(['summary', 'full'])
      .default('summary')
      .describe(
        'summary: readable text (default). full: complete JSON response.',
      ),
  },
  async handler({ id, detail }) {
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

    const text =
      detail === 'full'
        ? JSON.stringify(stripProgram(result.value))
        : formatProgram(result.value);

    return {
      content: [{ type: 'text' as const, text: capOutput(text) }],
    };
  },
});
