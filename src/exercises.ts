import { z } from 'zod';
import {
  EXERCISE_TEMPLATES,
  SORT_NO_BASE,
  SORT_NO_CHILD,
  EXERCISE_STATUS_ACTIVE,
  REST_TYPE_DEFAULT,
  DEFAULT_EQUIPMENT,
  DEFAULT_PART,
  DISTANCE_DISPLAY_MILES,
} from './config.ts';
import { ok, err } from './utils.ts';
import { ExerciseType, TargetType, IntensityType, type Exercise, type ExerciseStep, type IntervalGroup, type Result } from './types.ts';

export const ExerciseSchema = z.object({
  type: z.enum(['warmup', 'training', 'cooldown', 'recovery']).describe('Exercise step type'),
  targetType: z.enum(['open', 'time', 'distance']).describe('Target type: open (no target), time (seconds), distance (centimeters)'),
  targetValue: z.number().default(0).describe('Target value: seconds for time, centimeters for distance, 0 for open'),
  intensityType: z.enum(['none', 'heart_rate', 'pace']).optional().describe('Intensity type'),
  intensityValue: z.number().optional().describe('Low intensity value: BPM for heart_rate, centiseconds/km * 1000 for pace'),
  intensityValueExtend: z.number().optional().describe('High intensity value (same units as intensityValue)'),
});

export const IntervalGroupSchema = z.object({
  sets: z.number().min(1).describe('Number of interval repetitions'),
  training: ExerciseSchema.describe('The work interval'),
  recovery: ExerciseSchema.describe('The recovery interval'),
});

export function mapTargetType(t: string): TargetType {
  const map: Record<string, TargetType> = { open: TargetType.Open, time: TargetType.Time, distance: TargetType.Distance };
  return map[t] ?? TargetType.Open;
}

export function mapIntensityType(t?: string): IntensityType {
  if (!t || t === 'none') return IntensityType.None;
  const map: Record<string, IntensityType> = { heart_rate: IntensityType.HeartRate, pace: IntensityType.Pace };
  return map[t] ?? IntensityType.None;
}

export function mapExerciseType(t: string): ExerciseType {
  const map: Record<string, ExerciseType> = {
    warmup: ExerciseType.Warmup,
    training: ExerciseType.Training,
    cooldown: ExerciseType.Cooldown,
    recovery: ExerciseType.Recovery,
  };
  return map[t] ?? ExerciseType.Training;
}

// COROS API requires exercise IDs to be numeric strings
let nextTempId = Date.now();
function tempId(): string {
  return String(nextTempId++);
}

export function buildExercise(
  sportType: number,
  step: z.infer<typeof ExerciseSchema>,
  sortNo: number,
): Result<Exercise, string> {
  const template = EXERCISE_TEMPLATES[sportType as keyof typeof EXERCISE_TEMPLATES]?.[step.type];
  if (!template) return err(`No template for sport ${sportType}, type ${step.type}`);

  return ok({
    exerciseType: mapExerciseType(step.type),
    originId: String(template.originId),
    id: tempId(),
    name: template.name,
    overview: template.overview,
    sortNo,
    targetType: mapTargetType(step.targetType),
    targetValue: step.targetValue,
    intensityType: mapIntensityType(step.intensityType),
    intensityValue: step.intensityValue ?? 0,
    intensityValueExtend: step.intensityValueExtend ?? 0,
    sets: 1,
    isGroup: false,
    groupId: '0',
    sportType,
    status: EXERCISE_STATUS_ACTIVE,
    restType: REST_TYPE_DEFAULT,
    restValue: 0,
    equipment: [...DEFAULT_EQUIPMENT],
    part: [...DEFAULT_PART],
    distanceDisplayUnit: DISTANCE_DISPLAY_MILES,
  });
}

export function buildExercises(
  sportType: number,
  opts: {
    warmup?: ExerciseStep;
    intervals?: IntervalGroup;
    steadyBlocks?: ExerciseStep[];
    cooldown?: ExerciseStep;
  },
): Result<Exercise[], string> {
  const exercises: Exercise[] = [];
  let sortIdx = 0;

  if (opts.warmup) {
    const result = buildExercise(sportType, { ...opts.warmup, type: 'warmup' }, sortIdx * SORT_NO_BASE);
    if (!result.ok) return result;
    exercises.push(result.value);
    sortIdx++;
  }

  if (opts.intervals) {
    const groupSortNo = sortIdx * SORT_NO_BASE;
    const groupId = tempId();

    exercises.push({
      exerciseType: ExerciseType.Group,
      originId: '0',
      id: groupId,
      name: '',
      overview: '',
      sortNo: groupSortNo,
      targetType: TargetType.Open,
      targetValue: 0,
      intensityType: IntensityType.None,
      intensityValue: 0,
      intensityValueExtend: 0,
      isGroup: true,
      sets: opts.intervals.sets,
      groupId: '0',
      sportType,
      status: EXERCISE_STATUS_ACTIVE,
      restType: REST_TYPE_DEFAULT,
      restValue: 0,
      equipment: [...DEFAULT_EQUIPMENT],
      part: [...DEFAULT_PART],
      distanceDisplayUnit: DISTANCE_DISPLAY_MILES,
    });

    const trainingResult = buildExercise(sportType, { ...opts.intervals.training, type: 'training' }, groupSortNo + SORT_NO_CHILD);
    if (!trainingResult.ok) return trainingResult;
    exercises.push({ ...trainingResult.value, groupId, isGroup: false });

    const recoveryResult = buildExercise(sportType, { ...opts.intervals.recovery, type: 'recovery' }, groupSortNo + 2 * SORT_NO_CHILD);
    if (!recoveryResult.ok) return recoveryResult;
    exercises.push({ ...recoveryResult.value, groupId, isGroup: false });

    sortIdx++;
  }

  if (opts.steadyBlocks) {
    for (const block of opts.steadyBlocks) {
      const result = buildExercise(sportType, { ...block, type: 'training' }, sortIdx * SORT_NO_BASE);
      if (!result.ok) return result;
      exercises.push(result.value);
      sortIdx++;
    }
  }

  if (opts.cooldown) {
    const result = buildExercise(sportType, { ...opts.cooldown, type: 'cooldown' }, sortIdx * SORT_NO_BASE);
    if (!result.ok) return result;
    exercises.push(result.value);
    sortIdx++;
  }

  return ok(exercises);
}
