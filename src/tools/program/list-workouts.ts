import { z } from 'zod';
import { defineTool } from '../types.ts';
import { listPrograms } from '../../api/programs.ts';
import { SPORT_TYPE_LABELS, parseSportType } from '../../config.ts';
import { capOutput } from '../../utils.ts';

export const listWorkouts = defineTool({
  name: 'list_workouts',
  description:
    'List saved workouts from COROS Training Hub. Returns workout summaries.',
  inputSchema: {
    sportType: z
      .enum(['run', 'bike'])
      .optional()
      .describe('Filter by sport type'),
    nameFilter: z
      .string()
      .optional()
      .describe('Filter by name (case-insensitive substring match)'),
    limit: z
      .number()
      .int()
      .positive()
      .default(20)
      .describe('Max results to return (default 20)'),
  },
  async handler({ sportType, nameFilter, limit }) {
    const typeNum = sportType ? parseSportType(sportType) : undefined;
    const result = await listPrograms(typeNum);
    if (!result.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to list workouts: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    let programs = result.value;

    if (nameFilter) {
      const lower = nameFilter.toLowerCase();
      programs = programs.filter((p) =>
        p.name.toLowerCase().includes(lower),
      );
    }

    const total = programs.length;
    const page = programs.slice(0, limit);

    if (page.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No workouts found.' }] };
    }

    const header =
      total > limit
        ? `Showing ${limit} of ${total} — pass a higher limit to see more.\n\n`
        : '';

    const lines = page.map(
      (p) =>
        `- ${p.name} (${SPORT_TYPE_LABELS[p.sportType] ?? 'Unknown'}, ID: ${p.id}, load: ${p.essence || p.trainingLoad})`,
    );

    return {
      content: [{ type: 'text' as const, text: capOutput(header + lines.join('\n')) }],
    };
  },
});
