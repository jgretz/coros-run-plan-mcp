import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ok, err } from '../../src/utils.ts';
import type { ScheduleQueryResponse, Program } from '../../src/types.ts';

function makePlan(overrides?: Partial<ScheduleQueryResponse>): ScheduleQueryResponse {
  return {
    id: 'plan-1',
    name: 'My Plan',
    startDay: 20260216,
    endDay: 20260216,
    maxPlanProgramId: '5',
    entities: [],
    programs: [],
    ...overrides,
  };
}

function makeProgram(overrides?: Partial<Program>): Program {
  return {
    id: 'prog-1',
    name: 'Easy Run',
    sportType: 1,
    overview: '',
    essence: 50,
    trainingLoad: 50,
    exercises: [],
    exerciseNum: 0,
    distance: 5000,
    duration: 1800,
    ...overrides,
  };
}

// Mock auth layer so client.ts can resolve tokens
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

// Mock programs.ts so getProgram is controlled
// Spread real module to avoid clobbering exports used by other test files
const realPrograms = await import('../../src/api/programs.ts');
const mockGetProgram = mock(() => Promise.resolve(ok(makeProgram())));
mock.module('../../src/api/programs.ts', () => ({
  ...realPrograms,
  getProgram: mockGetProgram,
}));

const { scheduleWorkout, unscheduleWorkout } = await import('../../src/api/schedule.ts');

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

describe('schedule', () => {
  beforeEach(() => {
    mockGetProgram.mockReset();
    mockGetProgram.mockImplementation(() => Promise.resolve(ok(makeProgram())));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('scheduleWorkout', () => {
    it('should build payload with maxPlanProgramId + 1', async () => {
      const plan = makePlan({ maxPlanProgramId: '10' });
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(apiResponse(plan)); // querySchedule
        return Promise.resolve(apiResponse(undefined)); // schedule/update
      }) as unknown as typeof fetch;

      const result = await scheduleWorkout('prog-1', '20260216', 1);

      expect(result.ok).toBe(true);
      // verify the POST payload sent to schedule/update
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;
      const updateCall = fetchMock.mock.calls[1]!;
      const body = JSON.parse(updateCall[1]?.body as string);
      expect(body.entities[0].idInPlan).toBe('11');
      expect(body.programs[0].idInPlan).toBe('11');
    });

    it('should return err when plan query fails', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve('server error'),
        } as unknown as Response),
      ) as unknown as typeof fetch;

      const result = await scheduleWorkout('prog-1', '20260216', 1);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('HTTP 500');
    });

    it('should return err when program fetch fails', async () => {
      globalThis.fetch = mock(() => Promise.resolve(apiResponse(makePlan()))) as unknown as typeof fetch;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockGetProgram.mockImplementation((() => Promise.resolve(err('program not found'))) as any);

      const result = await scheduleWorkout('prog-1', '20260216', 1);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('program not found');
    });
  });

  describe('unscheduleWorkout', () => {
    it('should find entity and send delete with status 3', async () => {
      const plan = makePlan({
        entities: [
          {
            id: 'ent-1',
            happenDay: 20260216,
            idInPlan: '7',
            planProgramId: '5',
            sortNo: 0,
            executeStatus: 0,
          },
        ],
      });
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(apiResponse(plan)); // querySchedule
        return Promise.resolve(apiResponse(undefined)); // schedule/update
      }) as unknown as typeof fetch;

      const result = await unscheduleWorkout('ent-1', '20260216', '20260216');

      expect(result.ok).toBe(true);
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;
      const updateCall = fetchMock.mock.calls[1]!;
      const body = JSON.parse(updateCall[1]?.body as string);
      expect(body.versionObjects[0].status).toBe(3);
    });

    it('should return err when entity not found', async () => {
      globalThis.fetch = mock(() => Promise.resolve(apiResponse(makePlan({ entities: [] })))) as unknown as typeof fetch;

      const result = await unscheduleWorkout('missing', '20260216', '20260216');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('not found');
    });
  });
});
