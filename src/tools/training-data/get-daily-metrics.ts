import { z } from 'zod';
import { defineTool } from '../types.ts';
import { fetchDailyMetrics } from '../../api/training-data.ts';
import { capOutput } from '../../utils.ts';
import type { DailyMetric } from '../../types.ts';

const MIN_WEEKS = 1;
const MAX_WEEKS = 24;

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function formatMetric(m: DailyMetric): string {
  const parts: string[] = [m.date];
  if (m.avgSleepHrv != null) {
    parts.push(
      m.baseline != null
        ? `HRV ${m.avgSleepHrv} (base ${m.baseline})`
        : `HRV ${m.avgSleepHrv}`,
    );
  }
  if (m.rhr != null) parts.push(`RHR ${m.rhr}`);
  if (m.trainingLoad != null) {
    parts.push(
      m.trainingLoadRatio != null
        ? `load ${m.trainingLoad} (ACWR ${m.trainingLoadRatio.toFixed(2)})`
        : `load ${m.trainingLoad}`,
    );
  }
  return `- ${parts.join(', ')}`;
}

function summarizeRange(values: Array<number | undefined>, label: string, digits = 0): string | null {
  const defined = values.filter((v): v is number => v != null);
  if (defined.length === 0) return null;
  const min = Math.min(...defined);
  const max = Math.max(...defined);
  const fmt = (n: number) => (digits > 0 ? n.toFixed(digits) : String(n));
  return min === max ? `${label} ${fmt(min)}` : `${label} ${fmt(min)}–${fmt(max)}`;
}

export const getDailyMetrics = defineTool({
  name: 'get_daily_metrics',
  description:
    'Fetch daily training metrics (RHR, training load, ACWR) for the last N weeks, plus a snapshot of VO2max/LTHR/stamina and HRV for the last ~7 days. VO2max/LTHR are fitness snapshots (not per-day); HRV comes from the dashboard endpoint which only returns ~7 days.',
  inputSchema: {
    weeks: z
      .number()
      .int()
      .default(4)
      .describe(`Number of weeks to fetch (${MIN_WEEKS}-${MAX_WEEKS}). Default 4.`),
  },
  async handler({ weeks }) {
    const clamped = Math.min(Math.max(weeks, MIN_WEEKS), MAX_WEEKS);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - clamped * 7);

    const result = await fetchDailyMetrics(toYYYYMMDD(start), toYYYYMMDD(end));
    if (!result.ok) {
      return {
        content: [{ type: 'text' as const, text: `Failed to get daily metrics: ${result.error}` }],
        isError: true,
      };
    }

    const { metrics, warnings } = result.value;
    if (metrics.length === 0) {
      const base = `No daily metrics for the last ${clamped} weeks.`;
      const footer = warnings.length > 0 ? `\n${warnings.join('\n')}` : '';
      return { content: [{ type: 'text' as const, text: base + footer }] };
    }

    // VO2max/LTHR/stamina are snapshot values that the API repeats per day;
    // summarize as a range at the top instead of noisy per-day repetition.
    const snapshotParts = [
      summarizeRange(metrics.map((m) => m.vo2max), 'VO2max'),
      summarizeRange(metrics.map((m) => m.lthr), 'LTHR'),
      summarizeRange(metrics.map((m) => m.staminaLevel), 'stamina', 1),
    ].filter((p): p is string => p != null);

    const hrvDays = metrics.filter((m) => m.avgSleepHrv != null).length;
    const hrvNote =
      hrvDays > 0 && hrvDays < metrics.length
        ? `\nNote: HRV covers last ~7 days (dashboard endpoint); ${hrvDays}/${metrics.length} days populated.`
        : '';

    const snapshot = snapshotParts.length > 0 ? `Snapshot: ${snapshotParts.join(' | ')}\n` : '';
    const header = `Last ${clamped} week(s), ${metrics.length} day(s):\n${snapshot}`;
    const body = metrics.map(formatMetric).join('\n');
    const warningBlock = warnings.length > 0 ? `\n${warnings.join('\n')}` : '';
    return {
      content: [{ type: 'text' as const, text: capOutput(header + body + hrvNote + warningBlock) }],
    };
  },
});
