import type { Activity, ActivityDraft, ActivityStatus, ActivityType } from '../types/activity';
import type { ScheduledSession } from './scheduledSessions';

export type CompletionState = 'completed_as_planned' | 'modified' | 'partial' | 'stopped_early';

export type ManualCompletionFields = {
  activityType?: ActivityType;
  completionState?: CompletionState;
  startTime?: number;
  durationMinutes?: number;
  distance?: number;
  distanceUnit?: 'mi' | 'km';
  averageHeartRateBpm?: number;
  maximumHeartRateBpm?: number;
  rpe?: number;
  elevationGainFeet?: number;
  cadenceRpm?: number;
  calories?: number;
  routeId?: string;
  notes?: string;
  symptoms?: string[];
  indoor?: boolean;
};

export type PaceOrSpeedResult =
  | { kind: 'pace'; secondsPerKilometer: number; label: string }
  | { kind: 'speed'; metersPerSecond: number; label: string }
  | { kind: 'empty'; label: '--' };

export function activityTypeFromScheduledSession(session: ScheduledSession | null | undefined): ActivityType {
  if (!session) return 'running';
  if (session.activityType === 'run' || session.activityType === 'run_walk') return 'running';
  if (session.activityType === 'walk') return 'walking';
  if (session.activityType === 'cycling') return 'cycling';
  if (session.activityType === 'swimming') return 'swimming';
  if (session.activityType === 'hiking') return 'hiking';
  if (session.activityType === 'skiing') return 'downhill_skiing';
  if (session.activityType === 'mixed') return 'mixed_modal';
  if (session.activityType === 'strength') return 'strength';
  if (session.activityType === 'mobility') return 'mobility';
  return 'other';
}

export function completionStatusForState(state: CompletionState): ActivityStatus {
  if (state === 'partial' || state === 'stopped_early') return 'partial';
  return 'completed';
}

export function isPaceBasedActivity(type: ActivityType): boolean {
  return type === 'running' || type === 'walking' || type === 'hiking';
}

export function isSpeedBasedActivity(type: ActivityType): boolean {
  return type === 'cycling'
    || type === 'indoor_cycling'
    || type === 'downhill_skiing'
    || type === 'cross_country_skiing'
    || type === 'snowboarding';
}

export function distanceToMeters(distance: number | undefined, unit: 'mi' | 'km' = 'mi'): number | undefined {
  if (!distance || !Number.isFinite(distance) || distance <= 0) return undefined;
  return unit === 'km' ? distance * 1000 : distance * 1609.344;
}

function formatPace(secondsPerUnit: number, unit: 'mi' | 'km'): string {
  const safe = Math.max(1, Math.round(secondsPerUnit));
  const minutes = Math.floor(safe / 60);
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}/${unit}`;
}

export function calculatePaceOrSpeed(
  activityType: ActivityType,
  distance: number | undefined,
  distanceUnit: 'mi' | 'km',
  durationSeconds: number | undefined,
  displayUnit: 'mi' | 'km' = distanceUnit,
): PaceOrSpeedResult {
  const meters = distanceToMeters(distance, distanceUnit);
  if (!meters || !durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { kind: 'empty', label: '--' };
  }
  if (isSpeedBasedActivity(activityType)) {
    const metersPerSecond = meters / durationSeconds;
    const speed = displayUnit === 'km'
      ? metersPerSecond * 3.6
      : metersPerSecond * 2.2369362921;
    return { kind: 'speed', metersPerSecond, label: `${speed.toFixed(1)} ${displayUnit === 'km' ? 'km/h' : 'mph'}` };
  }
  const secondsPerKilometer = durationSeconds / (meters / 1000);
  const label = displayUnit === 'km'
    ? formatPace(secondsPerKilometer, 'km')
    : formatPace(secondsPerKilometer * 1.609344, 'mi');
  return { kind: 'pace', secondsPerKilometer, label };
}

export function getCompletedActivityForScheduledSession(
  activities: Activity[],
  scheduledSessionId: string | null | undefined,
): Activity | null {
  if (!scheduledSessionId) return null;
  return activities
    .filter(activity => activity.scheduledSessionId === scheduledSessionId)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    ?? null;
}

export function overlayCompletionOnScheduledSessions(
  sessions: ScheduledSession[],
  activities: Activity[],
): ScheduledSession[] {
  return sessions.map(session => {
    const completed = getCompletedActivityForScheduledSession(activities, session.scheduledSessionId);
    if (!completed) return session;
    return {
      ...session,
      status: completed.status === 'partial' ? 'partial' : completed.status,
      completedActivityId: completed.id,
      completionState: completed.status === 'partial' ? 'partial' : 'completed_as_planned',
    };
  });
}

export function buildManualActivityDraft(
  session: ScheduledSession | null,
  fields: ManualCompletionFields,
  now: number = Date.now(),
): ActivityDraft {
  const activityType = fields.activityType ?? activityTypeFromScheduledSession(session);
  const durationMinutes = Math.max(1, fields.durationMinutes ?? session?.durationMinutes ?? 1);
  const durationSeconds = Math.round(durationMinutes * 60);
  const distanceMeters = distanceToMeters(fields.distance, fields.distanceUnit ?? 'mi');
  const paceOrSpeed = calculatePaceOrSpeed(activityType, fields.distance, fields.distanceUnit ?? 'mi', durationSeconds);
  const startTime = fields.startTime ?? now - durationSeconds * 1000;
  const indoor = fields.indoor ?? (activityType === 'indoor_cycling' || activityType === 'strength' || activityType === 'mobility');
  const completionState = fields.completionState ?? 'completed_as_planned';

  return {
    activityType,
    subtype: session?.activityType === 'run_walk' ? 'run_walk' : activityType === 'running' && indoor ? 'treadmill' : 'general',
    source: session ? 'training_plan' : 'manual',
    status: completionStatusForState(completionState),
    scheduled: Boolean(session),
    associatedTrainingBlockId: session?.trainingBlockId,
    associatedGoalId: session?.goalPlanId,
    scheduledSessionId: session?.scheduledSessionId,
    startTime,
    endTime: startTime + durationSeconds * 1000,
    rpe: fields.rpe,
    notes: fields.notes?.trim() || undefined,
    symptoms: fields.symptoms?.filter(Boolean),
    indoor,
    metrics: {
      durationSeconds,
      elapsedTimeSeconds: durationSeconds,
      activeTimeSeconds: durationSeconds,
      distanceMeters,
      averageHeartRateBpm: fields.averageHeartRateBpm,
      maximumHeartRateBpm: fields.maximumHeartRateBpm,
      elevationGainMeters: fields.elevationGainFeet ? fields.elevationGainFeet / 3.28084 : undefined,
      cadenceRpm: fields.cadenceRpm,
      estimatedCalories: fields.calories,
      routeId: fields.routeId,
      pace: paceOrSpeed.kind === 'pace'
        ? { averageSecondsPerKilometer: paceOrSpeed.secondsPerKilometer }
        : undefined,
      speed: paceOrSpeed.kind === 'speed'
        ? { averageMetersPerSecond: paceOrSpeed.metersPerSecond }
        : undefined,
      strength: activityType === 'strength' && session?.strengthSession
        ? {
          exerciseCount: session.strengthSession.exercises.length,
          sets: session.strengthSession.exercises.reduce((sum, item) => sum + item.sets, 0),
        }
        : undefined,
      runWalkIntervals: session?.runWalk
        ? Array.from({ length: session.runWalk.rounds }).flatMap(() => [
          { kind: 'run' as const, durationSeconds: session.runWalk!.runSeconds },
          { kind: 'walk' as const, durationSeconds: session.runWalk!.walkSeconds },
        ])
        : undefined,
    },
  };
}

export function plannedVersusCompletedComparison(session: ScheduledSession, activity: Activity | null): string[] {
  const rows = [
    `Planned: ${session.title}`,
    `Planned duration: ${session.durationMinutes} min`,
  ];
  if (session.runWalk) {
    rows.push(`Planned intervals: ${session.runWalk.rounds} rounds of ${session.runWalk.runSeconds} sec run / ${session.runWalk.walkSeconds} sec walk`);
  }
  if (session.hrTarget) rows.push(`Planned HR: ${session.hrTarget}`);
  if (session.rpeTarget) rows.push(`Planned RPE: ${session.rpeTarget}`);
  if (!activity) {
    rows.push('Completed activity: none linked yet');
    return rows;
  }
  rows.push(`Actual duration: ${Math.round((activity.metrics.durationSeconds ?? 0) / 60)} min`);
  if (activity.metrics.distanceMeters) rows.push(`Actual distance: ${(activity.metrics.distanceMeters / 1609.344).toFixed(2)} mi`);
  if (activity.rpe) rows.push(`Actual RPE: ${activity.rpe}/10`);
  rows.push(`Completion status: ${activity.status === 'partial' ? 'Partially completed' : 'Completed'}`);
  return rows;
}
