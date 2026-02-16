import { describe, it, expect } from 'bun:test';
import { REGION_URLS, EXERCISE_TEMPLATES, SORT_NO_BASE, SORT_NO_CHILD, SPORT_TYPE_LABELS, parseSportType } from '../src/config.ts';

describe('REGION_URLS', () => {
  it('should have US region', () => {
    expect(REGION_URLS.us).toBe('https://teamapi.coros.com');
  });

  it('should have EU region', () => {
    expect(REGION_URLS.eu).toBe('https://teameuapi.coros.com');
  });

  it('should have CN region', () => {
    expect(REGION_URLS.cn).toBe('https://teamcnapi.coros.com');
  });
});

describe('EXERCISE_TEMPLATES', () => {
  it('should have run templates', () => {
    const run = EXERCISE_TEMPLATES[1]!;
    expect(run.warmup.name).toBe('T1120');
    expect(run.training.name).toBe('T3001');
    expect(run.cooldown.name).toBe('T1122');
    expect(run.recovery.name).toBe('T1123');
  });

  it('should have bike templates', () => {
    const bike = EXERCISE_TEMPLATES[2]!;
    expect(bike.training.name).toBe('T4000');
    expect(bike.warmup.name).toBe('T1120');
  });

  it('should share warmup/cooldown/recovery originIds between sports', () => {
    expect(EXERCISE_TEMPLATES[1]!.warmup.originId).toBe(EXERCISE_TEMPLATES[2]!.warmup.originId);
    expect(EXERCISE_TEMPLATES[1]!.cooldown.originId).toBe(EXERCISE_TEMPLATES[2]!.cooldown.originId);
    expect(EXERCISE_TEMPLATES[1]!.recovery.originId).toBe(EXERCISE_TEMPLATES[2]!.recovery.originId);
  });

  it('should use string originIds', () => {
    expect(typeof EXERCISE_TEMPLATES[1]!.training.originId).toBe('string');
    expect(EXERCISE_TEMPLATES[1]!.training.originId.length).toBeGreaterThan(5);
  });
});

describe('sort constants', () => {
  it('should have correct base increment', () => {
    expect(SORT_NO_BASE).toBe(16777216);
  });

  it('should have correct child increment', () => {
    expect(SORT_NO_CHILD).toBe(65536);
  });
});

describe('SPORT_TYPE_LABELS', () => {
  it('should label sport types', () => {
    expect(SPORT_TYPE_LABELS[1]).toBe('Run');
    expect(SPORT_TYPE_LABELS[2]).toBe('Bike');
  });
});

describe('parseSportType', () => {
  it('should map run to SportType.Run', () => {
    expect(parseSportType('run')).toBe(1);
  });

  it('should map bike to SportType.Bike', () => {
    expect(parseSportType('bike')).toBe(2);
  });
});
