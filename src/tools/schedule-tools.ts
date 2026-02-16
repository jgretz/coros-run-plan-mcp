import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { querySchedule, scheduleWorkout, unscheduleWorkout } from '../api/schedule.ts';
import { SPORT_TYPE_LABELS, mapSportLabel } from '../config.ts';

const DaySchema = z.string().regex(/^\d{8}$/, 'Day must be YYYYMMDD format');

export function registerScheduleTools(server: McpServer) {
  server.registerTool(
    'get_calendar',
    {
      description: 'Get scheduled workouts for a date range from the COROS training calendar.',
      inputSchema: {
        startDay: DaySchema.describe('Start date in YYYYMMDD format'),
        endDay: DaySchema.describe('End date in YYYYMMDD format'),
      },
    },
    async ({ startDay, endDay }) => {
      const result = await querySchedule(startDay, endDay);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to get calendar: ${result.error}` }], isError: true };
      }

      const { entities, programs } = result.value;

      // programs are linked to entities via idInPlan = planProgramId
      const programByIdInPlan = new Map(programs.map((p) => [String(p.idInPlan), p]));

      if (!entities || entities.length === 0) {
        return { content: [{ type: 'text' as const, text: `No scheduled workouts between ${startDay} and ${endDay}.` }] };
      }

      const lines = entities.map((entity) => {
        const program = programByIdInPlan.get(String(entity.planProgramId));
        const name = entity.sportData?.name ?? program?.name ?? 'Unknown';
        const sport = entity.sportData?.sportType ?? program?.sportType;
        const sportLabel = sport != null ? (SPORT_TYPE_LABELS[sport] ?? `type ${sport}`) : 'Unknown';
        const load = entity.sportData?.trainingLoad ?? program?.trainingLoad ?? 0;
        const completed = entity.labelId ? ' [completed]' : '';
        return `- ${entity.happenDay}: ${name} (${sportLabel}, load: ${load}, entity ID: ${entity.id})${completed}`;
      });

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.registerTool(
    'schedule_workout',
    {
      description: 'Add a saved workout to the COROS training calendar on a specific date.',
      inputSchema: {
        programId: z.string().describe('The workout program ID to schedule (from list_workouts)'),
        day: DaySchema.describe('Date to schedule the workout on (YYYYMMDD)'),
        sportType: z.enum(['run', 'bike']).describe('Sport type of the workout'),
      },
    },
    async ({ programId, day, sportType }) => {
      const sport = mapSportLabel(sportType);
      const result = await scheduleWorkout(programId, day, sport);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to schedule workout: ${result.error}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: `Workout ${programId} scheduled for ${day}.` }],
      };
    },
  );

  server.registerTool(
    'unschedule_workout',
    {
      description: 'Remove a scheduled workout from the COROS training calendar. Requires the entity ID from get_calendar and the date range to locate it.',
      inputSchema: {
        entityId: z.string().describe('The schedule entity ID (from get_calendar)'),
        day: DaySchema.describe('Date the workout is scheduled on (YYYYMMDD)'),
      },
    },
    async ({ entityId, day }) => {
      const result = await unscheduleWorkout(entityId, day, day);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to unschedule workout: ${result.error}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: `Workout removed from ${day}.` }],
      };
    },
  );
}
