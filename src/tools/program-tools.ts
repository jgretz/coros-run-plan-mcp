import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listPrograms, getProgram, createProgram, deletePrograms } from '../api/programs.ts';
import { SPORT_TYPE_LABELS, parseSportType } from '../config.ts';
import { ExerciseSchema, IntervalGroupSchema, buildExercises } from '../exercises.ts';

export function registerProgramTools(server: McpServer) {
  server.registerTool(
    'list_workouts',
    {
      description: 'List saved workouts from COROS Training Hub. Returns workout summaries.',
      inputSchema: {
        sportType: z.enum(['run', 'bike']).optional().describe('Filter by sport type'),
        nameFilter: z.string().optional().describe('Filter by name (case-insensitive substring match)'),
      },
    },
    async ({ sportType, nameFilter }) => {
      const result = await listPrograms();
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to list workouts: ${result.error}` }], isError: true };
      }

      let programs = result.value;

      if (sportType) {
        const typeNum = parseSportType(sportType);
        programs = programs.filter((p) => p.sportType === typeNum);
      }

      if (nameFilter) {
        const lower = nameFilter.toLowerCase();
        programs = programs.filter((p) => p.name.toLowerCase().includes(lower));
      }

      const text = programs.length === 0
        ? 'No workouts found.'
        : programs
            .map((p) => `- ${p.name} (${SPORT_TYPE_LABELS[p.sportType] ?? 'Unknown'}, ID: ${p.id}, load: ${p.essence || p.trainingLoad})`)
            .join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'get_workout',
    {
      description: 'Get full details of a saved workout by ID, including all exercise steps.',
      inputSchema: {
        id: z.string().describe('The workout ID'),
      },
    },
    async ({ id }) => {
      const result = await getProgram(id);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to get workout: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(result.value, null, 2) }] };
    },
  );

  server.registerTool(
    'create_workout',
    {
      description: 'Create a new run or bike workout with structured exercise steps. Supports warmup, steady blocks, interval groups, and cooldown.',
      inputSchema: {
        name: z.string().describe('Workout name'),
        sportType: z.enum(['run', 'bike']).describe('Sport type'),
        description: z.string().optional().describe('Workout description'),
        warmup: ExerciseSchema.optional().describe('Warmup step'),
        intervals: IntervalGroupSchema.optional().describe('Interval group (repeating training + recovery)'),
        steadyBlocks: z.array(ExerciseSchema).optional().describe('Steady-state training blocks (non-interval)'),
        cooldown: ExerciseSchema.optional().describe('Cooldown step'),
      },
    },
    async ({ name, sportType, description, warmup, intervals, steadyBlocks, cooldown }) => {
      const sport = parseSportType(sportType);
      const exercisesResult = buildExercises(sport, { warmup, intervals, steadyBlocks, cooldown });
      if (!exercisesResult.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to build workout: ${exercisesResult.error}` }], isError: true };
      }

      const exercises = exercisesResult.value;

      if (exercises.length === 0) {
        return { content: [{ type: 'text' as const, text: 'Workout must have at least one exercise step.' }], isError: true };
      }

      const result = await createProgram({
        name,
        sportType: sport,
        overview: description ?? '',
        exercises,
      });

      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to create workout: ${result.error}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: `Workout "${name}" created (ID: ${result.value})` }],
      };
    },
  );

  server.registerTool(
    'delete_workout',
    {
      description: 'Delete one or more saved workouts by ID.',
      inputSchema: {
        programIds: z.array(z.string()).min(1).describe('Array of workout program IDs to delete'),
      },
    },
    async ({ programIds }) => {
      const result = await deletePrograms(programIds);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to delete: ${result.error}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: `Deleted ${programIds.length} workout(s).` }],
      };
    },
  );
}
