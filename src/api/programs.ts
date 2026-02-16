import { apiGet, apiPost, apiPostRaw } from './client.ts';
import { QUERY_LIMIT, UNIT_IMPERIAL, PB_VERSION_PROGRAM } from '../config.ts';
import { ok, err } from '../utils.ts';
import type { Result, Program, ProgramSummary, Exercise } from '../types.ts';

export async function listPrograms(sportType?: number): Promise<Result<ProgramSummary[], string>> {
  return apiPost<ProgramSummary[]>('/training/program/query', {
    name: '',
    supportRestExercise: 1,
    startNo: 0,
    limitSize: QUERY_LIMIT,
    ...(sportType != null ? { sportType } : {}),
  });
}

export async function getProgram(id: string): Promise<Result<Program, string>> {
  return apiGet<Program>('/training/program/detail', { id });
}

// program/add returns data as a bare string ID
export async function createProgram(program: {
  name: string;
  sportType: number;
  overview?: string;
  exercises: Exercise[];
}): Promise<Result<string, string>> {
  return apiPost<string>('/training/program/add', {
    ...program,
    unit: UNIT_IMPERIAL,
    pbVersion: PB_VERSION_PROGRAM,
  });
}

// program/delete expects array of unquoted numeric IDs
// IDs are snowflake-style (18+ digits) exceeding Number.MAX_SAFE_INTEGER,
// so we build raw JSON to avoid precision loss from Number conversion
export async function deletePrograms(programIds: string[]): Promise<Result<void, string>> {
  const invalid = programIds.filter((id) => !/^\d+$/.test(id));
  if (invalid.length > 0) {
    return err(`Invalid program IDs (must be numeric): ${invalid.join(', ')}`);
  }

  const rawBody = '[' + programIds.join(',') + ']';
  const result = await apiPostRaw<unknown>('/training/program/delete', rawBody);
  if (!result.ok) return result;
  return ok(undefined);
}
