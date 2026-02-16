import { z } from 'zod';
import { defineTool } from '../types.ts';
import { listPrograms } from '../../api/programs.ts';
import { SPORT_TYPE_LABELS, parseSportType } from '../../config.ts';

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
  },
  async handler({ sportType, nameFilter }) {
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

    const text =
      programs.length === 0
        ? 'No workouts found.'
        : programs
            .map(
              (p) =>
                `- ${p.name} (${SPORT_TYPE_LABELS[p.sportType] ?? 'Unknown'}, ID: ${p.id}, load: ${p.essence || p.trainingLoad})`,
            )
            .join('\n');

    return { content: [{ type: 'text' as const, text }] };
  },
});
