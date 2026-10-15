import type { Activity, DistanceSource } from '../types/activity';
import type { CompletedWorkoutRecord } from '../types/training';

export type RunCompletionIdentity = {
  workoutInstanceId?: string;
  watchRecording?: Activity['watchRecording'];
  actualStartTime?: number;
  actualEndTime?: number;
  scheduledSessionId?: string;
  ownerUserId?: string;
  distanceSource?: DistanceSource;
  associatedTrainingBlockId?: string;
  associatedGoalId?: string;
  activityMetrics?: Activity['metrics'];
  indoor?: boolean;
  activitySubtype?: Activity['subtype'];
};
export type RunWorkoutRecord = CompletedWorkoutRecord & RunCompletionIdentity;
export type ActivityLineage = Activity & { workoutInstanceId?: string };

/** Native recording evidence is useful only for its exact recording instance. */
export function matchingWatchRecording(
  evidence: Activity['watchRecording'],
  workoutInstanceId: string | null | undefined,
  startedAt?: number,
): Activity['watchRecording'] {
  if (!evidence || !workoutInstanceId || evidence.workoutInstanceId !== workoutInstanceId
    || !Number.isFinite(evidence.confirmedAt) || evidence.confirmedAt <= 0
    || (startedAt != null && evidence.confirmedAt < startedAt)
    || !['running', 'paused', 'ended'].includes(evidence.state)) return undefined;
  return { workoutInstanceId, confirmedAt: evidence.confirmedAt, state: evidence.state };
}

export function runCompletionKey(workoutInstanceId: string | null | undefined, startedAt?: number | null): string {
  const instance = workoutInstanceId || (startedAt != null && Number.isFinite(startedAt) ? `started_${startedAt}` : null);
  if (!instance) throw new Error('A run must retain its recording identity before it can be saved');
  return `run_${encodeURIComponent(instance)}`;
}

/** Schedule linkage and time proximity are not proof that two recordings are one. */
export function sameRecording(a: ActivityLineage, b: ActivityLineage): boolean {
  if (a.id === b.id) return true;
  if (a.workoutInstanceId && b.workoutInstanceId) return a.workoutInstanceId === b.workoutInstanceId;
  if (a.activityType === b.activityType && a.legacyWorkoutId && b.legacyWorkoutId && a.legacyWorkoutId === b.legacyWorkoutId) return true;
  const ah = a.healthKit as (NonNullable<Activity['healthKit']> & {
    workoutInstanceId?: string; strideOSActivityId?: string; strideOSWorkoutId?: string;
  }) | undefined;
  const bh = b.healthKit as typeof ah;
  if (ah?.workoutUuid && bh?.workoutUuid && ah.workoutUuid === bh.workoutUuid
    && ah.sourceBundleIdentifier === bh.sourceBundleIdentifier) return true;
  if (ah?.strideOSActivityId === b.id || bh?.strideOSActivityId === a.id) return true;
  if ((ah?.strideOSWorkoutId && ah.strideOSWorkoutId === b.legacyWorkoutId)
    || (bh?.strideOSWorkoutId && bh.strideOSWorkoutId === a.legacyWorkoutId)) return true;
  const ai = a.workoutInstanceId ?? ah?.workoutInstanceId;
  const bi = b.workoutInstanceId ?? bh?.workoutInstanceId;
  return !!ai && !!bi && ai === bi;
}

export function mergeRecording(existing: ActivityLineage, incoming: ActivityLineage): ActivityLineage {
  // Health enriches a phone recording without replacing its GPS route or measured fields.
  const preferExisting = (existing.source !== 'healthkit' && incoming.source === 'healthkit')
    || (existing.source !== 'legacy_import' && incoming.source === 'legacy_import');
  const primary = preferExisting ? existing : incoming;
  const secondary = preferExisting ? incoming : existing;
  return {
    ...secondary, ...primary,
    id: existing.id, createdAt: existing.createdAt,
    workoutInstanceId: primary.workoutInstanceId ?? secondary.workoutInstanceId,
    watchRecording: matchingWatchRecording(primary.watchRecording, primary.workoutInstanceId ?? secondary.workoutInstanceId, primary.startTime)
      ?? matchingWatchRecording(secondary.watchRecording, primary.workoutInstanceId ?? secondary.workoutInstanceId, primary.startTime),
    scheduledSessionId: primary.scheduledSessionId ?? secondary.scheduledSessionId,
    legacyWorkoutId: primary.legacyWorkoutId ?? secondary.legacyWorkoutId,
    healthKit: incoming.healthKit ?? existing.healthKit,
    metrics: {
      ...secondary.metrics, ...Object.fromEntries(Object.entries(primary.metrics).filter(([, value]) => value !== undefined)),
      routeCoordinates: primary.metrics.routeCoordinates?.length ? primary.metrics.routeCoordinates : secondary.metrics.routeCoordinates,
      metricSources: { ...secondary.metrics.metricSources, ...primary.metrics.metricSources },
    },
    updatedAt: Math.max(existing.updatedAt, incoming.updatedAt),
  };
}
