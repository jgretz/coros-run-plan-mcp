import { apiGet, apiPost } from './client.ts';
import { PB_VERSION_SCHEDULE, SCHEDULE_STATUS_ADD, SCHEDULE_STATUS_DELETE } from '../config.ts';
import { ok, err } from '../utils.ts';
import type { Result, ScheduleQueryResponse, Program } from '../types.ts';
import { getProgram } from './programs.ts';

export async function querySchedule(startDay: string, endDay: string): Promise<Result<ScheduleQueryResponse, string>> {
  return apiGet<ScheduleQueryResponse>('/training/schedule/query', {
    startDate: startDay,
    endDate: endDay,
    supportRestExercise: '1',
  });
}

export async function scheduleWorkout(
  programId: string,
  day: string,
  sportType: number,
): Promise<Result<void, string>> {
  // 1. get the current plan to find maxPlanProgramId
  const planResult = await querySchedule(day, day);
  if (!planResult.ok) return planResult;

  const plan = planResult.value;
  const nextIdInPlan = Number(plan.maxPlanProgramId ?? '0') + 1;

  // 2. get the full program details
  const programResult = await getProgram(programId);
  if (!programResult.ok) return programResult;

  const program = programResult.value;

  // 3. build the schedule/update payload
  const payload = {
    entities: [{
      happenDay: day,
      idInPlan: nextIdInPlan,
      sortNo: 0,
      dayNo: 0,
      sortNoInPlan: 0,
      sortNoInSchedule: 0,
      exerciseBarChart: program.exerciseBarChart ?? [],
    }],
    programs: [{
      ...program,
      idInPlan: nextIdInPlan,
    }],
    versionObjects: [{
      id: nextIdInPlan,
      status: SCHEDULE_STATUS_ADD,
    }],
    pbVersion: PB_VERSION_SCHEDULE,
  };

  const result = await apiPost<unknown>('/training/schedule/update', payload);
  if (!result.ok) return result;
  return ok(undefined);
}

export async function unscheduleWorkout(
  entityId: string,
  startDay: string,
  endDay: string,
): Promise<Result<void, string>> {
  // 1. get the plan to find the entity details
  const planResult = await querySchedule(startDay, endDay);
  if (!planResult.ok) return planResult;

  const plan = planResult.value;
  const entity = plan.entities?.find((e) => e.id === entityId);
  if (!entity) {
    return err(`Entity ${entityId} not found in calendar`);
  }

  const payload = {
    versionObjects: [{
      id: String(entity.idInPlan),
      planProgramId: String(entity.planProgramId),
      planId: plan.id,
      status: SCHEDULE_STATUS_DELETE,
    }],
    pbVersion: PB_VERSION_SCHEDULE,
  };

  const result = await apiPost<unknown>('/training/schedule/update', payload);
  if (!result.ok) return result;
  return ok(undefined);
}
