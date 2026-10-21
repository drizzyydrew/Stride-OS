import type { Activity, HealthKitDistanceEvidence } from '../types/activity';
import type { UnitSystem } from '../store/settingsStore';
import { formatPaceSecPerMile, formatSpeedMps } from '../lib/units';
import { weightedSensorMean, type OutdoorSplit } from './outdoorAnalysis';
import { isOutdoorSport, OUTDOOR_SPORTS } from './outdoorSports';

export type HealthDistanceSplit = OutdoorSplit & {
  /** Maximum endpoint-time error from unknown allocation within its interval, not a confidence interval. */
  boundaryUncertaintySeconds: number;
  /** Sum of the start/end allocation bounds; excludes sensor error and summary rounding. */
  durationUncertaintySeconds: number;
};

export type HealthDistanceSplitsResult = {
  status: 'complete' | 'partial' | 'unavailable';
  reason?: string;
  splits: HealthDistanceSplit[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_INTERVAL_MS = 30_000;
const DURATION_TOLERANCE_MS = 2_000;
const DISTANCE_EPSILON_M = 1e-7;
const MAX_SPLITS = 10_000;

function withheld(status: 'partial' | 'unavailable', reason: string): HealthDistanceSplitsResult {
  return { status, reason, splits: [] };
}

/**
 * Undefined alone permits the caller's legacy path; present evidence never uses GPS.
 * Complete means accepted interval coverage, not official Apple split timing.
 * Boundary times are linear estimates and must be labeled Health distance-derived.
 */
export function buildHealthDistanceSplits(activity: Activity, units: UnitSystem): HealthDistanceSplitsResult | undefined {
  const evidence = activity.metrics.healthKitDistance;
  if (evidence === undefined) return undefined;
  const link = activity.healthKit;
  if (evidence && (evidence.version !== 1 || !Number.isFinite(evidence.retrievedAt) || evidence.retrievedAt <= 0)) {
    return withheld('unavailable', 'Health distance evidence has an unsupported version or invalid retrieval provenance.');
  }
  if (!evidence || !link || !UUID.test(evidence.workoutUuid)
    || evidence.workoutUuid !== link.workoutUuid
    || typeof evidence.sourceBundleIdentifier !== 'string' || !evidence.sourceBundleIdentifier.trim()
    || evidence.sourceBundleIdentifier === 'unknown'
    || evidence.sourceBundleIdentifier !== link.sourceBundleIdentifier) {
    return withheld('unavailable', 'Health distance evidence does not match the linked workout and source.');
  }
  if (!Number.isFinite(evidence.startTime) || evidence.startTime <= 0
    || !Number.isFinite(evidence.endTime) || evidence.endTime <= evidence.startTime
    || evidence.startTime !== link.originalStartTime || evidence.endTime !== link.originalEndTime
    || !Number.isFinite(evidence.durationSeconds) || evidence.durationSeconds <= 0) {
    return withheld('unavailable', 'Health distance evidence has an invalid or mismatched workout time range.');
  }
  const total = evidence.totalDistanceMeters;
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
    return withheld('unavailable', 'The original Health workout distance total is unavailable.');
  }
  if (!Array.isArray(evidence.samples) || !evidence.samples.length || !Array.isArray(evidence.recordingPauses)) {
    return withheld('unavailable', 'Health distance interval or pause evidence is unavailable.');
  }

  const byId = new Map<string, HealthKitDistanceEvidence['samples'][number]>();
  for (const sample of evidence.samples) {
    if (sample && sample.sourceBundleIdentifier !== evidence.sourceBundleIdentifier) {
      return withheld('partial', 'Health distance contains a sample from a different or unknown source.');
    }
    if (!sample || typeof sample.id !== 'string' || !sample.id.trim()
      || !Number.isFinite(sample.startTime) || !Number.isFinite(sample.endTime)
      || sample.startTime < evidence.startTime || sample.endTime > evidence.endTime
      || sample.endTime <= sample.startTime
      || !Number.isFinite(sample.distanceMeters) || sample.distanceMeters < 0) {
      return withheld('partial', 'Health distance contains an invalid interval; no splits were calculated.');
    }
    if (sample.endTime - sample.startTime > MAX_INTERVAL_MS) {
      return withheld('partial', 'Apple Health exposed distance intervals coarser than this build\'s 30-second resolution limit. Finer-grained distance data is unavailable to this build; split paces were not calculated.');
    }
    const previous = byId.get(sample.id);
    if (previous && (previous.startTime !== sample.startTime || previous.endTime !== sample.endTime
      || previous.distanceMeters !== sample.distanceMeters)) {
      return withheld('partial', 'Health distance contains conflicting duplicate sample identifiers.');
    }
    byId.set(sample.id, sample);
  }
  const samples = [...byId.values()].sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
  const pauses: HealthKitDistanceEvidence['recordingPauses'] = [];
  for (const pause of evidence.recordingPauses) {
    if (!pause || !Number.isFinite(pause.startTime) || !Number.isFinite(pause.endTime)
      || pause.startTime < evidence.startTime || pause.endTime > evidence.endTime
      || pause.endTime <= pause.startTime) {
      return withheld('partial', 'Health distance contains an invalid recording pause.');
    }
  }
  for (const pause of [...evidence.recordingPauses].sort((a, b) => a.startTime - b.startTime)) {
    const previous = pauses.at(-1);
    if (previous && pause.startTime <= previous.endTime) previous.endTime = Math.max(previous.endTime, pause.endTime);
    else pauses.push({ ...pause });
  }

  // Only confirmed pauses may explain missing time. Even a small unmeasured gap
  // makes the subsequent cumulative distance offset unknown; never skip it.
  const spans = [...samples, ...pauses].sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
  let coveredUntil = evidence.startTime;
  for (const span of spans) {
    if (span.startTime < coveredUntil) {
      return withheld('partial', 'Health distance intervals overlap each other or a recording pause.');
    }
    if (span.startTime > coveredUntil) return withheld('partial', 'Health distance has an unmeasured time gap.');
    coveredUntil = span.endTime;
  }
  if (coveredUntil !== evidence.endTime) return withheld('partial', 'Health distance has an unmeasured time gap.');
  const activeMs = samples.reduce((sum, sample) => sum + sample.endTime - sample.startTime, 0);
  if (!Number.isFinite(activeMs) || Math.abs(activeMs - evidence.durationSeconds * 1000) > DURATION_TOLERANCE_MS) {
    return withheld('partial', 'Health distance coverage does not match the workout active duration and pauses.');
  }
  const measuredMeters = samples.reduce((sum, sample) => sum + sample.distanceMeters, 0);
  // At most a 5m floor or 0.05% relative discrepancy; never rescale either total.
  const distanceTolerance = Math.max(5, total * 0.0005);
  if (!Number.isFinite(measuredMeters) || Math.abs(measuredMeters - total) > distanceTolerance
    || (measuredMeters === 0) !== (total === 0)) {
    return withheld('partial', 'Health distance intervals do not match the original workout distance total.');
  }
  if (measuredMeters === 0) return { status: 'complete', splits: [] };
  const unitMeters = units === 'metric' ? 1000 : 1609.344;
  if (Math.ceil(measuredMeters / unitMeters) > MAX_SPLITS) {
    return withheld('partial', 'Health distance exceeds the supported split calculation size.');
  }
  const speedBased = isOutdoorSport(activity.activityType) && OUTDOOR_SPORTS[activity.activityType].speedBased;
  const splits: HealthDistanceSplit[] = [];
  let cumulativeMeters = 0;
  let cumulativeActiveMs = 0;
  let splitStartMeters = 0;
  let splitStartTime = evidence.startTime;
  let splitStartActiveMs = 0;
  let startUncertaintySeconds = 0;
  let boundary = unitMeters;
  const emit = (endMeters: number, endTime: number, endActiveMs: number, complete: boolean, uncertaintySeconds = 0) => {
    const meters = endMeters - splitStartMeters;
    const seconds = (endActiveMs - splitStartActiveMs) / 1000;
    if (!(meters > 0 && seconds > 0) || !Number.isFinite(seconds)) return false;
    const hr = weightedSensorMean(activity.metrics.rawHeartRateSamples, sample => sample.bpm,
      splitStartTime, endTime, pauses);
    splits.push({ index: splits.length + 1, distanceMeters: meters, seconds, complete, reliable: true,
      boundaryUncertaintySeconds: uncertaintySeconds,
      durationUncertaintySeconds: startUncertaintySeconds + uncertaintySeconds,
      paceLabel: speedBased ? formatSpeedMps(meters / seconds, units)
        : formatPaceSecPerMile(seconds / meters * 1609.344, units),
      averageHeartRateBpm: hr.coverageSeconds >= seconds * 0.5 && hr.mean != null ? Math.round(hr.mean) : undefined });
    splitStartMeters = endMeters;
    splitStartTime = endTime;
    splitStartActiveMs = endActiveMs;
    startUncertaintySeconds = uncertaintySeconds;
    return true;
  };
  for (const sample of samples) {
    const intervalMs = sample.endTime - sample.startTime;
    const endMeters = cumulativeMeters + sample.distanceMeters;
    // Emit the final distance only at workout end, retaining trailing explicit
    // zero-distance active time even when the workout ends on a whole mile/km.
    while (sample.distanceMeters > 0 && boundary < measuredMeters - DISTANCE_EPSILON_M
      && boundary <= endMeters + DISTANCE_EPSILON_M) {
      const fraction = Math.max(0, Math.min(1, (boundary - cumulativeMeters) / sample.distanceMeters));
      const uncertaintySeconds = fraction === 0 || fraction === 1 ? 0 : Math.max(fraction, 1 - fraction) * intervalMs / 1000;
      if (!emit(boundary, sample.startTime + fraction * intervalMs, cumulativeActiveMs + fraction * intervalMs, true, uncertaintySeconds)) {
        return withheld('partial', 'Health distance could not establish a positive split duration.');
      }
      boundary += unitMeters;
    }
    cumulativeMeters = endMeters;
    cumulativeActiveMs += intervalMs;
  }
  if (!emit(measuredMeters, evidence.endTime, activeMs,
    Math.abs(measuredMeters - splitStartMeters - unitMeters) <= DISTANCE_EPSILON_M)) {
    return withheld('partial', 'Health distance could not establish a positive split duration.');
  }
  return { status: 'complete', splits };
}
