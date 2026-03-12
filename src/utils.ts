import type {
  Result,
  ApiResponse,
  Program,
  Exercise,
  ExerciseType,
} from './types.ts';
import { SPORT_TYPE_LABELS } from './config.ts';

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function formatError(msg: string, e: unknown): string {
  return `${msg}: ${e instanceof Error ? e.message : String(e)}`;
}

export function isApiSuccess(response: ApiResponse<unknown>): boolean {
  return response.result === '0000' || response.apiCode === '0000';
}

const MAX_OUTPUT_CHARS = 3000;

export function capOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return (
    text.slice(0, MAX_OUTPUT_CHARS) +
    `\n... truncated (${text.length - MAX_OUTPUT_CHARS} chars). Use detail:'full' or narrow your query.`
  );
}

const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  0: 'Group',
  1: 'Warmup',
  2: 'Training',
  3: 'Cooldown',
  4: 'Recovery',
};

const TARGET_TYPE_LABELS: Record<number, string> = {
  1: 'open',
  2: 'time',
  5: 'distance',
};

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)}km`
    : `${Math.round(meters)}m`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m}min`;
}

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function formatTarget(ex: Exercise): string {
  const label = TARGET_TYPE_LABELS[ex.targetType] ?? 'unknown';
  if (label === 'open') return 'open';
  if (label === 'distance') return formatDistance(ex.targetValue);
  return formatDuration(ex.targetValue);
}

function formatIntensity(ex: Exercise): string {
  if (ex.intensityType === 0) return '';
  if (ex.intensityType === 2) {
    return ex.intensityValueExtend
      ? ` @ ${ex.intensityValue}-${ex.intensityValueExtend}bpm`
      : ` @ ${ex.intensityValue}bpm`;
  }
  if (ex.intensityType === 3) {
    return ex.intensityValueExtend
      ? ` @ ${formatPace(ex.intensityValue)}-${formatPace(ex.intensityValueExtend)}`
      : ` @ ${formatPace(ex.intensityValue)}`;
  }
  return '';
}

function formatExercise(ex: Exercise): string {
  const type = EXERCISE_TYPE_LABELS[ex.exerciseType] ?? 'Step';
  const target = formatTarget(ex);
  const intensity = formatIntensity(ex);
  return `${type}: ${target}${intensity}`;
}

export function formatProgram(p: Program): string {
  const sport = SPORT_TYPE_LABELS[p.sportType] ?? 'Unknown';
  const load = p.essence || p.trainingLoad;
  const header = `${p.name} (${sport}, load: ${load})`;

  const exercises = p.exercises ?? [];
  if (exercises.length === 0) return header;

  // group exercises by groupId
  const grouped = new Map<string, Exercise[]>();
  const topLevel: (Exercise | { group: Exercise; children: Exercise[] })[] = [];

  for (const ex of exercises) {
    if (ex.isGroup) {
      const children = exercises.filter((e) => e.groupId === ex.id);
      grouped.set(ex.id ?? '', children);
      topLevel.push({ group: ex, children });
    } else if (!ex.groupId) {
      topLevel.push(ex);
    }
  }

  const lines = topLevel.map((item) => {
    if ('group' in item) {
      const sets = item.group.sets ?? 1;
      const parts = item.children
        .map((c) => `${formatTarget(c)}${formatIntensity(c)}`)
        .join(' + ');
      return `- ${sets}x: ${parts}`;
    }
    return `- ${formatExercise(item)}`;
  });

  return `${header}\n${lines.join('\n')}`;
}
