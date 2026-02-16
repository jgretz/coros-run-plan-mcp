import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listPrograms, getProgram, createProgram, deletePrograms } from '../api/programs.ts';
import { SPORT_TYPE_LABELS, EXERCISE_TEMPLATES, SORT_NO_BASE, SORT_NO_CHILD } from '../config.ts';
import { ExerciseType, TargetType, IntensityType, type Exercise } from '../types.ts';

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

function mapTargetType(t: string): number {
  const map: Record<string, number> = { open: TargetType.Open, time: TargetType.Time, distance: TargetType.Distance };
  return map[t] ?? TargetType.Open;
}

function mapIntensityType(t?: string): number {
  if (!t || t === 'none') return IntensityType.None;
  const map: Record<string, number> = { heart_rate: IntensityType.HeartRate, pace: IntensityType.Pace };
  return map[t] ?? IntensityType.None;
}

function mapExerciseType(t: string): number {
  const map: Record<string, number> = {
    warmup: ExerciseType.Warmup,
    training: ExerciseType.Training,
    cooldown: ExerciseType.Cooldown,
    recovery: ExerciseType.Recovery,
  };
  return map[t] ?? ExerciseType.Training;
}

let nextTempId = Date.now();
function tempId(): string {
  return String(nextTempId++);
}

function buildExercise(
  sportType: number,
  step: z.infer<typeof ExerciseSchema>,
  sortNo: number,
): Exercise {
  const template = EXERCISE_TEMPLATES[sportType]?.[step.type];
  if (!template) throw new Error(`No template for sport ${sportType}, type ${step.type}`);

  return {
    exerciseType: mapExerciseType(step.type) as Exercise['exerciseType'],
    originId: String(template.originId),
    id: tempId(),
    name: template.name,
    overview: template.overview,
    sortNo,
    targetType: mapTargetType(step.targetType) as Exercise['targetType'],
    targetValue: step.targetValue,
    intensityType: mapIntensityType(step.intensityType) as Exercise['intensityType'],
    intensityValue: step.intensityValue ?? 0,
    intensityValueExtend: step.intensityValueExtend ?? 0,
    sets: 1,
    isGroup: false,
    groupId: '0',
    sportType: sportType,
    status: 1,
    restType: 3,
    restValue: 0,
    equipment: [1],
    part: [0],
    distanceDisplayUnit: 3,
  };
}

export function registerProgramTools(server: McpServer) {
  server.tool(
    'list_workouts',
    'List saved workouts from COROS Training Hub. Returns workout summaries.',
    {
      sportType: z.enum(['run', 'bike']).optional().describe('Filter by sport type'),
      nameFilter: z.string().optional().describe('Filter by name (case-insensitive substring match)'),
    },
    async ({ sportType, nameFilter }) => {
      const result = await listPrograms();
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to list workouts: ${result.error}` }], isError: true };
      }

      let programs = result.value;

      if (sportType) {
        const typeNum = sportType === 'run' ? 1 : 2;
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

  server.tool(
    'get_workout',
    'Get full details of a saved workout by ID, including all exercise steps.',
    {
      id: z.string().describe('The workout ID'),
    },
    async ({ id }) => {
      const result = await getProgram(id);
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Failed to get workout: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(result.value, null, 2) }] };
    },
  );

  server.tool(
    'create_workout',
    'Create a new run or bike workout with structured exercise steps. Supports warmup, steady blocks, interval groups, and cooldown.',
    {
      name: z.string().describe('Workout name'),
      sportType: z.enum(['run', 'bike']).describe('Sport type'),
      description: z.string().optional().describe('Workout description'),
      warmup: ExerciseSchema.optional().describe('Warmup step'),
      intervals: IntervalGroupSchema.optional().describe('Interval group (repeating training + recovery)'),
      steadyBlocks: z.array(ExerciseSchema).optional().describe('Steady-state training blocks (non-interval)'),
      cooldown: ExerciseSchema.optional().describe('Cooldown step'),
    },
    async ({ name, sportType, description, warmup, intervals, steadyBlocks, cooldown }) => {
      const sport = sportType === 'run' ? 1 : 2;
      const exercises: Exercise[] = [];
      let sortIdx = 0;

      // warmup
      if (warmup) {
        exercises.push(buildExercise(sport, { ...warmup, type: 'warmup' }, sortIdx * SORT_NO_BASE));
        sortIdx++;
      }

      // interval group — parent with id, children reference it via groupId
      if (intervals) {
        const groupSortNo = sortIdx * SORT_NO_BASE;
        const groupId = tempId();

        // group parent
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
          sets: intervals.sets,
          groupId: '0',
          sportType: sport,
          status: 1,
          restType: 3,
          restValue: 0,
          equipment: [1],
          part: [0],
          distanceDisplayUnit: 3,
        });

        // training child — groupId references the parent's id
        const trainingEx = buildExercise(sport, { ...intervals.training, type: 'training' }, groupSortNo + SORT_NO_CHILD);
        trainingEx.groupId = groupId;
        trainingEx.isGroup = false;
        exercises.push(trainingEx);

        // recovery child
        const recoveryEx = buildExercise(sport, { ...intervals.recovery, type: 'recovery' }, groupSortNo + 2 * SORT_NO_CHILD);
        recoveryEx.groupId = groupId;
        recoveryEx.isGroup = false;
        exercises.push(recoveryEx);

        sortIdx++;
      }

      // steady blocks
      if (steadyBlocks) {
        for (const block of steadyBlocks) {
          exercises.push(buildExercise(sport, { ...block, type: 'training' }, sortIdx * SORT_NO_BASE));
          sortIdx++;
        }
      }

      // cooldown
      if (cooldown) {
        exercises.push(buildExercise(sport, { ...cooldown, type: 'cooldown' }, sortIdx * SORT_NO_BASE));
        sortIdx++;
      }

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

  server.tool(
    'delete_workout',
    'Delete one or more saved workouts by ID.',
    {
      programIds: z.array(z.string()).min(1).describe('Array of workout program IDs to delete'),
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
