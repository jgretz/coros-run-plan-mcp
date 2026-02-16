import { SportType, type Region } from './types.ts';

// API constants
export const UNIT_IMPERIAL = 1;
export const DISTANCE_DISPLAY_MILES = 3;
export const PB_VERSION_PROGRAM = 8;
export const PB_VERSION_SCHEDULE = 2;
export const SCHEDULE_STATUS_ADD = 1;
export const SCHEDULE_STATUS_DELETE = 3;
export const EXERCISE_STATUS_ACTIVE = 1;
export const REST_TYPE_DEFAULT = 3;
export const DEFAULT_EQUIPMENT = [1] as const;
export const DEFAULT_PART = [0] as const;
export const ACCOUNT_TYPE_EMAIL = 2;
export const QUERY_LIMIT = 100;

export const REGION_URLS: Record<Region, string> = {
  us: 'https://teamapi.coros.com',
  eu: 'https://teameuapi.coros.com',
  cn: 'https://teamcnapi.coros.com',
} as const;

export const SPORT_TYPE_LABELS: Record<SportType, string> = {
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

export const EXERCISE_TEMPLATES: Record<SportType, SportExerciseTemplates> = {
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

export function parseSportType(s: 'run' | 'bike'): SportType {
  return s === 'run' ? SportType.Run : SportType.Bike;
}
