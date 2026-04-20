import { describe, it, expect, mock, afterEach } from 'bun:test';
import { getDailyMetrics } from '../../../src/tools/training-data/get-daily-metrics.ts';

const originalFetch = globalThis.fetch;

function json<T>(data: T) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data }),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

function makeResponse(url: string) {
  if (url.includes('/analyse/dayDetail/query')) {
    return json({
      dayList: [
        { happenDay: 20260301, rhr: 45, trainingLoad: 200, trainingLoadRatio: 1.1 },
        { happenDay: 20260302, rhr: 46, trainingLoad: 180, trainingLoadRatio: 1.05 },
      ],
    });
  }
  if (url.includes('/analyse/query')) {
    return json({
      t7dayList: [
        { happenDay: 20260301, vo2max: 55, lthr: 170, staminaLevel: 4.2 },
        { happenDay: 20260302, vo2max: 55, lthr: 170, staminaLevel: 4.2 },
      ],
    });
  }
  // /dashboard/query
  return json({
    summaryInfo: {
      sleepHrvData: {
        happenDay: 20260302,
        avgSleepHrv: 54,
        sleepHrvBase: 48,
        sleepHrvList: [
          { happenDay: 20260301, avgSleepHrv: 52, sleepHrvBase: 48 },
        ],
      },
    },
  });
}

describe('get_daily_metrics', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should render HRV per-day, RHR, load/ACWR, and snapshot VO2max/LTHR/stamina at top', async () => {
    globalThis.fetch = mock((url: string) => Promise.resolve(makeResponse(url))) as unknown as typeof fetch;

    const result = await getDailyMetrics.handler({ weeks: 4 }, {} as never);

    const text = (result.content[0] as { text: string }).text;
    // snapshot summary (single stable value, not per-day)
    expect(text).toContain('Snapshot:');
    expect(text).toContain('VO2max 55');
    expect(text).toContain('LTHR 170');
    expect(text).toContain('stamina 4.2');
    // per-day rows should NOT repeat VO2max
    const afterSnapshot = text.split('Snapshot:')[1] ?? '';
    expect(afterSnapshot.split('VO2max').length - 1).toBe(1); // appears only in header
    // per-day values
    expect(text).toContain('20260301');
    expect(text).toContain('HRV 52 (base 48)');
    expect(text).toContain('RHR 45');
    expect(text).toContain('load 200 (ACWR 1.10)');
    expect(text).toContain('20260302');
    expect(text).toContain('HRV 54');
  });

  it('should show a range for varying snapshot values', async () => {
    globalThis.fetch = mock((url: string) => {
      if (url.includes('/analyse/dayDetail/query')) {
        return Promise.resolve(json({
          dayList: [
            { happenDay: 20260301, rhr: 45, trainingLoad: 200 },
            { happenDay: 20260308, rhr: 46, trainingLoad: 180 },
          ],
        }));
      }
      if (url.includes('/analyse/query')) {
        return Promise.resolve(json({
          t7dayList: [
            { happenDay: 20260301, vo2max: 51 },
            { happenDay: 20260308, vo2max: 53 },
          ],
        }));
      }
      return Promise.resolve(json({}));
    }) as unknown as typeof fetch;

    const result = await getDailyMetrics.handler({ weeks: 4 }, {} as never);
    expect((result.content[0] as { text: string }).text).toContain('VO2max 51–53');
  });

  it('should note when HRV is partial', async () => {
    globalThis.fetch = mock((url: string) => {
      if (url.includes('/analyse/dayDetail/query')) {
        return Promise.resolve(json({
          dayList: [
            { happenDay: 20260301, rhr: 45, trainingLoad: 200 },
            { happenDay: 20260308, rhr: 46, trainingLoad: 180 },
            { happenDay: 20260315, rhr: 47, trainingLoad: 220 },
          ],
        }));
      }
      if (url.includes('/analyse/query')) return Promise.resolve(json({}));
      // dashboard only covers one day
      return Promise.resolve(json({
        summaryInfo: {
          sleepHrvData: {
            sleepHrvList: [
              { happenDay: 20260315, avgSleepHrv: 52, sleepHrvBase: 48 },
            ],
          },
        },
      }));
    }) as unknown as typeof fetch;

    const result = await getDailyMetrics.handler({ weeks: 4 }, {} as never);
    expect((result.content[0] as { text: string }).text).toContain('HRV covers last ~7 days');
  });

  it('should clamp weeks below 1 to 1', async () => {
    globalThis.fetch = mock((url: string) => Promise.resolve(makeResponse(url))) as unknown as typeof fetch;

    const result = await getDailyMetrics.handler({ weeks: 0 }, {} as never);
    expect((result.content[0] as { text: string }).text).toContain('Last 1 week(s)');
  });

  it('should clamp weeks above 24 to 24', async () => {
    globalThis.fetch = mock((url: string) => Promise.resolve(makeResponse(url))) as unknown as typeof fetch;

    const result = await getDailyMetrics.handler({ weeks: 99 }, {} as never);
    expect((result.content[0] as { text: string }).text).toContain('Last 24 week(s)');
  });

  it('should show "No daily metrics" when list is empty', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            result: '0000',
            apiCode: '0000',
            message: '',
            data: { dayList: [] },
          }),
        text: () => Promise.resolve(''),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await getDailyMetrics.handler({ weeks: 4 }, {} as never);
    expect((result.content[0] as { text: string }).text).toContain('No daily metrics');
  });
});
