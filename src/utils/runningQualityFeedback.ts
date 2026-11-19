import type { CompletedWorkoutRecord, RunningQualityFeedback } from '../types/training';

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
