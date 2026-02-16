import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import type { ScheduleQueryResponse, Program, ScheduleEntity } from '../../src/types.ts';
import { registerScheduleTools } from '../../src/tools/schedule-tools.ts';

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

function makeEntity(overrides?: Partial<ScheduleEntity>): ScheduleEntity {
  return {
    id: 'ent-1',
    happenDay: 20260216,
    idInPlan: '7',
    planProgramId: '5',
    sortNo: 0,
    executeStatus: 0,
    ...overrides,
  };
}

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

type Handler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;

function captureHandlers(): Map<string, Handler> {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => {
      handlers.set(name, handler);
    },
  };
  registerScheduleTools(server as never);
  return handlers;
}

const handlers = captureHandlers();
const getCalendar = handlers.get('get_calendar')!;
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

describe('get_calendar', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should format entities with program name, sport label, load, and entity ID', async () => {
    const program = makeProgram({ idInPlan: 5 });
    const entity = makeEntity({ planProgramId: '5' });
    const plan = makePlan({ entities: [entity], programs: [program] });
    globalThis.fetch = mock(() => Promise.resolve(apiResponse(plan))) as unknown as typeof fetch;

    const result = await getCalendar({ startDay: '20260216', endDay: '20260216' });

    const text = result.content[0]!.text;
    expect(text).toContain('Easy Run');
    expect(text).toContain('Run');
    expect(text).toContain('load: 50');
    expect(text).toContain('entity ID: ent-1');
  });

  it('should show "No scheduled workouts" when entities is empty', async () => {
    const plan = makePlan({ entities: [] });
    globalThis.fetch = mock(() => Promise.resolve(apiResponse(plan))) as unknown as typeof fetch;

    const result = await getCalendar({ startDay: '20260216', endDay: '20260216' });

    expect(result.content[0]!.text).toContain('No scheduled workouts');
  });

  it('should prefer sportData fields over program fields', async () => {
    const program = makeProgram({ idInPlan: 5, name: 'Program Name', trainingLoad: 50 });
    const entity = makeEntity({
      planProgramId: '5',
      sportData: {
        name: 'Sport Data Name',
        sportType: 2,
        distance: 10000,
        duration: 3600,
        trainingLoad: 80,
        happenDay: 20260216,
      },
    });
    const plan = makePlan({ entities: [entity], programs: [program] });
    globalThis.fetch = mock(() => Promise.resolve(apiResponse(plan))) as unknown as typeof fetch;

    const result = await getCalendar({ startDay: '20260216', endDay: '20260216' });

    const text = result.content[0]!.text;
    expect(text).toContain('Sport Data Name');
    expect(text).toContain('Bike');
    expect(text).toContain('load: 80');
  });

  it('should show [completed] when labelId is present', async () => {
    const program = makeProgram({ idInPlan: 5 });
    const entity = makeEntity({ planProgramId: '5', labelId: 'some-label' });
    const plan = makePlan({ entities: [entity], programs: [program] });
    globalThis.fetch = mock(() => Promise.resolve(apiResponse(plan))) as unknown as typeof fetch;

    const result = await getCalendar({ startDay: '20260216', endDay: '20260216' });

    expect(result.content[0]!.text).toContain('[completed]');
  });

  it('should handle missing program gracefully', async () => {
    const entity = makeEntity({ planProgramId: '999' });
    const plan = makePlan({ entities: [entity], programs: [] });
    globalThis.fetch = mock(() => Promise.resolve(apiResponse(plan))) as unknown as typeof fetch;

    const result = await getCalendar({ startDay: '20260216', endDay: '20260216' });

    expect(result.content[0]!.text).toContain('Unknown');
  });

  it('should return isError when API fails', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('server error'),
      } as unknown as Response),
    ) as unknown as typeof fetch;

    const result = await getCalendar({ startDay: '20260216', endDay: '20260216' });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Failed to get calendar');
  });
});
