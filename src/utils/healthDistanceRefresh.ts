import type { Activity, ActivityType, HealthKitDistanceEvidence, HealthKitImportMetadata } from '../types/activity';
import { hasRecordedEvidence } from './manualActivityEdit';
import { hasSupportedHealthDistanceScope, hasValidHealthDistanceSampleSource } from './healthDistanceImport';
import { buildHealthDistanceSplits } from './healthDistanceSplits';

export type HealthDistanceLink = { activityType: ActivityType; metadata: HealthKitImportMetadata };
type DistanceSample = HealthKitDistanceEvidence['samples'][number];
const sameSample = (a: DistanceSample, b: DistanceSample) => a.id === b.id && a.sourceBundleIdentifier === b.sourceBundleIdentifier
  && a.startTime === b.startTime && a.endTime === b.endTime && a.distanceMeters === b.distanceMeters;

export function supportsHealthSplitRefresh(activity: Activity): boolean {
  return !activity.indoor && ['running', 'walking', 'hiking', 'cycling'].includes(activity.activityType) && hasRecordedEvidence(activity);
}

/** Refresh analysis evidence only; athlete-entered summaries and recording data remain untouched. */
export function mergeHealthDistanceEvidence(activity: Activity, incoming: HealthKitDistanceEvidence,
  workoutInstanceId?: string, link?: HealthDistanceLink): Activity {
  let health = activity.healthKit;
  if (!hasSupportedHealthDistanceScope(incoming) || !Number.isFinite(incoming.retrievedAt) || incoming.samples.length > 100_000
    || JSON.stringify(incoming).length > 16_000_000) throw new Error('Health distance evidence cannot be saved safely. Existing data was kept.');
  if (incoming.samples.some(sample => !hasValidHealthDistanceSampleSource(incoming, sample.sourceBundleIdentifier))) {
    throw new Error('Health distance sample provenance cannot be confirmed. Existing data was kept.');
  }
  const nextSamples = new Map<string, DistanceSample>();
  for (const sample of incoming.samples) {
    const prior = nextSamples.get(sample.id);
    if (typeof sample.id !== 'string' || !sample.id.trim() || prior && !sameSample(prior, sample)) {
      throw new Error('Health distance has conflicting or missing sample identifiers. Existing data was kept.');
    }
    nextSamples.set(sample.id, sample);
  }
  if (link) {
    const activityClaims = [link.metadata.strideOSActivityId, health?.strideOSActivityId].filter(value => value?.trim());
    const workoutClaims = [activity.legacyWorkoutId, link.metadata.strideOSWorkoutId, health?.strideOSWorkoutId].filter(value => value?.trim());
    if (activityClaims.some(claim => claim !== activity.id) || new Set(workoutClaims).size > 1) {
      throw new Error('This Health workout contains contradictory activity or workout identities. Nothing was replaced.');
    }
    if (link.metadata.workoutUuid !== incoming.workoutUuid || link.metadata.sourceBundleIdentifier !== incoming.sourceBundleIdentifier
      || link.metadata.originalStartTime !== incoming.startTime || link.metadata.originalEndTime !== incoming.endTime) {
      throw new Error('The selected Health link does not match its distance evidence. Nothing was replaced.');
    }
    if (!supportsHealthSplitRefresh(activity) || link.activityType !== activity.activityType) {
      throw new Error('This Health workout is not compatible with the recorded activity. Nothing was replaced.');
    }
    const claims = [activity.workoutInstanceId, health?.workoutInstanceId, link.metadata.workoutInstanceId, workoutInstanceId].filter(value => value?.trim());
    if (new Set(claims).size > 1) throw new Error('This workout has conflicting recording identities. Nothing was replaced.');
    const exactInstance = Boolean(activity.workoutInstanceId && activity.workoutInstanceId === link.metadata.workoutInstanceId);
    const exactActivity = link.metadata.strideOSActivityId === activity.id;
    const exactWorkout = Boolean(activity.legacyWorkoutId && link.metadata.strideOSWorkoutId === activity.legacyWorkoutId);
    if (!exactInstance && !exactActivity && !exactWorkout) {
      throw new Error('This Health workout does not contain an exact StrideOS recording identity for this activity. No link was made; dates and distance are not used to guess.');
    }
    health ??= link.metadata;
  }
  if (!health || health.workoutUuid !== incoming.workoutUuid || health.sourceBundleIdentifier !== incoming.sourceBundleIdentifier
    || health.originalStartTime !== incoming.startTime || health.originalEndTime !== incoming.endTime) {
    throw new Error('The Health workout no longer matches this activity. Nothing was replaced.');
  }
  const claims = [activity.workoutInstanceId, health.workoutInstanceId, workoutInstanceId].filter(value => value?.trim());
  if (new Set(claims).size > 1) throw new Error('This workout has conflicting recording identities. Nothing was replaced.');
  if (!incoming.samples.length) throw new Error('Apple Health did not return workout distance samples. Existing data was kept.');
  const previous = activity.metrics.healthKitDistance;
  if (previous) {
    if (previous.workoutUuid !== incoming.workoutUuid || previous.sourceBundleIdentifier !== incoming.sourceBundleIdentifier) {
      throw new Error('Saved distance evidence belongs to a different Health workout. Nothing was replaced.');
    }
    const upgradesScope = previous.version === 1 && incoming.version === 2;
    if (!hasSupportedHealthDistanceScope(previous) || (previous.version !== incoming.version && !upgradesScope)
      || previous.startTime !== incoming.startTime || previous.endTime !== incoming.endTime
      || previous.durationSeconds !== incoming.durationSeconds
      || previous.totalDistanceMeters != null && previous.totalDistanceMeters !== incoming.totalDistanceMeters) {
      throw new Error('Apple Health workout totals or time context changed. Existing distance evidence was kept.');
    }
    if (incoming.retrievedAt < previous.retrievedAt) throw new Error('A newer Health refresh is already saved. Existing data was kept.');
    for (const prior of previous.samples) {
      const sample = nextSamples.get(prior.id);
      if (!sample || !sameSample(sample, prior)) {
        throw new Error('Apple Health returned less or conflicting distance evidence. Existing data was kept.');
      }
    }
    if (previous.recordingPauses.length && JSON.stringify(previous.recordingPauses) !== JSON.stringify(incoming.recordingPauses)) {
      throw new Error('Apple Health pause evidence changed. Existing data was kept.');
    }
    for (const units of ['metric', 'imperial'] as const) {
      if (buildHealthDistanceSplits(activity, units)?.status === 'complete'
        && buildHealthDistanceSplits({ ...activity, healthKit: health, metrics: { ...activity.metrics, healthKitDistance: incoming } }, units)?.status !== 'complete') {
        throw new Error('New Health distance data would make saved splits unavailable. Existing evidence was kept.');
      }
    }
  }
  return { ...activity, ...(activity.healthKit ? {} : { healthKit: health }), metrics: { ...activity.metrics, healthKitDistance: incoming }, updatedAt: Date.now() };
}
