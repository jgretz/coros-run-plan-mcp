import type { Region, ExerciseType } from './types.ts';

export const REGION_URLS: Record<Region, string> = {
  us: 'https://teamapi.coros.com',
  eu: 'https://teameuapi.coros.com',
  cn: 'https://teamcnapi.coros.com',
} as const;

export const SPORT_TYPE_LABELS: Record<number, string> = {
  1: 'Run',
  2: 'Bike',
} as const;

// sortNo spacing: top-level exercises use 16777216 increments, children use 65536
export const SORT_NO_BASE = 16777216;
export const SORT_NO_CHILD = 65536;

// Exercise templates: originId + name + overview per exercise type and sport
type ExerciseTemplate = {
  originId: string;
  name: string;
  overview: string;
};

type SportExerciseTemplates = {
  warmup: ExerciseTemplate;
  training: ExerciseTemplate;
  cooldown: ExerciseTemplate;
  recovery: ExerciseTemplate;
};

export const EXERCISE_TEMPLATES: Record<number, SportExerciseTemplates> = {
  // Run — originIds from actual API responses
  1: {
    warmup: { originId: '425895398452936705', name: 'T1120', overview: 'sid_run_warm_up_dist' },
    training: { originId: '426109589008859136', name: 'T3001', overview: 'sid_run_training' },
    cooldown: { originId: '425895456971866112', name: 'T1122', overview: 'sid_run_cool_down_dist' },
    recovery: { originId: '425895398452936705', name: 'T1123', overview: 'sid_run_cool_down_dist' },
  },
  // Bike
  2: {
    warmup: { originId: '425895398452936705', name: 'T1120', overview: 'sid_run_warm_up_dist' },
    training: { originId: '426109589008859136', name: 'T4000', overview: 'sid_bike_training' },
    cooldown: { originId: '425895456971866112', name: 'T1122', overview: 'sid_run_cool_down_dist' },
    recovery: { originId: '425895398452936705', name: 'T1123', overview: 'sid_run_cool_down_dist' },
  },
} as const;

// Map exercise type enum to template key
export const EXERCISE_TYPE_TEMPLATE_KEY: Record<number, keyof SportExerciseTemplates> = {
  1: 'warmup',
  2: 'training',
  3: 'cooldown',
  4: 'recovery',
} as const;
