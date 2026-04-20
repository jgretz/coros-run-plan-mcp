import { describe, it, expect, mock, afterEach } from 'bun:test';
import { getActivity } from '../../../src/tools/training-data/get-activity.ts';

const originalFetch = globalThis.fetch;

describe('get_activity', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return stripped detail without graphList', async () => {
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
              name: 'Long Ride',
              avgHr: 140,
              graphList: [1, 2, 3],
              frequencyList: [10, 20],
            },
          }),
        text: () => Promise.resolve(''),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await getActivity.handler({ id: '42', sportType: 200 }, {} as never);

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Long Ride');
    expect(text).toContain('140');
    expect(text).not.toContain('graphList');
    expect(text).not.toContain('frequencyList');
  });

  it('should surface API errors', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('server down'),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await getActivity.handler({ id: '42', sportType: 200 }, {} as never);
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Failed to get activity');
  });
});
