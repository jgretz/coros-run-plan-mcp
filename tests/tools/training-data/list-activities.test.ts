import { describe, it, expect, mock, afterEach } from 'bun:test';
import { listActivities } from '../../../src/tools/training-data/list-activities.ts';

const originalFetch = globalThis.fetch;

function apiResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ result: '0000', apiCode: '0000', message: '', data }),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

describe('list_activities', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should render activities with sport name, duration, distance, load', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        apiResponse({
          dataList: [
            {
              labelId: 101,
              name: 'Tempo Run',
              sportType: 100,
              totalTime: 3600,
              distance: 12000,
              trainingLoad: 85,
              avgHr: 155,
              startTime: '20260220T0800',
            },
          ],
          totalCount: 1,
        }),
      ),
    ) as unknown as typeof fetch;

    const result = await listActivities.handler(
      { startDay: '20260220', endDay: '20260221', limit: 20, page: 1 },
      {} as never,
    );

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Tempo Run');
    expect(text).toContain('Running');
    expect(text).toContain('1h0m');
    expect(text).toContain('12.0km');
    expect(text).toContain('load 85');
    expect(text).toContain('155bpm avg');
    expect(text).toContain('id: 101');
  });

  it('should show "No activities" when list is empty', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(apiResponse({ dataList: [], totalCount: 0 })),
    ) as unknown as typeof fetch;

    const result = await listActivities.handler(
      { startDay: '20260220', endDay: '20260221', limit: 20, page: 1 },
      {} as never,
    );
    expect((result.content[0] as { text: string }).text).toContain('No activities');
  });

  it('should render avg power when present', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        apiResponse({
          dataList: [
            {
              labelId: 1,
              name: 'Ride',
              sportType: 200,
              totalTime: 2700,
              distance: 25000,
              trainingLoad: 100,
              avgPower: 240,
            },
          ],
          totalCount: 1,
        }),
      ),
    ) as unknown as typeof fetch;

    const result = await listActivities.handler(
      { startDay: '20260220', endDay: '20260221', limit: 20, page: 1 },
      {} as never,
    );
    expect((result.content[0] as { text: string }).text).toContain('240W avg');
  });
});
