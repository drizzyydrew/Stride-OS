import type { CompletedWorkoutRecord, RunningQualityFeedback, RunningQualityPrescription } from '../types/training';

const RUN_TYPES = new Set(['easy_run', 'recovery_run', 'run_walk', 'long_run', 'progression_run', 'tempo', 'threshold', 'marathon_pace', 'vo2', 'hill_repeats', 'fartlek', 'norwegian_4x4', 'intervals', 'strides', 'sprint', 'taper_session', 'deload_session']);
const RUNGS = new Set(['strides', 'gentle_fartlek', 'tempo_threshold', 'intervals', 'norwegian_4x4']);

export function canReportRunningQuality(record: CompletedWorkoutRecord | undefined): boolean {
  return !!record && !record.skipped && RUN_TYPES.has(record.type)
    && Number.isFinite(record.actualDurationMinutes) && record.actualDurationMinutes! > 0;
}

/** Validate an explicit report against actual total time, not scheduled time.
 * The report describes what the athlete says happened; it is not sensor proof. */
export function normalizeRunningQuality(value: unknown, actualMinutes: number | undefined): RunningQualityFeedback | undefined {
  if (!value || typeof value !== 'object' || !Number.isFinite(actualMinutes) || actualMinutes! <= 0) return undefined;
  const q = value as RunningQualityFeedback;
  if (q.version !== 1 || q.source !== 'athlete_reported' || !RUNGS.has(q.rung)
    || !Number.isSafeInteger(q.completedReps) || q.completedReps < 1 || q.completedReps > 20
    || !Number.isSafeInteger(q.workSeconds) || q.workSeconds < 5 || q.workSeconds > 1800
    || !Number.isFinite(q.rpe) || q.rpe < 1 || q.rpe > 10 || typeof q.comfortableRecovery !== 'boolean'
    || q.completedReps * q.workSeconds > actualMinutes! * 60
    || (q.recordedAt !== undefined && (!Number.isFinite(q.recordedAt) || q.recordedAt <= 0))) return undefined;
  if (q.rung === 'norwegian_4x4' && (q.completedReps !== 4 || q.workSeconds !== 240)) return undefined;
  if (q.rung === 'strides' && q.workSeconds > 30) return undefined;
  return { version: 1, source: 'athlete_reported', rung: q.rung, completedReps: q.completedReps,
    workSeconds: q.workSeconds, rpe: q.rpe, comfortableRecovery: q.comfortableRecovery,
    ...(q.recordedAt !== undefined ? { recordedAt: q.recordedAt } : {}) };
}


/** Exact uniform generated targets only. No parsing titles or recreating a
 * session from the current week after its original recording has ended. */
export function captureRunningQualityPrescription(workout: import('../types/workout').RichWorkout | null): RunningQualityPrescription | undefined {
  if (!workout?.intervals || !Array.isArray(workout.mainSet)) return undefined;
  const rung = workout.protocol === 'norwegian_4x4' ? 'norwegian_4x4' : workout.richType === 'strides' ? 'strides'
    : workout.richType === 'fartlek' ? 'gentle_fartlek' : workout.richType === 'threshold' ? 'tempo_threshold'
      : workout.richType === 'vo2' ? 'intervals' : undefined;
  if (!rung) return undefined;
  const work = workout.mainSet.filter(segment => /^Work \d+$/.test(segment.label));
  if (!work.length || work.length !== workout.intervals.setCount || !work.every(segment => segment.targetSeconds === work[0]!.targetSeconds)) return undefined;
  return normalizeRunningQualityPrescription({ version: 1, source: 'captured_prescription', rung,
    completedReps: work.length, workSeconds: work[0]!.targetSeconds });
}
export function normalizeRunningQualityPrescription(value: unknown): RunningQualityPrescription | undefined {
  if (!value || typeof value !== 'object' || (value as RunningQualityPrescription).source !== 'captured_prescription') return undefined;
  const q = value as RunningQualityPrescription;
  const normalized = normalizeRunningQuality({ ...q, source: 'athlete_reported', rpe: 6, comfortableRecovery: true }, 600);
  return normalized ? { version: 1, source: 'captured_prescription', rung: normalized.rung,
    completedReps: normalized.completedReps, workSeconds: normalized.workSeconds } : undefined;
}

/** Confirmation converts only this immutable prescription to a self-report.
 * No answer, changed work or insufficient recorded time produces no exposure. */
export function confirmedPlannedRunningQuality(record: CompletedWorkoutRecord, response: 'as_planned' | 'changed' | 'unsure', rpe: number, recovered: boolean): RunningQualityFeedback | undefined {
  const plan = normalizeRunningQualityPrescription(record.runningQualityPrescription);
  return response === 'as_planned' && plan ? normalizeRunningQuality({ ...plan, source: 'athlete_reported', rpe,
    comfortableRecovery: recovered, recordedAt: Date.now() }, record.actualDurationMinutes) : undefined;
}

export function normalizeRunningQualityResponse(value: unknown): CompletedWorkoutRecord['runningQualityResponse'] {
  if (!value || typeof value !== 'object') return undefined;
  const r = value as NonNullable<CompletedWorkoutRecord['runningQualityResponse']>;
  return r.version === 1 && r.source === 'athlete_reported' && ['as_planned', 'changed', 'unsure'].includes(r.value)
    && Number.isFinite(r.recordedAt) && r.recordedAt > 0
    ? { version: 1, source: 'athlete_reported', value: r.value, recordedAt: r.recordedAt } : undefined;
}
