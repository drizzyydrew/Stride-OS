import type { Activity } from '../types/activity';

/** Only real, completed StrideOS sessions go to Apple Health (never re-imports). */
export function shouldWriteActivityToHealth(activity: Activity): boolean {
  if (activity.source === 'healthkit') return false;
  if (activity.status !== 'completed') return false;
  return (activity.metrics.durationSeconds ?? 0) >= 60;
}

/**
 * Connectivity is not evidence of recording. Only an exact recording-state
 * event may suppress the phone's Health copy.
 */
export function watchRecordedActivity(activity: Activity, _legacyLastSeenAt?: number | null): boolean {
  const evidence = activity.watchRecording;
  return !!activity.workoutInstanceId && evidence?.workoutInstanceId === activity.workoutInstanceId
    && Number.isFinite(evidence.confirmedAt) && evidence.confirmedAt > 0
    && ['running', 'paused', 'ended'].includes(evidence.state);
}
