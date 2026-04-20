import { apiGet, apiPostForm } from './client.ts';
import { getToken } from '../auth/auth.ts';
import { ok, err } from '../utils.ts';
import type {
  Result,
  ActivitySummary,
  ActivityListResponse,
  AnalyseResponse,
  DailyDetailResponse,
  DailyMetric,
  DashboardResponse,
  RawActivity,
  RawDailyDetail,
} from '../types.ts';
import { sportLabel } from '../config.ts';

// COROS reports calories in kilocalories * 1000 (e.g. 425000 = 425kcal).
const CALORIE_SCALE = 1000;

export function parseActivity(raw: RawActivity): ActivitySummary {
  const rawCalorie = raw.calorie ?? raw.totalCalorie;
  return {
    activityId: String(raw.labelId ?? ''),
    name: raw.name ?? raw.remark,
    sportType: raw.sportType,
    sportName: raw.sportType != null ? sportLabel(raw.sportType) : undefined,
    startTime: raw.startTime != null ? String(raw.startTime) : undefined,
    endTime: raw.endTime != null ? String(raw.endTime) : undefined,
    durationSeconds: raw.totalTime,
    distanceMeters: raw.distance ?? raw.totalDistance,
    avgHr: raw.avgHr,
    maxHr: raw.maxHr,
    calories: rawCalorie != null ? Math.round(rawCalorie / CALORIE_SCALE) || undefined : undefined,
    trainingLoad: raw.trainingLoad,
    avgPower: raw.avgPower,
    normalizedPower: raw.np,
    elevationGain: raw.ascent ?? raw.totalAscent ?? raw.elevationGain,
  };
}

export function parseDailyDetail(raw: RawDailyDetail): DailyMetric {
  return {
    date: String(raw.happenDay ?? ''),
    avgSleepHrv: raw.avgSleepHrv,
    baseline: raw.sleepHrvBase,
    rhr: raw.rhr,
    trainingLoad: raw.trainingLoad,
    trainingLoadRatio: raw.trainingLoadRatio,
    tiredRate: raw.tiredRateNew,
    ati: raw.ati,
    cti: raw.cti,
    distanceMeters: raw.distance,
    durationSeconds: raw.duration,
    vo2max: raw.vo2max,
    lthr: raw.lthr,
    ltsp: raw.ltsp,
    staminaLevel: raw.staminaLevel,
    staminaLevel7d: raw.staminaLevel7d,
  };
}

// Merge VO2max/LTHR/stamina from the 28-day analyse window onto the longer dayDetail set.
export function mergeAnalyse(metrics: DailyMetric[], t7dayList: RawDailyDetail[] | undefined): DailyMetric[] {
  if (!t7dayList) return metrics;
  const byDate = new Map(metrics.map((m) => [m.date, m]));
  for (const item of t7dayList) {
    const date = String(item.happenDay ?? '');
    const existing = byDate.get(date);
    if (!existing) continue;
    existing.vo2max = item.vo2max ?? existing.vo2max;
    existing.lthr = item.lthr ?? existing.lthr;
    existing.ltsp = item.ltsp ?? existing.ltsp;
    existing.staminaLevel = item.staminaLevel ?? existing.staminaLevel;
    existing.staminaLevel7d = item.staminaLevel7d ?? existing.staminaLevel7d;
  }
  return metrics;
}

// /dashboard/query returns the last ~7 days of nightly HRV; merge it into metrics by date.
export function mergeDashboardHrv(metrics: DailyMetric[], dashboard: DashboardResponse | undefined): DailyMetric[] {
  const hrvData = dashboard?.summaryInfo?.sleepHrvData;
  if (!hrvData) return metrics;

  const byDate = new Map(metrics.map((m) => [m.date, m]));
  const apply = (date: string, avg: number | undefined, base: number | undefined) => {
    if (!date) return;
    const existing = byDate.get(date);
    if (!existing) return;
    if (avg != null) existing.avgSleepHrv = avg;
    if (base != null) existing.baseline = base;
  };

  for (const item of hrvData.sleepHrvList ?? []) {
    apply(String(item.happenDay ?? ''), item.avgSleepHrv, item.sleepHrvBase);
  }
  // Top-level fields are today's summary — only apply if not already in sleepHrvList.
  apply(String(hrvData.happenDay ?? ''), hrvData.avgSleepHrv, hrvData.sleepHrvBase);
  return metrics;
}

export async function fetchActivities(
  startDay: string,
  endDay: string,
  page = 1,
  size = 30,
): Promise<Result<{ activities: ActivitySummary[]; total: number }, string>> {
  const result = await apiGet<ActivityListResponse>('/activity/query', {
    startDay,
    endDay,
    pageNumber: String(page),
    size: String(size),
  });
  if (!result.ok) return result;

  const items = result.value.dataList ?? result.value.list ?? [];
  const total = result.value.totalCount ?? result.value.count ?? items.length;
  return ok({ activities: items.map(parseActivity), total });
}

const DETAIL_STRIP_KEYS = ['graphList', 'frequencyList', 'gpsLightDuration'] as const;

export function stripActivityDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if ((DETAIL_STRIP_KEYS as readonly string[]).includes(k)) continue;
    out[k] = v;
  }
  return out;
}

export async function fetchActivityDetail(
  activityId: string,
  sportType: number,
): Promise<Result<Record<string, unknown>, string>> {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return tokenResult;

  const result = await apiPostForm<Record<string, unknown>>('/activity/detail/query', {
    labelId: activityId,
    userId: tokenResult.value.userId,
    sportType,
  });
  if (!result.ok) return result;
  if (!result.value || typeof result.value !== 'object') return err('Activity detail response was empty');
  return ok(stripActivityDetail(result.value));
}

const DASHBOARD_TIMEOUT_MS = 8000;
const ANALYSE_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<Result<T, string>>, ms: number, label: string): Promise<Result<T, string>> {
  return Promise.race([
    promise,
    new Promise<Result<T, string>>((resolve) =>
      setTimeout(() => resolve(err(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export type DailyMetricsResult = {
  metrics: DailyMetric[];
  warnings: string[];
};

export type DailyMetricsOptions = {
  dashboardTimeoutMs?: number;
  analyseTimeoutMs?: number;
};

export async function fetchDailyMetrics(
  startDay: string,
  endDay: string,
  options?: DailyMetricsOptions,
): Promise<Result<DailyMetricsResult, string>> {
  const dashboardMs = options?.dashboardTimeoutMs ?? DASHBOARD_TIMEOUT_MS;
  const analyseMs = options?.analyseTimeoutMs ?? ANALYSE_TIMEOUT_MS;
  // dayDetail is the only required endpoint; analyse and dashboard are best-effort
  // so one slow/broken endpoint can't wedge the tool.
  const [detailResult, analyseResult, dashboardResult] = await Promise.all([
    apiGet<DailyDetailResponse>('/analyse/dayDetail/query', { startDay, endDay }),
    withTimeout(apiGet<AnalyseResponse>('/analyse/query'), analyseMs, 'analyse'),
    withTimeout(apiGet<DashboardResponse>('/dashboard/query'), dashboardMs, 'dashboard'),
  ]);

  if (!detailResult.ok) return detailResult;

  const warnings: string[] = [];
  let metrics = (detailResult.value.dayList ?? []).map(parseDailyDetail);

  if (analyseResult.ok) {
    metrics = mergeAnalyse(metrics, analyseResult.value.t7dayList);
  } else {
    warnings.push(`VO2max/LTHR/stamina unavailable (${analyseResult.error}).`);
  }

  if (dashboardResult.ok) {
    metrics = mergeDashboardHrv(metrics, dashboardResult.value);
  } else {
    warnings.push(`HRV unavailable (${dashboardResult.error}).`);
  }

  return ok({
    metrics: metrics.sort((a, b) => a.date.localeCompare(b.date)),
    warnings,
  });
}
