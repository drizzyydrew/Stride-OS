import type { HealthKitDistanceEvidence } from '../types/activity';

type RawSample = {
  uuid?: string;
  quantity?: number;
  value?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  sourceRevision?: { source?: { bundleIdentifier?: string } };
  metadata?: Record<string, unknown>;
};
type Context = Pick<HealthKitDistanceEvidence, 'startTime' | 'endTime' | 'durationSeconds'> & {
  uuid: string; sourceBundleIdentifier: string; distanceMeters?: number;
};
type Event = { type: number; startDate: Date | string; endDate: Date | string };
type EventTypes = { pause: number; resume: number; motionPaused: number; motionResumed: number };
const ms = (date: Date | string | undefined) => date instanceof Date ? date.getTime() : Date.parse(date ?? '');

/** Decode only the source's non-manual samples already scoped to the native workout. */
export function decodeHealthDistanceEvidence(raw: readonly RawSample[], workout: Context,
  events: readonly Event[], eventTypes?: EventTypes): HealthKitDistanceEvidence {
  if (raw.length > 100_000) throw new Error('Workout distance data exceeds the safe import size.');
  const samples = new Map<string, HealthKitDistanceEvidence['samples'][number]>();
  for (const sample of raw) {
    if (sample.sourceRevision?.source?.bundleIdentifier !== workout.sourceBundleIdentifier || sample.metadata?.HKWasUserEntered === true) continue;
    const startTime = ms(sample.startDate), endTime = ms(sample.endDate);
    const distanceMeters = sample.quantity ?? sample.value;
    if (!sample.uuid || typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters < 0
      || !Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < workout.startTime
      || endTime > workout.endTime || endTime <= startTime) throw new Error('Workout distance intervals could not be read safely.');
    const next = { id: sample.uuid, sourceBundleIdentifier: workout.sourceBundleIdentifier, startTime, endTime, distanceMeters };
    const prior = samples.get(sample.uuid);
    if (prior && JSON.stringify(prior) !== JSON.stringify(next)) throw new Error('Workout distance samples have conflicting identifiers.');
    samples.set(sample.uuid, next);
  }
  const recordingPauses: HealthKitDistanceEvidence['recordingPauses'] = [];
  if (events.length && !eventTypes) throw new Error('Workout pause events are not supported by this build.');
  let pausedAt: number | undefined;
  for (const event of [...events].sort((a, b) => ms(a.startDate) - ms(b.startDate))) {
    if (!eventTypes) break;
    const timestamp = ms(event.startDate);
    const pausing = event.type === eventTypes.pause || event.type === eventTypes.motionPaused;
    const resuming = event.type === eventTypes.resume || event.type === eventTypes.motionResumed;
    if (!pausing && !resuming) continue;
    if (!Number.isFinite(timestamp) || timestamp < workout.startTime || timestamp > workout.endTime) throw new Error('Workout pause time is invalid.');
    if (pausing) pausedAt ??= timestamp;
    if (resuming) {
      if (pausedAt == null) throw new Error('Workout pause events are incomplete.');
      if (timestamp > pausedAt) recordingPauses.push({ startTime: pausedAt, endTime: timestamp });
      pausedAt = undefined;
    }
  }
  if (pausedAt != null && pausedAt < workout.endTime) recordingPauses.push({ startTime: pausedAt, endTime: workout.endTime });
  return { version: 1, retrievedAt: Date.now(), workoutUuid: workout.uuid, sourceBundleIdentifier: workout.sourceBundleIdentifier,
    startTime: workout.startTime, endTime: workout.endTime, durationSeconds: workout.durationSeconds,
    totalDistanceMeters: workout.distanceMeters,
    samples: [...samples.values()].sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime), recordingPauses };
}
