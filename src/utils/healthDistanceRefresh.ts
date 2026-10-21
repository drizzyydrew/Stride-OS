import type { Activity, HealthKitDistanceEvidence } from '../types/activity';

/** Refresh analysis evidence only; athlete-entered summaries and recording data remain untouched. */
export function mergeHealthDistanceEvidence(activity: Activity, incoming: HealthKitDistanceEvidence,
  workoutInstanceId?: string): Activity {
  const health = activity.healthKit;
  if (incoming.version !== 1 || !Number.isFinite(incoming.retrievedAt) || incoming.samples.length > 100_000
    || JSON.stringify(incoming).length > 16_000_000) throw new Error('Health distance evidence cannot be saved safely. Existing data was kept.');
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
    if (previous.version !== incoming.version || previous.startTime !== incoming.startTime || previous.endTime !== incoming.endTime
      || previous.durationSeconds !== incoming.durationSeconds
      || previous.totalDistanceMeters != null && previous.totalDistanceMeters !== incoming.totalDistanceMeters) {
      throw new Error('Apple Health workout totals or time context changed. Existing distance evidence was kept.');
    }
    if (incoming.retrievedAt < previous.retrievedAt) throw new Error('A newer Health refresh is already saved. Existing data was kept.');
    const next = new Map(incoming.samples.map(sample => [sample.id, sample]));
    for (const prior of previous.samples) {
      const sample = next.get(prior.id);
      if (!sample || JSON.stringify(sample) !== JSON.stringify(prior)) {
        throw new Error('Apple Health returned less or conflicting distance evidence. Existing data was kept.');
      }
    }
    if (previous.recordingPauses.length && JSON.stringify(previous.recordingPauses) !== JSON.stringify(incoming.recordingPauses)) {
      throw new Error('Apple Health pause evidence changed. Existing data was kept.');
    }
  }
  return { ...activity, metrics: { ...activity.metrics, healthKitDistance: incoming }, updatedAt: Date.now() };
}
