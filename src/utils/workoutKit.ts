import type { ScheduledSession } from './scheduledSessions';

export type WorkoutKitEligibility =
  | { supported: true; scheduledSessionId: string; workoutKind: 'running' | 'cycling'; summary: string }
  | { supported: false; scheduledSessionId: string; reason: string };

export function workoutKitEligibilityForSession(session: ScheduledSession): WorkoutKitEligibility {
  const activity = session.activityType;
  if (activity !== 'run' && activity !== 'run_walk' && activity !== 'cycling') {
    return { supported: false, scheduledSessionId: session.scheduledSessionId, reason: 'WorkoutKit export is limited to representable running and cycling prescriptions.' };
  }
  if (!Number.isFinite(session.durationMinutes) || session.durationMinutes <= 0) {
    return { supported: false, scheduledSessionId: session.scheduledSessionId, reason: 'The scheduled workout has no duration target.' };
  }
  if (session.activityType === 'run_walk' && !session.runWalk) {
    return { supported: false, scheduledSessionId: session.scheduledSessionId, reason: 'Run/walk workout is missing interval structure.' };
  }
  const kind = session.activityType === 'cycling' ? 'cycling' : 'running';
  const parts = [
    `${session.durationMinutes} min`,
    session.distanceMiles ? `${session.distanceMiles.toFixed(1)} mi` : null,
    session.paceTarget ?? session.hrTarget ?? session.rpeTarget ?? null,
  ].filter(Boolean);
  return {
    supported: true,
    scheduledSessionId: session.scheduledSessionId,
    workoutKind: kind,
    summary: parts.join(' - '),
  };
}
