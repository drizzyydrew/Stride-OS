// ─── Live Workout Instance Identity ───────────────────────────────────────
//
// Every live session (run, outdoor activity, strength session) is stamped
// with a `workoutInstanceId` the moment it starts. This is what fixes the
// "dismiss without End leaves the store wedged" bug: mount guards key off
// instance identity (does the active instance match what I was asked to
// launch?) instead of a bare `isActive` boolean, which is indistinguishable
// between "this is my run, resume it" and "some other run is stuck active."

import { isStaleActiveSession } from './activeSessionOwner';

export { isStaleActiveSession, STALE_ACTIVE_SESSION_THRESHOLD_MS } from './activeSessionOwner';

export function buildWorkoutInstanceId(
  scheduledSessionId: string | null | undefined,
  atMs: number,
): string {
  return `${scheduledSessionId ?? 'adhoc'}:${atMs}`;
}

// Used on rehydrate: if a persisted active session predates this feature (no
// workoutInstanceId written), synthesize one from what we do have rather
// than discarding the session. Returns null when there is nothing to
// synthesize from (no active session).
export function synthesizeWorkoutInstanceId(params: {
  workoutInstanceId?: string | null;
  scheduledSessionId?: string | null;
  startedAtMs: number | null;
}): string | null {
  if (params.workoutInstanceId) return params.workoutInstanceId;
  if (params.startedAtMs == null || !Number.isFinite(params.startedAtMs)) return null;
  return buildWorkoutInstanceId(params.scheduledSessionId ?? null, params.startedAtMs);
}

export type LaunchInstanceDecision = 'start_new' | 'resume' | 'confirm';

// Decides what a launch surface (e.g. run-tracking.tsx on mount) should do
// given the currently-active session and the workout the athlete is trying
// to launch:
//   - nothing active                              -> start_new (silently)
//   - active session is for the same workout       -> resume (silently)
//   - active session is for a different workout,
//     or is the same workout but stale             -> confirm (ask: resume
//                                                      previous / discard and
//                                                      start new — never a
//                                                      silent wedge)
export function resolveLaunchDecision(input: {
  isActive: boolean;
  activeScheduledSessionId: string | null;
  requestedScheduledSessionId: string | null;
  startedAtMs: number | null;
  nowMs?: number;
}): LaunchInstanceDecision {
  if (!input.isActive) return 'start_new';

  const now = input.nowMs ?? Date.now();
  const stale = isStaleActiveSession(input.startedAtMs, now);
  const matches = input.activeScheduledSessionId === input.requestedScheduledSessionId;

  if (matches && !stale) return 'resume';
  return 'confirm';
}
