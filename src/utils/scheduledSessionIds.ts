// ─── Canonical scheduled-session ID builders ─────────────────────────────────
//
// Single source of truth for how a ScheduledSession's `scheduledSessionId` is
// constructed. `scheduledSessions.ts` derivation AND every completion writer
// (manual log, mark completed, GPS run finish, treadmill finish, strength
// finish, custom workout, indoor cycling, skip) must import these instead of
// inlining the string format. Changing these formats changes the identity of
// every scheduled session already on disk — do not change the formats without
// a migration.

export function runScheduledSessionId(dateYMD: string, workoutId: string, dayIndex: number): string {
  return `week:${dateYMD}:run:${workoutId}:${dayIndex}`;
}

export function strengthScheduledSessionId(dateYMD: string, strengthId: string): string {
  return `week:${dateYMD}:strength:${strengthId}`;
}

export function otherScheduledSessionId(dateYMD: string, activityType: string, title: string): string {
  return `week:${dateYMD}:${activityType}:${title}`;
}

export function beginnerScheduledSessionId(planId: string, sessionId: string): string {
  return `${planId}:${sessionId}`;
}
