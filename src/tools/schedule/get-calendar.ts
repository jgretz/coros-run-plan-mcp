import { z } from 'zod';
import { defineTool } from '../types.ts';
import { DaySchema } from '../schemas.ts';
import { querySchedule } from '../../api/schedule.ts';
import { SPORT_TYPE_LABELS } from '../../config.ts';
import { capOutput } from '../../utils.ts';

export const getCalendar = defineTool({
  name: 'get_calendar',
  description:
    'Get scheduled workouts for a date range from the COROS training calendar.',
  inputSchema: {
    startDay: DaySchema.describe('Start date in YYYYMMDD format'),
    endDay: DaySchema.describe('End date in YYYYMMDD format'),
    limit: z
      .number()
      .int()
      .positive()
      .default(20)
      .describe('Max results to return (default 20)'),
  },
  async handler({ startDay, endDay, limit }) {
    const result = await querySchedule(startDay, endDay);
    if (!result.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to get calendar: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    const { entities, programs } = result.value;

    const programByIdInPlan = new Map(
      programs.map((p) => [String(p.idInPlan), p]),
    );

    if (!entities || entities.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No scheduled workouts between ${startDay} and ${endDay}.`,
          },
        ],
      };
    }

    const total = entities.length;
    const page = entities.slice(0, limit);

    const lines = page.map((entity) => {
      const program = programByIdInPlan.get(String(entity.planProgramId));
      const name = entity.sportData?.name ?? program?.name ?? 'Unknown';
      const sport = entity.sportData?.sportType ?? program?.sportType;
      const sportLabel =
        sport != null
          ? (SPORT_TYPE_LABELS[sport as keyof typeof SPORT_TYPE_LABELS] ??
            `type ${sport}`)
          : 'Unknown';
      const load =
        entity.sportData?.trainingLoad ?? program?.trainingLoad ?? 0;
      const completed = entity.labelId ? ' [completed]' : '';
      return `- ${entity.happenDay}: ${name} (${sportLabel}, load: ${load}, entity ID: ${entity.id})${completed}`;
    });

    const header =
      total > limit
        ? `Showing ${limit} of ${total} — pass a higher limit to see more.\n\n`
        : '';

    return {
      content: [
        { type: 'text' as const, text: capOutput(header + lines.join('\n')) },
      ],
    };
  },
});
