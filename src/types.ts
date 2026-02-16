// Result type — prefer over throwing
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Auth
export type Region = 'us' | 'eu' | 'cn';

export type AuthToken = {
  accessToken: string;
  userId: string;
};

export type AuthConfig = {
  email: string;
  password: string;
  region: Region;
};

// API response envelope
export type ApiResponse<T> = {
  apiCode: string;
  message: string;
  result: string;
  data: T;
};

// Sport types (in program context)
export const SportType = {
  Run: 1,
  Bike: 2,
} as const;

export type SportType = (typeof SportType)[keyof typeof SportType];

// Exercise types within a workout
export const ExerciseType = {
  Group: 0,
  Warmup: 1,
  Training: 2,
  Cooldown: 3,
  Recovery: 4,
} as const;

export type ExerciseType = (typeof ExerciseType)[keyof typeof ExerciseType];

// Target types
export const TargetType = {
  Open: 1,
  Time: 2,
  Distance: 5,
} as const;

export type TargetType = (typeof TargetType)[keyof typeof TargetType];

// Intensity types
export const IntensityType = {
  None: 0,
  HeartRate: 2,
  Pace: 3,
} as const;

export type IntensityType = (typeof IntensityType)[keyof typeof IntensityType];

// Exercise (step within a workout)
export type Exercise = {
  exerciseType: ExerciseType;
  originId: string;
  name: string;
  overview: string;
  sortNo: number;
  targetType: TargetType;
  targetValue: number;
  intensityType: IntensityType;
  intensityValue: number;
  intensityValueExtend: number;
  id?: string;
  isGroup?: boolean;
  sets?: number;
  groupId?: string;
  sportType?: number;
  status?: number;
  restType?: number;
  restValue?: number;
  equipment?: number[];
  part?: number[];
  distanceDisplayUnit?: number;
};

// Program (saved workout) — field names match COROS API
export type Program = {
  id: string;
  name: string;
  sportType: SportType;
  overview: string;
  essence: number; // training load
  trainingLoad: number;
  exercises: Exercise[];
  exerciseBarChart?: unknown[];
  exerciseNum: number;
  distance: number;
  duration: number;
  createTimestamp?: number;
  idInPlan?: number;
};

// Program list item (from query endpoint)
export type ProgramSummary = {
  id: string;
  name: string;
  sportType: SportType;
  overview: string;
  essence: number; // training load
  trainingLoad: number;
  createTimestamp: number;
};

// Schedule entity (a workout scheduled on a specific day)
export type ScheduleEntity = {
  id: string;
  happenDay: number; // YYYYMMDD as number
  idInPlan: string;
  planProgramId: string;
  sortNo: number;
  executeStatus: number;
  labelId?: string;
  sportData?: {
    name: string;
    sportType: number;
    distance: number;
    duration: number;
    trainingLoad: number;
    happenDay: number;
  };
};

// Schedule query response — training plan with entities and programs
export type ScheduleQueryResponse = {
  id: string;
  name: string;
  startDay: number;
  endDay: number;
  maxPlanProgramId: string;
  entities: ScheduleEntity[];
  programs: Program[];
};

// Login response data
export type LoginData = {
  accessToken: string;
  userId: string;
};

// Exercise step input (user-facing)
export type ExerciseStep = {
  type: 'warmup' | 'training' | 'cooldown' | 'recovery';
  targetType: 'open' | 'time' | 'distance';
  targetValue: number;
  intensityType?: 'none' | 'heart_rate' | 'pace';
  intensityValue?: number;
  intensityValueExtend?: number;
};

// Interval group input (user-facing)
export type IntervalGroup = {
  sets: number;
  training: ExerciseStep;
  recovery: ExerciseStep;
};
