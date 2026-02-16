import { z } from 'zod';
import { defineTool } from '../types.ts';
import { DaySchema } from '../schemas.ts';
import { unscheduleWorkout } from '../../api/schedule.ts';

export const unscheduleWorkoutTool = defineTool({
  name: 'unschedule_workout',
  description:
    'Remove a scheduled workout from the COROS training calendar. Requires the entity ID from get_calendar and the date range to locate it.',
  inputSchema: {
    entityId: z
      .string()
      .describe('The schedule entity ID (from get_calendar)'),
    day: DaySchema.describe(
      'Date the workout is scheduled on (YYYYMMDD)',
    ),
  },
  async handler({ entityId, day }) {
    const result = await unscheduleWorkout(entityId, day, day);
    if (!result.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to unschedule workout: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Workout removed from ${day}.`,
        },
      ],
    };
  },
});
