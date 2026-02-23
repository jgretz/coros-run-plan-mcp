import { z } from 'zod';
import { defineTool } from '../types.ts';
import { createProgram } from '../../api/programs.ts';
import { parseSportType } from '../../config.ts';
import {
  ExerciseSchema,
  IntervalGroupSchema,
  buildExercises,
} from '../../exercises.ts';

export const createWorkout = defineTool({
  name: 'create_workout',
  description:
    'Create a new run or bike workout with structured exercise steps. Supports warmup, steady blocks, interval groups, and cooldown.',
  inputSchema: {
    name: z.string().describe('Workout name'),
    sportType: z.enum(['run', 'bike']).describe('Sport type'),
    description: z.string().optional().describe('Workout description'),
    warmup: ExerciseSchema.optional().describe('Warmup step'),
    intervals: z
      .array(IntervalGroupSchema)
      .optional()
      .describe('Interval groups (each is a repeating training + recovery pair)'),
    steadyBlocks: z
      .array(ExerciseSchema)
      .optional()
      .describe('Steady-state training blocks (non-interval)'),
    cooldown: ExerciseSchema.optional().describe('Cooldown step'),
  },
  async handler({
    name,
    sportType,
    description,
    warmup,
    intervals,
    steadyBlocks,
    cooldown,
  }) {
    const sport = parseSportType(sportType);
    const exercisesResult = buildExercises(sport, {
      warmup,
      intervals,
      steadyBlocks,
      cooldown,
    });
    if (!exercisesResult.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to build workout: ${exercisesResult.error}`,
          },
        ],
        isError: true,
      };
    }

    const exercises = exercisesResult.value;

    if (exercises.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Workout must have at least one exercise step.',
          },
        ],
        isError: true,
      };
    }

    const result = await createProgram({
      name,
      sportType: sport,
      overview: description ?? '',
      exercises,
    });

    if (!result.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to create workout: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Workout "${name}" created (ID: ${result.value})`,
        },
      ],
    };
  },
});
