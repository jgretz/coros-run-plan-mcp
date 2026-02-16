import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listPrograms, getProgram, createProgram, deletePrograms } from '../api/programs.ts';
import {
  SPORT_TYPE_LABELS,
  EXERCISE_TEMPLATES,
  SORT_NO_BASE,
  SORT_NO_CHILD,
  EXERCISE_STATUS_ACTIVE,
  REST_TYPE_DEFAULT,
  DEFAULT_EQUIPMENT,
  DEFAULT_PART,
  DISTANCE_DISPLAY_MILES,
  mapSportLabel,
} from '../config.ts';
import { ok, err } from '../utils.ts';
import { ExerciseType, TargetType, IntensityType, type Exercise, type ExerciseStep, type IntervalGroup, type Result } from '../types.ts';

const ExerciseSchema = z.object({
  type: z.enum(['warmup', 'training', 'cooldown', 'recovery']).describe('Exercise step type'),
  targetType: z.enum(['open', 'time', 'distance']).describe('Target type: open (no target), time (seconds), distance (centimeters)'),
  targetValue: z.number().default(0).describe('Target value: seconds for time, centimeters for distance, 0 for open'),
  intensityType: z.enum(['none', 'heart_rate', 'pace']).optional().describe('Intensity type'),
  intensityValue: z.number().optional().describe('Low intensity value: BPM for heart_rate, centiseconds/km * 1000 for pace'),
  intensityValueExtend: z.number().optional().describe('High intensity value (same units as intensityValue)'),
});

const IntervalGroupSchema = z.object({
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

function tempId(): string {
  return crypto.randomUUID();
}

export function buildExercise(
  sportType: number,
  step: z.infer<typeof ExerciseSchema>,
  sortNo: number,
): Result<Exercise, string> {
  const template = EXERCISE_TEMPLATES[sportType]?.[step.type];
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
    trainingResult.value.groupId = groupId;
    trainingResult.value.isGroup = false;
    exercises.push(trainingResult.value);

    const recoveryResult = buildExercise(sportType, { ...opts.intervals.recovery, type: 'recovery' }, groupSortNo + 2 * SORT_NO_CHILD);
    if (!recoveryResult.ok) return recoveryResult;
    recoveryResult.value.groupId = groupId;
    recoveryResult.value.isGroup = false;
    exercises.push(recoveryResult.value);

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

export function registerProgramTools(server: McpServer) {
  server.registerTool(
    'list_workouts',
    {
      description: 'List saved workouts from COROS Training Hub. Returns workout summaries.',
      inputSchema: {
        sportType: z.enum(['run', 'bike']).optional().describe('Filter by sport type'),
        nameFilter: z.string().optional().describe('Filter by name (case-insensitive substring match)'),
      },
    },
    async ({ sportType, nameFilter }) => {
      const result = await listPrograms();
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to list workouts: ${result.error}` }], isError: true };
      }

      let programs = result.value;

      if (sportType) {
        const typeNum = mapSportLabel(sportType);
        programs = programs.filter((p) => p.sportType === typeNum);
      }

      if (nameFilter) {
        const lower = nameFilter.toLowerCase();
        programs = programs.filter((p) => p.name.toLowerCase().includes(lower));
      }

      const text = programs.length === 0
        ? 'No workouts found.'
        : programs
            .map((p) => `- ${p.name} (${SPORT_TYPE_LABELS[p.sportType] ?? 'Unknown'}, ID: ${p.id}, load: ${p.essence || p.trainingLoad})`)
            .join('\n');

      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'get_workout',
    {
      description: 'Get full details of a saved workout by ID, including all exercise steps.',
      inputSchema: {
        id: z.string().describe('The workout ID'),
      },
    },
    async ({ id }) => {
      const result = await getProgram(id);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to get workout: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(result.value, null, 2) }] };
    },
  );

  server.registerTool(
    'create_workout',
    {
      description: 'Create a new run or bike workout with structured exercise steps. Supports warmup, steady blocks, interval groups, and cooldown.',
      inputSchema: {
        name: z.string().describe('Workout name'),
        sportType: z.enum(['run', 'bike']).describe('Sport type'),
        description: z.string().optional().describe('Workout description'),
        warmup: ExerciseSchema.optional().describe('Warmup step'),
        intervals: IntervalGroupSchema.optional().describe('Interval group (repeating training + recovery)'),
        steadyBlocks: z.array(ExerciseSchema).optional().describe('Steady-state training blocks (non-interval)'),
        cooldown: ExerciseSchema.optional().describe('Cooldown step'),
      },
    },
    async ({ name, sportType, description, warmup, intervals, steadyBlocks, cooldown }) => {
      const sport = mapSportLabel(sportType);
      const exercisesResult = buildExercises(sport, { warmup, intervals, steadyBlocks, cooldown });
      if (!exercisesResult.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to build workout: ${exercisesResult.error}` }], isError: true };
      }

      const exercises = exercisesResult.value;

      if (exercises.length === 0) {
        return { content: [{ type: 'text' as const, text: 'Workout must have at least one exercise step.' }], isError: true };
      }

      const result = await createProgram({
        name,
        sportType: sport,
        overview: description ?? '',
        exercises,
      });

      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to create workout: ${result.error}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: `Workout "${name}" created (ID: ${result.value})` }],
      };
    },
  );

  server.registerTool(
    'delete_workout',
    {
      description: 'Delete one or more saved workouts by ID.',
      inputSchema: {
        programIds: z.array(z.string()).min(1).describe('Array of workout program IDs to delete'),
      },
    },
    async ({ programIds }) => {
      const result = await deletePrograms(programIds);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to delete: ${result.error}` }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: `Deleted ${programIds.length} workout(s).` }],
      };
    },
  );
}
