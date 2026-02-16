import { z } from 'zod';
import { defineTool } from '../types.ts';
import { DaySchema } from '../schemas.ts';
import { scheduleWorkout } from '../../api/schedule.ts';
import { parseSportType } from '../../config.ts';

export const scheduleWorkoutTool = defineTool({
  name: 'schedule_workout',
  description:
    'Add a saved workout to the COROS training calendar on a specific date.',
  inputSchema: {
    programId: z
      .string()
      .describe(
        'The workout program ID to schedule (from list_workouts)',
      ),
    day: DaySchema.describe(
      'Date to schedule the workout on (YYYYMMDD)',
    ),
    sportType: z
      .enum(['run', 'bike'])
      .describe('Sport type of the workout'),
  },
  async handler({ programId, day, sportType }) {
    const sport = parseSportType(sportType);
    const result = await scheduleWorkout(programId, day, sport);
    if (!result.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to schedule workout: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Workout ${programId} scheduled for ${day}.`,
        },
      ],
    };
  },
});
