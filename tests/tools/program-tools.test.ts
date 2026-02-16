import { describe, it, expect } from 'bun:test';
import {
  mapTargetType,
  mapIntensityType,
  mapExerciseType,
  buildExercise,
  buildExercises,
} from '../../src/tools/program-tools.ts';
import { ExerciseType, TargetType, IntensityType, type ExerciseStep, type Result } from '../../src/types.ts';
import {
  SORT_NO_BASE,
  SORT_NO_CHILD,
  EXERCISE_STATUS_ACTIVE,
  REST_TYPE_DEFAULT,
  DISTANCE_DISPLAY_MILES,
} from '../../src/config.ts';

function makeStep(overrides?: Partial<ExerciseStep>): ExerciseStep {
  return {
    type: 'training',
    targetType: 'open',
    targetValue: 0,
    ...overrides,
  };
}

function unwrap<T>(result: Result<T, string>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('mapTargetType', () => {
  it('should map open to TargetType.Open', () => {
    expect(mapTargetType('open')).toBe(TargetType.Open);
  });

  it('should map time to TargetType.Time', () => {
    expect(mapTargetType('time')).toBe(TargetType.Time);
  });

  it('should map distance to TargetType.Distance', () => {
    expect(mapTargetType('distance')).toBe(TargetType.Distance);
  });

  it('should default to Open for unknown values', () => {
    expect(mapTargetType('unknown')).toBe(TargetType.Open);
  });
});

describe('mapIntensityType', () => {
  it('should return None for undefined', () => {
    expect(mapIntensityType(undefined)).toBe(IntensityType.None);
  });

  it('should return None for "none"', () => {
    expect(mapIntensityType('none')).toBe(IntensityType.None);
  });

  it('should map heart_rate to HeartRate', () => {
    expect(mapIntensityType('heart_rate')).toBe(IntensityType.HeartRate);
  });

  it('should map pace to Pace', () => {
    expect(mapIntensityType('pace')).toBe(IntensityType.Pace);
  });

  it('should default to None for unknown values', () => {
    expect(mapIntensityType('unknown')).toBe(IntensityType.None);
  });
});

describe('mapExerciseType', () => {
  it('should map warmup to Warmup', () => {
    expect(mapExerciseType('warmup')).toBe(ExerciseType.Warmup);
  });

  it('should map training to Training', () => {
    expect(mapExerciseType('training')).toBe(ExerciseType.Training);
  });

  it('should map cooldown to Cooldown', () => {
    expect(mapExerciseType('cooldown')).toBe(ExerciseType.Cooldown);
  });

  it('should map recovery to Recovery', () => {
    expect(mapExerciseType('recovery')).toBe(ExerciseType.Recovery);
  });

  it('should default to Training for unknown values', () => {
    expect(mapExerciseType('unknown')).toBe(ExerciseType.Training);
  });
});

describe('buildExercise', () => {
  it('should produce exercise with correct template fields', () => {
    const ex = unwrap(buildExercise(1, makeStep({ type: 'warmup' }), 0));
    expect(ex.name).toBe('T1120');
    expect(ex.overview).toBe('sid_run_warm_up_dist');
    expect(ex.originId).toBe('425895398452936705');
  });

  it('should set id, sortNo, and sportType', () => {
    const ex = unwrap(buildExercise(1, makeStep(), SORT_NO_BASE));
    expect(ex.id).toBeDefined();
    expect(ex.sortNo).toBe(SORT_NO_BASE);
    expect(ex.sportType).toBe(1);
  });

  it('should map targetType correctly', () => {
    const ex = unwrap(buildExercise(1, makeStep({ targetType: 'distance', targetValue: 500000 }), 0));
    expect(ex.targetType).toBe(TargetType.Distance);
    expect(ex.targetValue).toBe(500000);
  });

  it('should map intensityType correctly', () => {
    const ex = unwrap(buildExercise(1, makeStep({ intensityType: 'pace', intensityValue: 300000 }), 0));
    expect(ex.intensityType).toBe(IntensityType.Pace);
    expect(ex.intensityValue).toBe(300000);
  });

  it('should default intensityValue and intensityValueExtend to 0', () => {
    const ex = unwrap(buildExercise(1, makeStep(), 0));
    expect(ex.intensityValue).toBe(0);
    expect(ex.intensityValueExtend).toBe(0);
  });

  it('should set status, restType, and distanceDisplayUnit from constants', () => {
    const ex = unwrap(buildExercise(1, makeStep(), 0));
    expect(ex.status).toBe(EXERCISE_STATUS_ACTIVE);
    expect(ex.restType).toBe(REST_TYPE_DEFAULT);
    expect(ex.distanceDisplayUnit).toBe(DISTANCE_DISPLAY_MILES);
  });

  it('should return error for invalid sport/type combo', () => {
    const result = buildExercise(99, makeStep(), 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('No template for sport 99');
  });

  it('should use bike templates for sportType 2', () => {
    const ex = unwrap(buildExercise(2, makeStep({ type: 'training' }), 0));
    expect(ex.name).toBe('T4000');
    expect(ex.overview).toBe('sid_bike_training');
  });
});

describe('buildExercises', () => {
  describe('warmup + intervals', () => {
    it('should produce 4 exercises with correct structure', () => {
      const exercises = unwrap(buildExercises(1, {
        warmup: makeStep({ type: 'warmup', targetType: 'time', targetValue: 600 }),
        intervals: {
          sets: 4,
          training: makeStep({ type: 'training', targetType: 'distance', targetValue: 100000 }),
          recovery: makeStep({ type: 'recovery', targetType: 'time', targetValue: 120 }),
        },
      }));

      expect(exercises).toHaveLength(4);

      // warmup
      expect(exercises[0]!.exerciseType).toBe(ExerciseType.Warmup);
      expect(exercises[0]!.sortNo).toBe(0);

      // group parent
      const group = exercises[1]!;
      expect(group.isGroup).toBe(true);
      expect(group.sets).toBe(4);
      expect(group.exerciseType).toBe(ExerciseType.Group);
      expect(group.sortNo).toBe(SORT_NO_BASE);

      // training child references group
      const training = exercises[2]!;
      expect(training.groupId).toBe(group.id);
      expect(training.exerciseType).toBe(ExerciseType.Training);
      expect(training.sortNo).toBe(SORT_NO_BASE + SORT_NO_CHILD);

      // recovery child references group
      const recovery = exercises[3]!;
      expect(recovery.groupId).toBe(group.id);
      expect(recovery.exerciseType).toBe(ExerciseType.Recovery);
      expect(recovery.sortNo).toBe(SORT_NO_BASE + 2 * SORT_NO_CHILD);
    });
  });

  describe('intervals only', () => {
    it('should produce 3 exercises with correct linking', () => {
      const exercises = unwrap(buildExercises(1, {
        intervals: {
          sets: 3,
          training: makeStep({ type: 'training' }),
          recovery: makeStep({ type: 'recovery' }),
        },
      }));

      expect(exercises).toHaveLength(3);

      const group = exercises[0]!;
      expect(group.isGroup).toBe(true);
      expect(group.sortNo).toBe(0);

      expect(exercises[1]!.groupId).toBe(group.id);
      expect(exercises[2]!.groupId).toBe(group.id);
    });
  });

  describe('steady blocks', () => {
    it('should produce sequential exercises with correct sortNo spacing', () => {
      const exercises = unwrap(buildExercises(1, {
        steadyBlocks: [
          makeStep({ type: 'training', targetType: 'time', targetValue: 600 }),
          makeStep({ type: 'training', targetType: 'time', targetValue: 300 }),
        ],
      }));

      expect(exercises).toHaveLength(2);
      expect(exercises[0]!.sortNo).toBe(0);
      expect(exercises[1]!.sortNo).toBe(SORT_NO_BASE);
      expect(exercises[0]!.exerciseType).toBe(ExerciseType.Training);
      expect(exercises[1]!.exerciseType).toBe(ExerciseType.Training);
    });
  });

  describe('empty input', () => {
    it('should return ok with empty array when no steps provided', () => {
      const exercises = unwrap(buildExercises(1, {}));
      expect(exercises).toHaveLength(0);
    });
  });

  describe('full workout', () => {
    it('should order warmup, intervals, steady, cooldown correctly', () => {
      const exercises = unwrap(buildExercises(1, {
        warmup: makeStep({ type: 'warmup' }),
        intervals: {
          sets: 2,
          training: makeStep({ type: 'training' }),
          recovery: makeStep({ type: 'recovery' }),
        },
        steadyBlocks: [makeStep({ type: 'training' })],
        cooldown: makeStep({ type: 'cooldown' }),
      }));

      // warmup(0) + group(1) + training(1) + recovery(1) + steady(1) + cooldown(1) = 6
      expect(exercises).toHaveLength(6);
      expect(exercises[0]!.exerciseType).toBe(ExerciseType.Warmup);
      expect(exercises[1]!.exerciseType).toBe(ExerciseType.Group);
      expect(exercises[4]!.exerciseType).toBe(ExerciseType.Training);
      expect(exercises[5]!.exerciseType).toBe(ExerciseType.Cooldown);

      // sortNo ordering
      expect(exercises[0]!.sortNo).toBe(0);
      expect(exercises[4]!.sortNo).toBe(2 * SORT_NO_BASE);
      expect(exercises[5]!.sortNo).toBe(3 * SORT_NO_BASE);
    });
  });
});
