import type { Activity } from '../types/activity';

/** Only real, completed StrideOS sessions go to Apple Health (never re-imports). */
export function shouldWriteActivityToHealth(activity: Activity): boolean {
  if (activity.source === 'healthkit') return false;
  if (activity.status !== 'completed') return false;
  return (activity.metrics.durationSeconds ?? 0) >= 60;
}

/**
 * True when the Apple Watch reported during this activity. The watch then
 * saved its own workout (heart rate, and route when permitted) to Apple
 * Health, so the phone must not write a second copy of the same session.
 */
export function watchRecordedActivity(activity: Activity, watchLastSeenAt: number | null | undefined): boolean {
  if (watchLastSeenAt == null) return false;
  return watchLastSeenAt >= activity.startTime;
}
