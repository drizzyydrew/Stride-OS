import type { Activity, ActivityCoordinate } from '../types/activity';
import type { UnitSystem } from '../store/settingsStore';
import { distanceMeters, MAX_SPEED_MPS } from './activityTracking';
import { formatPaceSecPerMile, formatSpeedMps } from '../lib/units';
import { isOutdoorSport, OUTDOOR_SPORTS } from './outdoorSports';

export type RouteObservation = {
  point: ActivityCoordinate;
  distanceMeters: number;
  elapsedSeconds: number;
  activeSeconds: number;
  segmentMeters: number;
  segmentSeconds: number;
  continuous: boolean;
  speedMps?: number;
  grade?: number;
  gradeRejected?: boolean;
};

export function pausedSeconds(activity: Activity, start: number, end: number): number {
  const spans = (activity.metrics.recordingPauses ?? [])
    .map(pause => ({ start: Math.max(start, pause.startTime), end: Math.min(end, pause.endTime) }))
    .filter(pause => Number.isFinite(pause.start) && Number.isFinite(pause.end) && pause.end > pause.start)
    .sort((a, b) => a.start - b.start);
  let coveredUntil = start;
  let ms = 0;
  for (const span of spans) {
    ms += Math.max(0, span.end - Math.max(coveredUntil, span.start));
    coveredUntil = Math.max(coveredUntil, span.end);
  }
  return ms / 1000;
}

export function validRecordedRoutePoints(activity: Activity): ActivityCoordinate[] {
  return (activity.metrics.routeCoordinates ?? []).filter(point =>
    [point.latitude, point.longitude, point.timestamp].every(Number.isFinite)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
    && point.timestamp > 0 && point.timestamp >= activity.startTime
    && (activity.endTime == null || point.timestamp <= activity.endTime)
    && (point.horizontalAccuracyMeters == null || Number.isFinite(point.horizontalAccuracyMeters) && point.horizontalAccuracyMeters >= 0 && point.horizontalAccuracyMeters <= 65),
  ).slice().sort((a, b) => a.timestamp - b.timestamp);
}

export function buildRouteObservations(activity: Activity): RouteObservation[] {
  if (activity.indoor || !isOutdoorSport(activity.activityType) || ['indoor', 'treadmill', 'stationary'].includes(activity.subtype ?? '')) return [];
  const points = validRecordedRoutePoints(activity);
  const output: RouteObservation[] = [];
  let cumulative = 0;
  const startedAt = activity.startTime || points[0]?.timestamp || 0;
  for (const point of points) {
    const prior = output.at(-1);
    if (prior && point.timestamp <= prior.point.timestamp) continue;
    const seconds = prior ? (point.timestamp - prior.point.timestamp) / 1000 : 0;
    const meters = prior ? distanceMeters(prior.point, point) : 0;
    const pause = prior ? pausedSeconds(activity, prior.point.timestamp, point.timestamp) : 0;
    const continuous = Boolean(prior && seconds > 0 && seconds <= 30 && pause === 0
      && meters / seconds <= (MAX_SPEED_MPS[activity.activityType] ?? 12));
    if (continuous) cumulative += meters;
    let grade: number | undefined;
    let gradeRejected = false;
    // Use at least 20m of continuous observations, not one noisy altitude fix.
    if (continuous && Number.isFinite(point.altitudeMeters)) {
      for (let index = output.length - 1; index >= 0; index -= 1) {
        const anchor = output[index]!;
        if (cumulative - anchor.distanceMeters >= 20) {
          if (Number.isFinite(anchor.point.altitudeMeters)) {
            const estimate = (point.altitudeMeters! - anchor.point.altitudeMeters!) / (cumulative - anchor.distanceMeters);
            if (Math.abs(estimate) <= 0.8) grade = estimate;
            else gradeRejected = true;
          }
          break;
        }
        if (!anchor.continuous) break;
      }
    }
    output.push({
      point,
      distanceMeters: cumulative,
      elapsedSeconds: Math.max(0, (point.timestamp - startedAt) / 1000),
      activeSeconds: Math.max(0, (point.timestamp - startedAt) / 1000 - pausedSeconds(activity, startedAt, point.timestamp)),
      segmentMeters: continuous ? meters : 0,
      segmentSeconds: continuous ? seconds : 0,
      continuous,
      speedMps: continuous ? meters / seconds : undefined,
      grade,
      gradeRejected,
    });
  }
  return output;
}

export function buildRouteReviewObservations(activity: Activity): RouteObservation[] {
  const observations = buildRouteObservations(activity);
  const impossibleJump = (from: RouteObservation, to: RouteObservation) => {
    const seconds = (to.point.timestamp - from.point.timestamp) / 1000;
    return seconds > 0 && seconds <= 30
      && pausedSeconds(activity, from.point.timestamp, to.point.timestamp) === 0
      && distanceMeters(from.point, to.point) / seconds > (MAX_SPEED_MPS[activity.activityType] ?? 12);
  };
  return observations.filter((point, index) => {
    const previous = observations[index - 1];
    const next = observations[index + 1];
    if (point.continuous || next?.continuous) return true;
    // Hide only isolated impossible fixes. A gap relocation may start a valid
    // new segment; retain it and the original continuity flags, never bridge it.
    return !((previous || next)
      && (!previous || impossibleJump(previous, point))
      && (!next || impossibleJump(point, next)));
  });
}

type RecordingPauses = NonNullable<Activity['metrics']['recordingPauses']>;

function validPause(pause: RecordingPauses[number]): boolean {
  return Number.isFinite(pause.startTime) && Number.isFinite(pause.endTime) && pause.endTime > pause.startTime;
}

export function sampleAtTime<T extends { timestamp: number }>(samples: readonly T[] | undefined, timestamp: number, maximumAgeMs = 30_000, pauses: readonly RecordingPauses[number][] = []): T | undefined {
  let best: T | undefined;
  for (const sample of samples ?? []) {
    if (Number.isFinite(sample.timestamp) && sample.timestamp <= timestamp
      && timestamp - sample.timestamp <= maximumAgeMs
      && !pauses.some(pause => validPause(pause) && pause.startTime <= timestamp && pause.endTime > sample.timestamp)
      && (!best || sample.timestamp > best.timestamp)) best = sample;
  }
  return best;
}

export function routeObservationAtFraction(points: RouteObservation[], fraction: number): RouteObservation | undefined {
  if (!points.length) return undefined;
  const target = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)) * points.at(-1)!.distanceMeters;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid]!.distanceMeters < target) low = mid + 1;
    else high = mid;
  }
  return points[low];
}

export function weightedSensorMean<T extends { timestamp: number }>(samples: readonly T[] | undefined, value: (sample: T) => number, startedAt: number, endedAt: number, pauses: Activity['metrics']['recordingPauses'] = []): { mean?: number; coverageSeconds: number } {
  const ordered = (samples ?? []).filter(sample => Number.isFinite(sample.timestamp) && Number.isFinite(value(sample)) && value(sample) >= 0)
    .slice().sort((a, b) => a.timestamp - b.timestamp);
  let total = 0;
  let covered = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    const sample = ordered[index]!;
    const from = Math.max(startedAt, sample.timestamp);
    let until = Math.min(endedAt, sample.timestamp + 10_000, ordered[index + 1]?.timestamp ?? endedAt);
    // A pause expires an observation; resuming cannot revive a pre-pause value.
    for (const pause of pauses) {
      if (validPause(pause) && pause.endTime > sample.timestamp) until = Math.min(until, Math.max(sample.timestamp, pause.startTime));
    }
    const seconds = Math.max(0, (until - from) / 1000);
    total += value(sample) * seconds;
    covered += seconds;
  }
  return { mean: covered > 0 ? total / covered : undefined, coverageSeconds: covered };
}

export type OutdoorSplit = { index: number; distanceMeters: number; seconds: number; paceLabel: string; averageHeartRateBpm?: number; complete: boolean; reliable: boolean };
export function buildOutdoorSplits(activity: Activity, units: UnitSystem): OutdoorSplit[] {
  const route = buildRouteObservations(activity);
  const unitMeters = units === 'metric' ? 1000 : 1609.344;
  const speedBased = isOutdoorSport(activity.activityType) && OUTDOOR_SPORTS[activity.activityType].speedBased;
  const result: OutdoorSplit[] = [];
  let startDistance = 0;
  let startTime = route[0]?.point.timestamp ?? 0;
  let startActive = route[0]?.activeSeconds ?? 0;
  let boundary = unitMeters;
  let reliable = true;
  const emit = (endDistance: number, endTime: number, endActive: number, complete: boolean) => {
    const meters = endDistance - startDistance;
    const seconds = endActive - startActive;
    if (meters <= 0 || seconds <= 0) return;
    const hr = weightedSensorMean(activity.metrics.rawHeartRateSamples, sample => sample.bpm, startTime, endTime, activity.metrics.recordingPauses);
    result.push({
      index: result.length + 1, distanceMeters: meters, seconds, complete, reliable,
      paceLabel: !reliable ? 'GPS gap' : speedBased ? formatSpeedMps(meters / seconds, units) : formatPaceSecPerMile(seconds / meters * 1609.344, units),
      averageHeartRateBpm: hr.coverageSeconds >= seconds * 0.5 && hr.mean != null ? Math.round(hr.mean) : undefined,
    });
    startDistance = endDistance; startTime = endTime; startActive = endActive;
  };
  for (let index = 1; index < route.length; index += 1) {
    const current = route[index]!;
    const previous = route[index - 1]!;
    if (!current.continuous) { reliable = false; continue; }
    while (current.distanceMeters >= boundary) {
      const fraction = (boundary - previous.distanceMeters) / Math.max(0.001, current.segmentMeters);
      emit(boundary, previous.point.timestamp + fraction * (current.point.timestamp - previous.point.timestamp), previous.activeSeconds + fraction * current.segmentSeconds, true);
      boundary += unitMeters;
      reliable = true;
    }
  }
  const last = route.at(-1);
  if (last && last.distanceMeters - startDistance >= unitMeters * 0.05) emit(last.distanceMeters, last.point.timestamp, last.activeSeconds, false);
  return result;
}

export type SnowSegment = { id: string; kind: 'descent' | 'ascent'; startTime: number; endTime: number; distanceMeters: number; elevationMeters: number };
export function analyzeSnowSegments(activity: Activity): SnowSegment[] {
  if (!['downhill_skiing', 'snowboarding', 'cross_country_skiing', 'ski_touring', 'snowboard_touring'].includes(activity.activityType)) return [];
  const route = buildRouteObservations(activity);
  const segments: SnowSegment[] = [];
  let candidate: SnowSegment | undefined;
  let transitionMeters = 0;
  let transitionSeconds = 0;
  const flush = () => {
    if (candidate && candidate.distanceMeters >= 80 && candidate.elevationMeters >= 15 && candidate.endTime - candidate.startTime >= 15_000) segments.push(candidate);
    candidate = undefined;
    transitionMeters = 0;
    transitionSeconds = 0;
  };
  for (let index = 1; index < route.length; index += 1) {
    const current = route[index]!;
    const previous = route[index - 1]!;
    if (!current.continuous || current.grade == null || !Number.isFinite(previous.point.altitudeMeters) || !Number.isFinite(current.point.altitudeMeters)) { flush(); continue; }
    const kind = current.grade < -0.025 ? 'descent' : current.grade > 0.025 ? 'ascent' : null;
    if (!kind) {
      if (candidate) {
        transitionMeters += current.segmentMeters;
        transitionSeconds += current.segmentSeconds;
        if (transitionSeconds > 10 || transitionMeters > 20) flush();
      }
      continue;
    }
    const bridgedMeters = candidate?.kind === kind ? transitionMeters : 0;
    if (candidate?.kind !== kind) {
      flush();
      candidate = { id: `${previous.point.timestamp}:${kind}`, kind, startTime: previous.point.timestamp, endTime: current.point.timestamp, distanceMeters: 0, elevationMeters: 0 };
    }
    candidate!.endTime = current.point.timestamp;
    candidate!.distanceMeters += current.segmentMeters + bridgedMeters;
    candidate!.elevationMeters += Math.max(0, (kind === 'descent' ? -1 : 1) * (current.point.altitudeMeters! - previous.point.altitudeMeters!));
    transitionMeters = 0;
    transitionSeconds = 0;
  }
  flush();
  const merged: SnowSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    const between = previous ? route.filter(point => point.point.timestamp > previous.endTime && point.point.timestamp <= segment.startTime) : [];
    const bridgeMeters = between.reduce((sum, point) => sum + point.segmentMeters, 0);
    const hasRecordingGap = between.some(point => !point.continuous || point.grade == null);
    if (previous && previous.kind === segment.kind && segment.startTime - previous.endTime <= 10_000 && bridgeMeters <= 20 && !hasRecordingGap) {
      previous.endTime = segment.endTime;
      previous.distanceMeters += segment.distanceMeters + bridgeMeters;
      previous.elevationMeters += segment.elevationMeters;
    } else merged.push({ ...segment });
  }
  return merged;
}
