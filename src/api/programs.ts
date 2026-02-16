import { apiGet, apiPost, apiPostRaw } from './client.ts';
import type { Result, Program, ProgramSummary, CalculateResult } from '../types.ts';

export async function listPrograms(sportType?: number): Promise<Result<ProgramSummary[], string>> {
  return apiPost<ProgramSummary[]>('/training/program/query', {
    name: '',
    supportRestExercise: 1,
    startNo: 0,
    limitSize: 100,
    ...(sportType != null ? { sportType } : {}),
  });
}

export async function getProgram(id: string): Promise<Result<Program, string>> {
  return apiGet<Program>('/training/program/detail', { id });
}

export async function calculateProgram(exercises: unknown[]): Promise<Result<CalculateResult, string>> {
  return apiPost<CalculateResult>('/training/program/calculate', {
    exercises,
  });
}

export async function estimateProgram(day: string, exercises: unknown[]): Promise<Result<{ trainingLoad: number }, string>> {
  return apiPost<{ trainingLoad: number }>('/training/program/estimate', {
    day,
    exercises,
  });
}

// program/add returns data as a bare string ID
export async function createProgram(program: {
  name: string;
  sportType: number;
  overview?: string;
  exercises: unknown[];
}): Promise<Result<string, string>> {
  return apiPost<string>('/training/program/add', {
    ...program,
    unit: 1,
    pbVersion: 8,
  });
}

// program/delete expects array of unquoted numeric IDs
// IDs are snowflake-style (18+ digits) exceeding Number.MAX_SAFE_INTEGER,
// so we build raw JSON to avoid precision loss from Number conversion
export async function deletePrograms(programIds: string[]): Promise<Result<void, string>> {
  const rawBody = '[' + programIds.join(',') + ']';
  const result = await apiPostRaw<unknown>('/training/program/delete', rawBody);
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
