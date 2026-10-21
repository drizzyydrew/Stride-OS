import type { Activity, ActivityCoordinate, ActivityDraft, ActivityMetrics, ActivityType, TelemetrySource } from '../types/activity';
import type { ScheduledSession } from './scheduledSessions';
import { toYMD } from './calendarEngine';
import { sameRecording } from './runCompletionIdentity';

const METERS_PER_MILE = 1609.344;

/** The installed HealthKit bridge wraps statistic quantities with their unit. */
export function healthKitQuantity(value: unknown): number | undefined {
  const raw = value != null && typeof value === 'object'
    ? (value as { quantity?: unknown; value?: unknown }).quantity ?? (value as { value?: unknown }).value : value;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

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
  metricsSummary?: Pick<ActivityMetrics, 'stepCount' | 'runningDynamics' | 'speed' | 'cadenceRpm'>;
  healthKitDistance?: ActivityMetrics['healthKitDistance'];
  routeAvailable?: boolean;
  /** Original GPS observations from Apple Health; downsample only for rendering. */
  routeCoordinates?: ActivityCoordinate[];
  importedByStrideOS?: boolean;
  workoutInstanceId?: string;
  strideOSActivityId?: string;
  strideOSWorkoutId?: string;
};

export type HealthKitRecordingIdentity = Pick<HealthKitWorkoutCandidate,
  'workoutInstanceId' | 'strideOSActivityId' | 'strideOSWorkoutId'>;

function metadataId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** Preserve exact recording lineage; dates and schedule IDs are not identity. */
export function healthKitRecordingIdentity(metadata?: Record<string, unknown>): HealthKitRecordingIdentity {
  return {
    workoutInstanceId: metadataId(metadata?.StrideOSWorkoutInstanceId),
    strideOSActivityId: metadataId(metadata?.StrideOSActivityId),
    strideOSWorkoutId: metadataId(metadata?.StrideOSWorkoutId),
  };
}

export function healthKitRecordingMetadata(identity: HealthKitRecordingIdentity): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const [key, value] of [
    ['StrideOSWorkoutInstanceId', identity.workoutInstanceId],
    ['StrideOSActivityId', identity.strideOSActivityId],
    ['StrideOSWorkoutId', identity.strideOSWorkoutId],
  ] as const) {
    if (metadataId(value) !== undefined) metadata[key] = value!;
  }
  return metadata;
}

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

/** Only exact recording lineage can suppress a Health read/write, not temporal overlap. */
export function overlapsExistingActivity(candidate: HealthKitWorkoutCandidate, activities: readonly Activity[]): boolean {
  const draft = buildHealthKitActivityDraft({ candidate });
  return activities.some(activity => sameRecording(activity, { ...draft, id: draft.id!, createdAt: candidate.startTime,
    updatedAt: candidate.endTime, trainingLoad: activity.trainingLoad }));
}

export function isDuplicateHealthKitWorkout(candidate: HealthKitWorkoutCandidate, activities: readonly Activity[]): boolean {
  return overlapsExistingActivity(candidate, activities);
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
    ...(candidate.metricsSummary?.stepCount != null ? { steps: 'healthkit' } : {}),
    ...(candidate.metricsSummary?.speed ? { speed: 'healthkit' } : {}),
    ...(candidate.metricsSummary?.cadenceRpm != null ? { cadence: 'healthkit' } : {}),
    distance: candidate.distanceMeters != null ? sourceFromCandidate(candidate) : 'unavailable',
    heartRate: candidate.averageHeartRateBpm != null || candidate.maximumHeartRateBpm != null ? sourceFromCandidate(candidate) : 'unavailable',
    energy: candidate.energyKcal != null ? 'healthkit' : 'unavailable',
  };
  return {
    id: `healthkit_${candidate.sourceBundleIdentifier}_${candidate.uuid}`,
    workoutInstanceId: candidate.workoutInstanceId,
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
      ...candidate.metricsSummary,
      healthKitDistance: candidate.healthKitDistance,
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
      routeStatus: candidate.routeAvailable == null ? 'not_read' : candidate.routeAvailable ? 'available' : 'not_available',
      importedByStrideOS: Boolean(candidate.importedByStrideOS),
      workoutInstanceId: candidate.workoutInstanceId,
      strideOSActivityId: candidate.strideOSActivityId,
      strideOSWorkoutId: candidate.strideOSWorkoutId,
    },
  } as ActivityDraft;
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
