import { describe, it, expect } from 'bun:test';
import { ok, err, SportType, ExerciseType, TargetType, IntensityType } from './types.ts';

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
