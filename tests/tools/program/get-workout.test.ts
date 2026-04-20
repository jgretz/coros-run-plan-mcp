import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { ok } from '../../../src/utils.ts';
import type { Program } from '../../../src/types.ts';

let currentProgram: Program;

mock.module('../../../src/api/programs.ts', () => ({
  getProgram: (_id: string) => Promise.resolve(ok(currentProgram)),
}));

type Tool = typeof import('../../../src/tools/program/get-workout.ts')['getWorkout'];
let getWorkout: Tool;

beforeAll(async function () {
  const mod = await import('../../../src/tools/program/get-workout.ts');
  getWorkout = mod.getWorkout;
});

describe('get_workout detail:full', () => {
  it('should strip noisy program/exercise fields and humanize overview', async () => {
    currentProgram = {
      id: '1',
      name: 'Long Run',
      sportType: 1,
      overview: '',
      essence: 60,
      trainingLoad: 60,
      exerciseNum: 1,
      distance: 15000,
      duration: 4500,
      exercises: [
        {
          exerciseType: 1,
          originId: '1',
          name: 'T1120',
          overview: 'sid_run_warm_up_dist',
          sortNo: 0,
          targetType: 2,
          targetValue: 600,
          intensityType: 0,
          intensityValue: 0,
          intensityValueExtend: 0,
        },
      ],
    };
    // attach noisy fields that should be stripped
    Object.assign(currentProgram, {
      headPic: 'https://example/cover.jpg',
      pbVersion: 8,
      version: 3,
    });
    Object.assign(currentProgram.exercises[0]!, {
      videoInfos: [{ url: 'x' }],
      videoUrl: 'https://example/video.mp4',
      thumbnailUrl: 'https://example/thumb.jpg',
    });

    const result = await getWorkout.handler({ id: '1', detail: 'full' }, {} as never);
    const text = (result.content[0] as { text: string }).text;

    expect(text).toContain('Long Run');
    expect(text).not.toContain('headPic');
    expect(text).not.toContain('pbVersion');
    expect(text).not.toContain('videoInfos');
    expect(text).not.toContain('videoUrl');
    expect(text).not.toContain('thumbnailUrl');
    expect(text).not.toContain('sid_run_');
    expect(text).toContain('Warm up dist');
  });

  it('should still return the formatted summary for detail:summary', async () => {
    currentProgram = {
      id: '1',
      name: 'Easy Run',
      sportType: 1,
      overview: '',
      essence: 40,
      trainingLoad: 40,
      exerciseNum: 0,
      distance: 0,
      duration: 0,
      exercises: [],
    };

    const result = await getWorkout.handler({ id: '1', detail: 'summary' }, {} as never);
    expect((result.content[0] as { text: string }).text).toContain('Easy Run');
  });
});
