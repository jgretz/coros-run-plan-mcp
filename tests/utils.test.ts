import { describe, it, expect } from 'bun:test';
import { ok, err, formatError, isApiSuccess } from '../src/utils.ts';
import { SportType, ExerciseType, TargetType, IntensityType } from '../src/types.ts';

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
  });
});
