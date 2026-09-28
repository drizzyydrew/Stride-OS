import type { Activity, ActivityCoordinate, ActivityDraft, ActivityType, TelemetrySource } from '../types/activity';
import type { ScheduledSession } from './scheduledSessions';
import { toYMD } from './calendarEngine';

const METERS_PER_MILE = 1609.344;

export type HealthKitWorkoutCandidate = {
  uuid: string;
  sourceBundleIdentifier: string;
  sourceName?: string;
  deviceName?: string;
  deviceManufacturer?: string;
  startTime: number;
  endTime: number;
  activityType: ActivityType;
  durationSeconds: number;
  distanceMeters?: number;
  energyKcal?: number;
  averageHeartRateBpm?: number;
  maximumHeartRateBpm?: number;
  routeAvailable?: boolean;
  /** GPS route from Apple Health (downsampled), when requested and available. */
  routeCoordinates?: ActivityCoordinate[];
  importedByStrideOS?: boolean;
};

/** Keeps at most `max` points, always including the first and last. */
export function downsampleCoordinates(points: readonly ActivityCoordinate[], max = 2000): ActivityCoordinate[] {
  if (points.length <= max) return [...points];
  const step = (points.length - 1) / (max - 1);
  const out: ActivityCoordinate[] = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]!);
  return out;
}

export type ScheduleReconciliation =
  | { status: 'matched'; scheduledSessionId: string; confidence: 'high'; reason: string }
  | { status: 'ambiguous'; candidates: string[]; reason: string }
  | { status: 'none'; reason: string };

const SAME_FAMILY: Partial<Record<ActivityType, string>> = {
  running: 'foot', walking: 'foot', hiking: 'foot',
  cycling: 'bike', indoor_cycling: 'bike',
};

function activityFamily(type: ActivityType): string {
  return SAME_FAMILY[type] ?? type;
}

/** The same session recorded twice (e.g. phone GPS + watch HealthKit). */
export function overlapsExistingActivity(candidate: HealthKitWorkoutCandidate, activities: readonly Activity[]): boolean {
  return activities.some(activity => {
    if (activityFamily(activity.activityType) !== activityFamily(candidate.activityType)) return false;
    const start = activity.startTime;
    const end = activity.endTime ?? activity.startTime + (activity.metrics.durationSeconds ?? 0) * 1000;
    const overlap = Math.min(end, candidate.endTime) - Math.max(start, candidate.startTime);
    const shorter = Math.min(end - start, candidate.endTime - candidate.startTime);
    return shorter > 0 && overlap / shorter >= 0.5;
  });
}

export function isDuplicateHealthKitWorkout(candidate: HealthKitWorkoutCandidate, activities: readonly Activity[]): boolean {
  if (overlapsExistingActivity(candidate, activities)) return true;
  return activities.some(activity => {
    if (activity.healthKit?.workoutUuid === candidate.uuid
      && activity.healthKit.sourceBundleIdentifier === candidate.sourceBundleIdentifier) return true;
    return Boolean(candidate.importedByStrideOS && activity.source === 'tracked'
      && Math.abs(activity.startTime - candidate.startTime) < 30_000
      && Math.abs((activity.endTime ?? activity.startTime) - candidate.endTime) < 30_000);
  });
}

export function reconcileHealthKitWorkout(
  candidate: HealthKitWorkoutCandidate,
  sessions: readonly ScheduledSession[],
): ScheduleReconciliation {
  const localDate = toYMD(new Date(candidate.startTime));
  const sameDay = sessions.filter(session => session.date === localDate && compatibleTypes(candidate.activityType, session.activityType));
  if (sameDay.length === 0) return { status: 'none', reason: 'No compatible scheduled session on the workout date.' };
  const scored = sameDay.map(session => ({
    session,
    score: scoreSession(candidate, session),
  })).filter(item => item.score >= 70).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { status: 'none', reason: 'No scheduled session was close enough in type and duration or distance.' };
  if (scored.length > 1 && scored[0].score - scored[1].score < 12) {
    return { status: 'ambiguous', candidates: scored.slice(0, 3).map(item => item.session.scheduledSessionId), reason: 'Multiple planned workouts match this Health workout.' };
  }
  return { status: 'matched', scheduledSessionId: scored[0].session.scheduledSessionId, confidence: 'high', reason: 'Matched by local date, activity type, and planned duration or distance.' };
}

export function buildHealthKitActivityDraft(input: {
  candidate: HealthKitWorkoutCandidate;
  reconciliation?: ScheduleReconciliation;
  importedAt?: number;
}): ActivityDraft {
  const { candidate } = input;
  const importedAt = input.importedAt ?? Date.now();
  const scheduledSessionId = input.reconciliation?.status === 'matched'
    ? input.reconciliation.scheduledSessionId
    : undefined;
  const metricSources: ActivityDraft['metrics']['metricSources'] = {
    distance: candidate.distanceMeters != null ? sourceFromCandidate(candidate) : 'unavailable',
    heartRate: candidate.averageHeartRateBpm != null || candidate.maximumHeartRateBpm != null ? sourceFromCandidate(candidate) : 'unavailable',
    energy: candidate.energyKcal != null ? 'healthkit' : 'unavailable',
  };
  return {
    id: `healthkit_${candidate.sourceBundleIdentifier}_${candidate.uuid}`,
    activityType: candidate.activityType,
    subtype: candidate.activityType === 'indoor_cycling' ? 'stationary' : candidate.activityType === 'running' ? 'outdoor' : undefined,
    source: 'healthkit',
    status: 'completed',
    scheduled: Boolean(scheduledSessionId),
    scheduledSessionId,
    completionClassification: scheduledSessionId ? 'completed_as_prescribed' : 'completed_other_activity',
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    indoor: candidate.activityType === 'indoor_cycling',
    metrics: {
      routeCoordinates: candidate.routeCoordinates?.length ? candidate.routeCoordinates : undefined,
      durationSeconds: candidate.durationSeconds,
      activeTimeSeconds: candidate.durationSeconds,
      distanceMeters: candidate.distanceMeters,
      estimatedCalories: candidate.energyKcal,
      averageHeartRateBpm: candidate.averageHeartRateBpm,
      maximumHeartRateBpm: candidate.maximumHeartRateBpm,
      distanceSource: candidate.distanceMeters != null ? 'health_import' : 'unavailable',
      metricSources,
    },
    healthKit: {
      workoutUuid: candidate.uuid,
      sourceBundleIdentifier: candidate.sourceBundleIdentifier,
      sourceName: candidate.sourceName,
      deviceName: candidate.deviceName,
      deviceManufacturer: candidate.deviceManufacturer,
      originalStartTime: candidate.startTime,
      originalEndTime: candidate.endTime,
      localCalendarDate: toYMD(new Date(candidate.startTime)),
      importedAt,
      routeStatus: candidate.routeAvailable ? 'available' : 'not_available',
      importedByStrideOS: Boolean(candidate.importedByStrideOS),
    },
  };
}

function compatibleTypes(candidate: ActivityType, sessionType: ScheduledSession['activityType']): boolean {
  if (candidate === 'running') return sessionType === 'run' || sessionType === 'run_walk';
  if (candidate === 'walking') return sessionType === 'walk' || sessionType === 'run_walk';
  if (candidate === 'cycling') return sessionType === 'cycling';
  if (candidate === 'indoor_cycling') return sessionType === 'cycling';
  if (candidate === 'strength') return sessionType === 'strength';
  if (candidate === 'mobility') return sessionType === 'mobility';
  return false;
}

function scoreSession(candidate: HealthKitWorkoutCandidate, session: ScheduledSession): number {
  let score = 55;
  const durationDelta = Math.abs((candidate.durationSeconds / 60) - session.durationMinutes);
  if (durationDelta <= 5) score += 25;
  else if (durationDelta <= 12) score += 12;
  if (session.distanceMiles && candidate.distanceMeters) {
    const candidateMiles = candidate.distanceMeters / METERS_PER_MILE;
    const ratio = Math.abs(candidateMiles - session.distanceMiles) / Math.max(0.1, session.distanceMiles);
    if (ratio <= 0.12) score += 25;
    else if (ratio <= 0.25) score += 10;
  }
  if (session.completedActivityId) score -= 35;
  return score;
}

function sourceFromCandidate(candidate: HealthKitWorkoutCandidate): TelemetrySource {
  const source = `${candidate.sourceBundleIdentifier} ${candidate.sourceName ?? ''} ${candidate.deviceName ?? ''}`.toLowerCase();
  if (source.includes('watch')) return 'apple_watch';
  return 'healthkit';
}
