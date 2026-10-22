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

const READ_FAILURES = {
  DISTANCE_QUERY_FAILED: 'Distance samples for the selected workout could not be read. Retry the same selection.',
  DISTANCE_SAMPLE_LIMIT: 'Workout distance data exceeds the safe import size.',
  DISTANCE_INTERVAL_INVALID: 'A distance interval has a missing identifier, invalid measurement or invalid time.',
  DISTANCE_INTERVAL_RANGE: 'A distance interval falls outside the selected workout. No interval was trimmed or estimated.',
  DISTANCE_SAMPLE_CONFLICT: 'Workout distance samples have conflicting identifiers.',
  PAUSE_TYPES_UNAVAILABLE: 'Workout pause events are not supported by this build.',
  PAUSE_TIME_INVALID: 'A workout pause or resume time is invalid or outside the selected workout.',
} as const;

/** Fixed diagnostics only: native errors may contain private Health payloads. */
export class HealthDistanceReadError extends Error {
  constructor(readonly code: keyof typeof READ_FAILURES) {
    super(`Apple Health distance could not be read safely (metrics). [${code}] ${READ_FAILURES[code]} Your saved activity has not been changed.`);
    this.name = 'HealthDistanceReadError';
  }
}

/** Decode only the source's non-manual samples already scoped to the native workout. */
export function decodeHealthDistanceEvidence(raw: readonly RawSample[], workout: Context,
  events: readonly Event[], eventTypes?: EventTypes): HealthKitDistanceEvidence {
  if (raw.length > 100_000) throw new HealthDistanceReadError('DISTANCE_SAMPLE_LIMIT');
  const samples = new Map<string, HealthKitDistanceEvidence['samples'][number]>();
  for (const sample of raw) {
    if (sample.sourceRevision?.source?.bundleIdentifier !== workout.sourceBundleIdentifier || sample.metadata?.HKWasUserEntered === true) continue;
    const startTime = ms(sample.startDate), endTime = ms(sample.endDate);
    const distanceMeters = sample.quantity ?? sample.value;
    if (!sample.uuid || typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters < 0
      || !Number.isFinite(startTime) || !Number.isFinite(endTime)
      || endTime <= startTime) throw new HealthDistanceReadError('DISTANCE_INTERVAL_INVALID');
    if (startTime < workout.startTime || endTime > workout.endTime) throw new HealthDistanceReadError('DISTANCE_INTERVAL_RANGE');
    const next = { id: sample.uuid, sourceBundleIdentifier: workout.sourceBundleIdentifier, startTime, endTime, distanceMeters };
    const prior = samples.get(sample.uuid);
    if (prior && JSON.stringify(prior) !== JSON.stringify(next)) throw new HealthDistanceReadError('DISTANCE_SAMPLE_CONFLICT');
    samples.set(sample.uuid, next);
  }
  const recordingPauses: HealthKitDistanceEvidence['recordingPauses'] = [];
  if (events.length && !eventTypes) throw new HealthDistanceReadError('PAUSE_TYPES_UNAVAILABLE');
  let pausedAt: number | undefined;
  for (const event of [...events].sort((a, b) => ms(a.startDate) - ms(b.startDate))) {
    if (!eventTypes) break;
    const timestamp = ms(event.startDate);
    const pausing = event.type === eventTypes.pause || event.type === eventTypes.motionPaused;
    const resuming = event.type === eventTypes.resume || event.type === eventTypes.motionResumed;
    if (!pausing && !resuming) continue;
    if (!Number.isFinite(timestamp) || timestamp < workout.startTime || timestamp > workout.endTime) throw new HealthDistanceReadError('PAUSE_TIME_INVALID');
    if (pausing) pausedAt ??= timestamp;
    if (resuming) {
      // HealthKit starts active and ignores redundant resumes, just as it does pauses.
      if (pausedAt == null) continue;
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
