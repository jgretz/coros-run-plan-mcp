import { describe, it, expect } from 'bun:test';
import { ok, err, formatError, isApiSuccess, formatProgram, stripProgram } from '../src/utils.ts';
import { SportType, ExerciseType, TargetType, IntensityType, type Exercise, type Program } from '../src/types.ts';

describe('Result', () => {
  it('should create ok result', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('should create err result', () => {
    const result = err('failed');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('failed');
  });
});

describe('formatError', () => {
  it('should extract message from Error instances', () => {
    expect(formatError('Op failed', new Error('boom'))).toBe('Op failed: boom');
  });

  it('should stringify non-Error values', () => {
    expect(formatError('Op failed', 'raw string')).toBe('Op failed: raw string');
  });
});

describe('isApiSuccess', () => {
  it('should return true when result is 0000', () => {
    expect(isApiSuccess({ result: '0000', apiCode: '1001', message: '', data: null })).toBe(true);
  });

  it('should return true when apiCode is 0000', () => {
    expect(isApiSuccess({ result: '1001', apiCode: '0000', message: '', data: null })).toBe(true);
  });

  it('should return false when neither is 0000', () => {
    expect(isApiSuccess({ result: '2001', apiCode: '2001', message: 'fail', data: null })).toBe(false);
  });
});

describe('enums', () => {
  it('should have correct sport types', () => {
    expect(SportType.Run).toBe(1);
    expect(SportType.Bike).toBe(2);
  });

  it('should have correct exercise types', () => {
    expect(ExerciseType.Group).toBe(0);
    expect(ExerciseType.Warmup).toBe(1);
    expect(ExerciseType.Training).toBe(2);
    expect(ExerciseType.Cooldown).toBe(3);
    expect(ExerciseType.Recovery).toBe(4);
  });

  it('should have correct target types', () => {
    expect(TargetType.Open).toBe(1);
    expect(TargetType.Time).toBe(2);
    expect(TargetType.Distance).toBe(5);
  });

  it('should have correct intensity types', () => {
    expect(IntensityType.None).toBe(0);
    expect(IntensityType.HeartRate).toBe(2);
    expect(IntensityType.Pace).toBe(3);
    expect(IntensityType.Power).toBe(6);
  });
});

function makeExercise(overrides: Partial<Exercise>): Exercise {
  return {
    exerciseType: ExerciseType.Training,
    originId: '0',
    name: 'T3001',
    overview: 'sid_run_training',
    sortNo: 0,
    targetType: TargetType.Time,
    targetValue: 300,
    intensityType: IntensityType.None,
    intensityValue: 0,
    intensityValueExtend: 0,
    ...overrides,
  };
}

describe('formatProgram exercise rendering', () => {
  it('should render standalone exercises with groupId "0"', () => {
    const program: Program = {
      id: '1',
      name: 'Race plan',
      sportType: SportType.Run,
      overview: 'Build to marathon effort over loop 2.',
      essence: 500,
      trainingLoad: 500,
      exerciseNum: 3,
      distance: 0,
      duration: 0,
      exercises: [
        makeExercise({
          exerciseType: ExerciseType.Warmup,
          sortNo: 0,
          targetType: TargetType.Time,
          targetValue: 600,
          intensityType: IntensityType.HeartRate,
          intensityValue: 120,
          intensityValueExtend: 140,
          groupId: '0',
          isGroup: false,
        }),
        makeExercise({
          exerciseType: ExerciseType.Training,
          sortNo: 16777216,
          targetType: TargetType.Distance,
          targetValue: 100000,
          intensityType: IntensityType.Pace,
          intensityValue: 300,
          intensityValueExtend: 320,
          groupId: '0',
          isGroup: false,
        }),
        makeExercise({
          exerciseType: ExerciseType.Cooldown,
          sortNo: 33554432,
          targetType: TargetType.Time,
          targetValue: 300,
          groupId: '0',
          isGroup: false,
        }),
      ],
    };

    const text = formatProgram(program);
    expect(text).toContain('Race plan');
    expect(text).toContain('Build to marathon effort');
    expect(text).toContain('Warmup');
    expect(text).toContain('Training');
    expect(text).toContain('Cooldown');
    expect(text).toContain('120-140bpm');
  });

  it('should render distance targets in kilometres (centimetres input)', () => {
    const program: Program = {
      id: '1',
      name: 'Half marathon',
      sportType: SportType.Run,
      overview: '',
      essence: 300,
      trainingLoad: 300,
      exerciseNum: 1,
      distance: 0,
      duration: 0,
      exercises: [
        makeExercise({
          exerciseType: ExerciseType.Training,
          targetType: TargetType.Distance,
          targetValue: 2110000, // 21.1km in centimetres
        }),
      ],
    };
    expect(formatProgram(program)).toContain('21.1km');
  });

  it('should render sub-kilometre distance in metres', () => {
    const program: Program = {
      id: '1',
      name: 'Short',
      sportType: SportType.Run,
      overview: '',
      essence: 0,
      trainingLoad: 0,
      exerciseNum: 1,
      distance: 0,
      duration: 0,
      exercises: [
        makeExercise({
          exerciseType: ExerciseType.Training,
          targetType: TargetType.Distance,
          targetValue: 50000, // 500m in centimetres
        }),
      ],
    };
    expect(formatProgram(program)).toContain('500m');
  });

  it('should render mixed standalone + repeat group in API order', () => {
    const group: Exercise = {
      exerciseType: ExerciseType.Group,
      originId: '0',
      id: 'g1',
      name: '',
      overview: '',
      sortNo: 16777216,
      targetType: TargetType.Open,
      targetValue: 0,
      intensityType: IntensityType.None,
      intensityValue: 0,
      intensityValueExtend: 0,
      isGroup: true,
      sets: 6,
      groupId: '0',
    };
    const program: Program = {
      id: '1',
      name: 'Hill repeats',
      sportType: SportType.Run,
      overview: '',
      essence: 300,
      trainingLoad: 300,
      exerciseNum: 5,
      distance: 0,
      duration: 0,
      exercises: [
        makeExercise({ exerciseType: ExerciseType.Warmup, sortNo: 0, groupId: '0' }),
        group,
        makeExercise({
          exerciseType: ExerciseType.Training,
          sortNo: 16777216 + 65536,
          targetType: TargetType.Time,
          targetValue: 60,
          intensityType: IntensityType.HeartRate,
          intensityValue: 160,
          intensityValueExtend: 180,
          groupId: 'g1',
        }),
        makeExercise({
          exerciseType: ExerciseType.Recovery,
          sortNo: 16777216 + 2 * 65536,
          targetType: TargetType.Time,
          targetValue: 90,
          groupId: 'g1',
        }),
        makeExercise({ exerciseType: ExerciseType.Cooldown, sortNo: 33554432, groupId: '0' }),
      ],
    };

    const text = formatProgram(program);
    expect(text).toContain('Warmup');
    expect(text).toContain('6x:');
    expect(text).toContain('Cooldown');
  });
});

describe('formatProgram with power intensity', () => {
  it('should render power range as watts', () => {
    const program: Program = {
      id: '1',
      name: 'Bike workout',
      sportType: SportType.Bike,
      overview: '',
      essence: 50,
      trainingLoad: 50,
      exerciseNum: 1,
      distance: 0,
      duration: 600,
      exercises: [
        makeExercise({
          intensityType: IntensityType.Power,
          intensityValue: 265,
          intensityValueExtend: 285,
        }),
      ],
    };
    const text = formatProgram(program);
    expect(text).toContain('@ 265-285W');
  });

  it('should render single power value without range', () => {
    const program: Program = {
      id: '1',
      name: 'Bike workout',
      sportType: SportType.Bike,
      overview: '',
      essence: 50,
      trainingLoad: 50,
      exerciseNum: 1,
      distance: 0,
      duration: 600,
      exercises: [
        makeExercise({
          intensityType: IntensityType.Power,
          intensityValue: 200,
          intensityValueExtend: 0,
        }),
      ],
    };
    expect(formatProgram(program)).toContain('@ 200W');
  });
});

describe('stripProgram', () => {
  it('should drop program-level noise fields', () => {
    const raw = {
      id: '1',
      name: 'Workout',
      sportType: SportType.Run,
      overview: '',
      essence: 50,
      trainingLoad: 50,
      exerciseNum: 0,
      distance: 0,
      duration: 0,
      exercises: [],
      exerciseBarChart: [{ huge: 'object' }],
      headPic: 'https://example/huge.jpg',
      profile: 'blob',
      sex: 1,
      pbVersion: 8,
      version: 42,
      status: 1,
      createTimestamp: 1234,
      thirdPartyId: 'x',
    } as unknown as Program;

    const stripped = stripProgram(raw) as Record<string, unknown>;

    expect(stripped).not.toHaveProperty('exerciseBarChart');
    expect(stripped).not.toHaveProperty('headPic');
    expect(stripped).not.toHaveProperty('profile');
    expect(stripped).not.toHaveProperty('sex');
    expect(stripped).not.toHaveProperty('pbVersion');
    expect(stripped).not.toHaveProperty('version');
    expect(stripped).not.toHaveProperty('status');
    expect(stripped).not.toHaveProperty('createTimestamp');
    expect(stripped).not.toHaveProperty('thirdPartyId');
    expect(stripped.name).toBe('Workout');
    expect(stripped.sportType).toBe(SportType.Run);
  });

  it('should drop exercise-level video/cover URLs and humanize overview', () => {
    const raw = {
      id: '1',
      name: 'Workout',
      sportType: SportType.Run,
      overview: '',
      essence: 0,
      trainingLoad: 0,
      exerciseNum: 1,
      distance: 0,
      duration: 0,
      exercises: [
        {
          ...makeExercise({ overview: 'sid_run_warm_up_dist' }),
          videoInfos: [{ url: 'x' }],
          videoUrl: 'https://example/video.mp4',
          thumbnailUrl: 'https://example/thumb.jpg',
          coverUrlArrStr: 'cover',
          sourceUrl: 'src',
          animationId: 'anim',
        },
      ],
    } as unknown as Program;

    const stripped = stripProgram(raw);
    const ex = stripped.exercises?.[0] as Record<string, unknown>;

    expect(ex).not.toHaveProperty('videoInfos');
    expect(ex).not.toHaveProperty('videoUrl');
    expect(ex).not.toHaveProperty('thumbnailUrl');
    expect(ex).not.toHaveProperty('coverUrlArrStr');
    expect(ex).not.toHaveProperty('sourceUrl');
    expect(ex).not.toHaveProperty('animationId');
    expect(ex.overview).toBe('Warm up dist');
    expect(ex.name).toBe('T3001');
  });

  it('should humanize strength overview prefix', () => {
    const raw = {
      id: '1',
      name: 'Workout',
      sportType: SportType.Run,
      overview: '',
      essence: 0,
      trainingLoad: 0,
      exerciseNum: 1,
      distance: 0,
      duration: 0,
      exercises: [makeExercise({ overview: 'sid_strength_squats' })],
    } as unknown as Program;

    const stripped = stripProgram(raw);
    const ex = stripped.exercises?.[0] as Record<string, unknown>;
    expect(ex.overview).toBe('Squats');
  });

  it('should leave non-sid overview untouched', () => {
    const raw = {
      id: '1',
      name: 'Workout',
      sportType: SportType.Run,
      overview: '',
      essence: 0,
      trainingLoad: 0,
      exerciseNum: 1,
      distance: 0,
      duration: 0,
      exercises: [makeExercise({ overview: 'Custom label' })],
    } as unknown as Program;
    const stripped = stripProgram(raw);
    const ex = stripped.exercises?.[0] as Record<string, unknown>;
    expect(ex.overview).toBe('Custom label');
  });
});
