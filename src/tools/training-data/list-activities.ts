import { z } from 'zod';
import { defineTool } from '../types.ts';
import { DaySchema } from '../schemas.ts';
import { fetchActivities } from '../../api/training-data.ts';
import { capOutput } from '../../utils.ts';
import type { ActivitySummary } from '../../types.ts';

function formatDuration(seconds?: number): string {
  if (!seconds) return '?';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function formatDistance(meters?: number): string {
  if (!meters) return '?';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}

function formatActivity(a: ActivitySummary): string {
  const sport = a.sportName ?? 'Unknown';
  const dur = formatDuration(a.durationSeconds);
  const dist = formatDistance(a.distanceMeters);
  const load = a.trainingLoad != null ? `load ${a.trainingLoad}` : 'load ?';
  const power = a.avgPower != null ? `, ${a.avgPower}W avg` : '';
  const hr = a.avgHr != null ? `, ${a.avgHr}bpm avg` : '';
  const name = a.name ?? sport;
  return `- ${a.startTime ?? '?'}: ${name} (${sport}, ${dur}, ${dist}, ${load}${power}${hr}, id: ${a.activityId})`;
}

export const listActivities = defineTool({
  name: 'list_activities',
  description:
    'List completed COROS activities for a date range. Use to see what was recently trained before scheduling the next workout.',
  inputSchema: {
    startDay: DaySchema.describe('Start date in YYYYMMDD format'),
    endDay: DaySchema.describe('End date in YYYYMMDD format'),
    limit: z.number().int().positive().default(20).describe('Max results (default 20)'),
    page: z.number().int().positive().default(1).describe('Page number (default 1)'),
  },
  async handler({ startDay, endDay, limit, page }) {
    const result = await fetchActivities(startDay, endDay, page, limit);
    if (!result.ok) {
      return {
        content: [{ type: 'text' as const, text: `Failed to list activities: ${result.error}` }],
        isError: true,
      };
    }

    const { activities, total } = result.value;
    if (activities.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No activities between ${startDay} and ${endDay}.`,
          },
        ],
      };
    }

    const header = total > activities.length
      ? `Showing ${activities.length} of ${total} — raise limit or paginate to see more.\n\n`
      : '';
    const body = activities.map(formatActivity).join('\n');
    return { content: [{ type: 'text' as const, text: capOutput(header + body) }] };
  },
});
