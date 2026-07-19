import type { ActivityType, RunWalkInterval } from '../types/activity';

export type TrackPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
};

export type TrackingAggregate = {
  points: TrackPoint[];
  distanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  currentMetersPerSecond: number;
  averageMetersPerSecond: number;
  maximumMetersPerSecond: number;
};

export type IntervalCue = {
  kind: 'warning' | 'transition' | 'complete';
  text: string;
  intervalIndex: number;
};

export type EffortCueState = {
  consecutiveHighSamples: number;
  consecutiveLowSamples?: number;
  wasOutOfRange?: boolean;
  lastCueElapsedSeconds: number;
};

const MAX_SPEED_MPS: Partial<Record<ActivityType, number>> = {
  running: 9,
  walking: 4,
  hiking: 4.5,
  cycling: 28,
  downhill_skiing: 45,
  cross_country_skiing: 16,
  snowboarding: 45,
};

const MIN_DISTANCE_METERS = 2.5;
const ELEVATION_NOISE_METERS = 2;

function radians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceMeters(a: TrackPoint, b: TrackPoint): number {
  const radius = 6_371_000;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const chord = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

export function appendTrackingPoint(
  aggregate: TrackingAggregate,
  point: TrackPoint,
  activityType: ActivityType,
  activeSeconds: number,
): TrackingAggregate {
  if ((point.accuracyMeters ?? 0) > 65) return aggregate;
  const previous = aggregate.points.at(-1);
  if (previous && point.timestamp <= previous.timestamp) return aggregate;
  if (!previous) return { ...aggregate, points: [point] };

  const seconds = (point.timestamp - previous.timestamp) / 1000;
  const delta = distanceMeters(previous, point);
  const speed = seconds > 0 ? delta / seconds : 0;
  if (speed > (MAX_SPEED_MPS[activityType] ?? 12)) return aggregate;

  const acceptedDistance = delta >= MIN_DISTANCE_METERS ? delta : 0;
  let elevationGainMeters = aggregate.elevationGainMeters;
  let elevationLossMeters = aggregate.elevationLossMeters;
  if (point.altitudeMeters != null && previous.altitudeMeters != null) {
    const altitudeDelta = point.altitudeMeters - previous.altitudeMeters;
    if (altitudeDelta >= ELEVATION_NOISE_METERS) elevationGainMeters += altitudeDelta;
    if (altitudeDelta <= -ELEVATION_NOISE_METERS) elevationLossMeters += -altitudeDelta;
  }

  const distance = aggregate.distanceMeters + acceptedDistance;
  return {
    points: [...aggregate.points, point],
    distanceMeters: distance,
    elevationGainMeters,
    elevationLossMeters,
    currentMetersPerSecond: acceptedDistance > 0 ? speed : aggregate.currentMetersPerSecond,
    averageMetersPerSecond: activeSeconds > 0 ? distance / activeSeconds : 0,
    maximumMetersPerSecond: Math.max(aggregate.maximumMetersPerSecond, speed),
  };
}

export function intervalAtElapsed(
  intervals: RunWalkInterval[],
  elapsedSeconds: number,
): { index: number; intervalElapsed: number; intervalRemaining: number; complete: boolean } {
  let cursor = 0;
  for (let index = 0; index < intervals.length; index += 1) {
    const end = cursor + intervals[index].durationSeconds;
    if (elapsedSeconds < end) {
      return {
        index,
        intervalElapsed: Math.max(0, elapsedSeconds - cursor),
        intervalRemaining: Math.max(0, end - elapsedSeconds),
        complete: false,
      };
    }
    cursor = end;
  }
  return {
    index: Math.max(0, intervals.length - 1),
    intervalElapsed: 0,
    intervalRemaining: 0,
    complete: intervals.length > 0,
  };
}

export function evaluateRunWalkCue(input: {
  intervals: RunWalkInterval[];
  elapsedSeconds: number;
  previousElapsedSeconds: number;
}): IntervalCue | null {
  const current = intervalAtElapsed(input.intervals, input.elapsedSeconds);
  const previous = intervalAtElapsed(input.intervals, input.previousElapsedSeconds);
  if (current.complete && !previous.complete) {
    return { kind: 'complete', text: 'Workout complete.', intervalIndex: current.index };
  }
  if (current.index !== previous.index) {
    const interval = input.intervals[current.index];
    return {
      kind: 'transition',
      text: interval.kind === 'run' ? 'Begin running.' : 'Slow to a walk.',
      intervalIndex: current.index,
    };
  }
  if (current.intervalRemaining <= 30 && previous.intervalRemaining > 30) {
    const next = input.intervals[current.index + 1];
    if (next?.kind === 'run') {
      return {
        kind: 'warning',
        text: 'Thirty seconds until the next running interval.',
        intervalIndex: current.index,
      };
    }
  }
  if (current.intervalRemaining <= 60 && previous.intervalRemaining > 60) {
    return {
      kind: 'warning',
      text: 'One minute remaining in this interval.',
      intervalIndex: current.index,
    };
  }
  return null;
}

export function evaluateSustainedEffortCue(input: {
  state: EffortCueState;
  elapsedSeconds: number;
  isAboveTarget: boolean;
  isBelowTarget?: boolean;
  backInTarget?: boolean;
  samplesRequired?: number;
  cooldownSeconds?: number;
}): { state: EffortCueState; text?: string } {
  const samplesRequired = input.samplesRequired ?? 5;
  const cooldownSeconds = input.cooldownSeconds ?? 180;
  const consecutiveHighSamples = input.isAboveTarget
    ? input.state.consecutiveHighSamples + 1
    : 0;
  const consecutiveLowSamples = input.isBelowTarget
    ? (input.state.consecutiveLowSamples ?? 0) + 1
    : 0;
  const cooledDown = input.elapsedSeconds - input.state.lastCueElapsedSeconds >= cooldownSeconds;
  if (consecutiveHighSamples >= samplesRequired && cooledDown) {
    return {
      state: { consecutiveHighSamples: 0, consecutiveLowSamples: 0, wasOutOfRange: true, lastCueElapsedSeconds: input.elapsedSeconds },
      text: 'Your heart rate is above today’s target. Ease the pace slightly.',
    };
  }
  if (consecutiveLowSamples >= samplesRequired && cooledDown) {
    return {
      state: { consecutiveHighSamples: 0, consecutiveLowSamples: 0, wasOutOfRange: true, lastCueElapsedSeconds: input.elapsedSeconds },
      text: 'You’re below today’s target. Increase the effort gently if that feels appropriate.',
    };
  }
  if (input.backInTarget && input.state.wasOutOfRange && cooledDown) {
    return {
      state: { consecutiveHighSamples: 0, consecutiveLowSamples: 0, wasOutOfRange: false, lastCueElapsedSeconds: input.elapsedSeconds },
      text: 'You’re back in your target zone.',
    };
  }
  return {
    state: {
      ...input.state,
      consecutiveHighSamples,
      consecutiveLowSamples,
      wasOutOfRange: input.state.wasOutOfRange || input.isAboveTarget || Boolean(input.isBelowTarget),
    },
  };
}

export function mergeSpokenCues(cues: string[]): string {
  return [...new Set(cues.map(cue => cue.trim()).filter(Boolean))].join(' ');
}
