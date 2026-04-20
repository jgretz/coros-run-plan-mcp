import type {
  Result,
  ApiResponse,
  Program,
  Exercise,
  ExerciseType,
} from './types.ts';
import { sportLabel } from './config.ts';

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

// COROS encodes exercise distance targets in centimeters.
function formatDistance(centimeters: number): string {
  const meters = centimeters / 100;
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
  if (ex.intensityType === 6) {
    return ex.intensityValueExtend
      ? ` @ ${ex.intensityValue}-${ex.intensityValueExtend}W`
      : ` @ ${ex.intensityValue}W`;
  }
  return '';
}

function formatExercise(ex: Exercise): string {
  const type = EXERCISE_TYPE_LABELS[ex.exerciseType] ?? 'Step';
  const target = formatTarget(ex);
  const intensity = formatIntensity(ex);
  return `${type}: ${target}${intensity}`;
}

const PROGRAM_DROP_KEYS = new Set([
  'exerciseBarChart',
  'headPic',
  'profile',
  'sex',
  'pbVersion',
  'version',
  'status',
  'createTimestamp',
  'thirdPartyId',
  'access',
  'deleted',
  'authorId',
  'nickname',
]);

const EXERCISE_DROP_KEYS = new Set([
  'videoInfos',
  'videoUrl',
  'videoUrlArrStr',
  'coverUrlArrStr',
  'thumbnailUrl',
  'sourceUrl',
  'animationId',
  'access',
  'deleted',
  'defaultOrder',
  'status',
  'createTimestamp',
  'userId',
  'muscle',
  'muscleRelevance',
  'part',
  'equipment',
  'isDefaultAdd',
  'intensityCustom',
  'intensityDisplayUnit',
  'isIntensityPercent',
]);

const OVERVIEW_PREFIXES = ['sid_run_', 'sid_bike_', 'sid_strength_', 'sid_'];

function humanizeOverview(overview: unknown): unknown {
  if (typeof overview !== 'string') return overview;
  for (const prefix of OVERVIEW_PREFIXES) {
    if (overview.startsWith(prefix)) {
      const stripped = overview.slice(prefix.length).replace(/_/g, ' ');
      return stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }
  return overview;
}

function dropKeys<T extends Record<string, unknown>>(obj: T, drop: Set<string>): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!drop.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}

export function stripProgram(p: Program): Partial<Program> {
  const base = dropKeys(p as unknown as Record<string, unknown>, PROGRAM_DROP_KEYS);
  const exercises = p.exercises?.map((ex) => {
    const stripped = dropKeys(ex as unknown as Record<string, unknown>, EXERCISE_DROP_KEYS);
    if ('overview' in stripped) stripped.overview = humanizeOverview(stripped.overview);
    return stripped;
  });
  return { ...(base as unknown as Partial<Program>), ...(exercises ? { exercises: exercises as unknown as Exercise[] } : {}) };
}

// COROS uses groupId "0" to mean "no group" for standalone exercises.
function isStandalone(ex: Exercise): boolean {
  return !ex.groupId || ex.groupId === '0';
}

export function formatProgram(p: Program): string {
  const sport = sportLabel(p.sportType);
  const load = p.essence || p.trainingLoad;
  const headerLines = [`${p.name} (${sport}, load: ${load})`];
  if (p.overview) headerLines.push(p.overview);
  const header = headerLines.join('\n');

  const exercises = p.exercises ?? [];
  if (exercises.length === 0) return header;

  // preserve API order; render standalone exercises and group parents in place.
  const lines: string[] = [];
  for (const ex of exercises) {
    if (ex.isGroup) {
      const children = exercises.filter((e) => e.groupId === ex.id);
      const sets = ex.sets ?? 1;
      const parts = children
        .map((c) => `${formatTarget(c)}${formatIntensity(c)}`)
        .join(' + ');
      lines.push(`- ${sets}x: ${parts}`);
    } else if (isStandalone(ex)) {
      lines.push(`- ${formatExercise(ex)}`);
    }
  }

  return `${header}\n${lines.join('\n')}`;
}
