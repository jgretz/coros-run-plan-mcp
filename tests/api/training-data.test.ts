import { describe, it, expect, mock, afterEach } from 'bun:test';
import { ok } from '../../src/utils.ts';
import type { RawActivity, RawDailyDetail, DailyMetric } from '../../src/types.ts';

const mockGetToken = mock(() => Promise.resolve(ok({ accessToken: 'tok', userId: 'u1' })));
const mockRefreshToken = mock(() => Promise.resolve(ok({ accessToken: 'tok', userId: 'u1' })));

mock.module('../../src/auth/auth.ts', () => ({
  getToken: mockGetToken,
  refreshToken: mockRefreshToken,
  getRegion: () => 'us' as const,
}));

mock.module('../../src/auth/store.ts', () => ({
  readAuthConfig: mock(() => ok({ email: 'a@b.com', password: 'p', region: 'us' as const })),
}));

const {
  parseActivity,
  parseDailyDetail,
  mergeAnalyse,
  fetchActivities,
  fetchActivityDetail,
  fetchDailyMetrics,
  stripActivityDetail,
} = await import('../../src/api/training-data.ts');

const originalFetch = globalThis.fetch;

describe('parseActivity', () => {
  it('should map labelId to activityId', () => {
    const raw: RawActivity = { labelId: 42, name: 'Ride', sportType: 200 };
    const result = parseActivity(raw);
    expect(result.activityId).toBe('42');
    expect(result.sportName).toBe('Road Bike');
  });

  it('should fall back to remark when name missing', () => {
    const raw: RawActivity = { labelId: '1', remark: 'Note' };
    expect(parseActivity(raw).name).toBe('Note');
  });

  it('should divide calorie by 1000 and round', () => {
    expect(parseActivity({ labelId: '1', calorie: 425000 }).calories).toBe(425);
    expect(parseActivity({ labelId: '1', totalCalorie: 123456 }).calories).toBe(123);
  });

  it('should treat zero calories as undefined', () => {
    expect(parseActivity({ labelId: '1', calorie: 0 }).calories).toBeUndefined();
  });

  it('should prefer distance over totalDistance', () => {
    expect(parseActivity({ labelId: '1', distance: 5000, totalDistance: 9999 }).distanceMeters).toBe(5000);
    expect(parseActivity({ labelId: '1', totalDistance: 9999 }).distanceMeters).toBe(9999);
  });

  it('should map np to normalizedPower', () => {
    expect(parseActivity({ labelId: '1', np: 240 }).normalizedPower).toBe(240);
  });

  it('should label unknown sport types with fallback', () => {
    expect(parseActivity({ labelId: '1', sportType: 9999 }).sportName).toBe('Sport 9999');
  });
});

describe('parseDailyDetail', () => {
  it('should map happenDay to date string', () => {
    const raw: RawDailyDetail = { happenDay: 20260101, rhr: 45, trainingLoad: 100 };
    const result = parseDailyDetail(raw);
    expect(result.date).toBe('20260101');
    expect(result.rhr).toBe(45);
    expect(result.trainingLoad).toBe(100);
  });

  it('should rename sleepHrvBase to baseline and tiredRateNew to tiredRate', () => {
    const result = parseDailyDetail({
      happenDay: 20260101,
      sleepHrvBase: 48.5,
      tiredRateNew: 0.7,
    });
    expect(result.baseline).toBe(48.5);
    expect(result.tiredRate).toBe(0.7);
  });
});

describe('mergeAnalyse', () => {
  it('should merge vo2max/lthr/stamina from t7dayList onto matching dates', () => {
    const metrics: DailyMetric[] = [
      { date: '20260101', rhr: 45 },
      { date: '20260102', rhr: 46 },
    ];
    const t7: RawDailyDetail[] = [
      { happenDay: 20260101, vo2max: 55, lthr: 170, staminaLevel: 4.2 },
    ];
    const merged = mergeAnalyse(metrics, t7);
    expect(merged[0]!.vo2max).toBe(55);
    expect(merged[0]!.lthr).toBe(170);
    expect(merged[0]!.staminaLevel).toBe(4.2);
    expect(merged[1]!.vo2max).toBeUndefined();
  });

  it('should return metrics unchanged when t7dayList is undefined', () => {
    const metrics: DailyMetric[] = [{ date: '20260101', rhr: 45 }];
    expect(mergeAnalyse(metrics, undefined)).toBe(metrics);
  });

  it('should skip t7 entries with no matching date', () => {
    const metrics: DailyMetric[] = [{ date: '20260101', rhr: 45 }];
    const merged = mergeAnalyse(metrics, [{ happenDay: 20250101, vo2max: 55 }]);
    expect(merged[0]!.vo2max).toBeUndefined();
  });
});

describe('stripActivityDetail', () => {
  it('should drop time-series arrays', () => {
    const stripped = stripActivityDetail({
      name: 'Ride',
      graphList: [1, 2, 3],
      frequencyList: [4, 5],
      gpsLightDuration: 10,
      avgHr: 140,
    });
    expect(stripped).not.toHaveProperty('graphList');
    expect(stripped).not.toHaveProperty('frequencyList');
    expect(stripped).not.toHaveProperty('gpsLightDuration');
    expect(stripped.name).toBe('Ride');
    expect(stripped.avgHr).toBe(140);
  });
});

describe('fetchActivities', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should parse dataList and totalCount', async () => {
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
            data: {
              dataList: [
                { labelId: 1, name: 'Morning Run', sportType: 100, totalTime: 1800, distance: 5000 },
              ],
              totalCount: 3,
            },
          }),
        text: () => Promise.resolve(''),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await fetchActivities('20260101', '20260107');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.total).toBe(3);
      expect(result.value.activities).toHaveLength(1);
      expect(result.value.activities[0]!.activityId).toBe('1');
      expect(result.value.activities[0]!.sportName).toBe('Running');
    }
  });

  it('should surface API errors', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            result: '2001',
            apiCode: '2001',
            message: 'bad date',
            data: null,
          }),
        text: () => Promise.resolve(''),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await fetchActivities('bad', 'bad');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('bad date');
  });
});

describe('fetchDailyMetrics', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return metrics with warnings when dashboard hangs past the timeout', async () => {
    globalThis.fetch = mock((url: string) => {
      if (typeof url !== 'string') return Promise.reject(new Error('bad url'));
      if (url.includes('/analyse/dayDetail/query')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            result: '0000',
            apiCode: '0000',
            message: '',
            data: { dayList: [{ happenDay: 20260301, rhr: 45, trainingLoad: 200 }] },
          }),
          text: () => Promise.resolve(''),
        } as unknown as Response);
      }
      if (url.includes('/analyse/query')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            result: '0000',
            apiCode: '0000',
            message: '',
            data: { t7dayList: [{ happenDay: 20260301, vo2max: 51 }] },
          }),
          text: () => Promise.resolve(''),
        } as unknown as Response);
      }
      // dashboard never resolves
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;

    const start = Date.now();
    const result = await fetchDailyMetrics('20260225', '20260303', {
      dashboardTimeoutMs: 50,
      analyseTimeoutMs: 2000,
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metrics).toHaveLength(1);
      expect(result.value.metrics[0]!.rhr).toBe(45);
      expect(result.value.metrics[0]!.vo2max).toBe(51);
      expect(result.value.warnings.some((w) => w.includes('HRV unavailable'))).toBe(true);
    }
  });

  it('should fail fast when dayDetail itself errors', async () => {
    globalThis.fetch = mock((url: string) => {
      if (url.includes('/analyse/dayDetail/query')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve({
            result: '2001', apiCode: '2001', message: 'bad range', data: null,
          }),
          text: () => Promise.resolve(''),
        } as unknown as Response);
      }
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;

    const result = await fetchDailyMetrics('bad', 'bad', {
      dashboardTimeoutMs: 50,
      analyseTimeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('bad range');
  });
});

describe('fetchActivityDetail', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should strip time-series and include userId from token', async () => {
    let capturedBody: string | undefined;
    let capturedContentType: string | undefined;
    globalThis.fetch = mock((_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      capturedContentType = (init?.headers as Record<string, string>)?.['Content-Type'];
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            result: '0000',
            apiCode: '0000',
            message: '',
            data: {
              name: 'Detail Ride',
              graphList: [1, 2],
              avgHr: 150,
            },
          }),
        text: () => Promise.resolve(''),
      } as unknown as Response);
    }) as unknown as typeof fetch;

    const result = await fetchActivityDetail('42', 200);

    expect(result.ok).toBe(true);
    expect(capturedContentType).toBe('application/x-www-form-urlencoded');
    expect(capturedBody).toContain('labelId=42');
    expect(capturedBody).toContain('userId=u1');
    expect(capturedBody).toContain('sportType=200');
    if (result.ok) {
      expect(result.value).not.toHaveProperty('graphList');
      expect(result.value.name).toBe('Detail Ride');
    }
  });
});
