// ─── Treadmill Math ──────────────────────────────────────────────────────────
//
// Pure segment-accumulation model for estimating treadmill distance from
// confirmed speed changes. Internal canonical unit is always miles/mph;
// km/h input is converted at the boundary via units.ts.
//
// A segment represents a span of time run at one confirmed speed.
// `endedAtMs === null` means the segment is still open (the athlete is
// currently running at `speedMph`, live distance keeps accruing from
// `now()`). Segments never span a pause: pausing closes the open segment,
// resuming opens a new one at the same speed.

import { kmhToMph } from './units';
import type { DistanceSource } from '../types/activity';

export type TreadmillSegment = {
  speedMph: number;
  startedAtMs: number;
  endedAtMs: number | null;
};

function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

// Invalid speed (NaN/Infinity/negative) is treated as 0 mph — the segment
// still exists (so timing stays continuous) but contributes no distance,
// rather than throwing and losing the athlete's session.
export function sanitizeSpeedMph(speedMph: number): number {
  if (!isFiniteNumber(speedMph) || speedMph < 0) return 0;
  return speedMph;
}

export function sanitizeSpeedKmh(speedKmh: number): number {
  return sanitizeSpeedMph(kmhToMph(speedKmh) ?? 0);
}

export function openSegment(speedMph: number, atMs: number): TreadmillSegment {
  return { speedMph: sanitizeSpeedMph(speedMph), startedAtMs: atMs, endedAtMs: null };
}

// Closes the trailing open segment (if any) at `atMs`. No-op if the last
// segment is already closed or the list is empty. Guards against a close
// timestamp before the segment's start (zero/negative-duration segments
// contribute 0 distance rather than going negative).
export function closeOpenSegment(segments: TreadmillSegment[], atMs: number): TreadmillSegment[] {
  if (segments.length === 0) return segments;
  const last = segments[segments.length - 1];
  if (last.endedAtMs !== null) return segments;
  const endedAtMs = Math.max(last.startedAtMs, atMs);
  return [...segments.slice(0, -1), { ...last, endedAtMs }];
}

// Closes the current open segment (if any) and opens a fresh one at the new
// confirmed speed. This is the reducer behind `confirmTreadmillSpeed`.
export function confirmSpeedChange(
  segments: TreadmillSegment[],
  speedMph: number,
  atMs: number,
): TreadmillSegment[] {
  const closed = closeOpenSegment(segments, atMs);
  return [...closed, openSegment(speedMph, atMs)];
}

// Distance for a single segment, in miles. If the segment is still open
// (`endedAtMs === null`), distance accrues live up to `nowMs`.
export function segmentDistanceMiles(segment: TreadmillSegment, nowMs = Date.now()): number {
  const speed = sanitizeSpeedMph(segment.speedMph);
  const end = segment.endedAtMs ?? nowMs;
  const elapsedMs = end - segment.startedAtMs;
  if (!isFiniteNumber(elapsedMs) || elapsedMs <= 0) return 0;
  const elapsedHours = elapsedMs / 3_600_000;
  return speed * elapsedHours;
}

// Total estimated distance across all segments (closed + the live open one).
export function estimateDistanceMiles(segments: TreadmillSegment[], nowMs = Date.now()): number {
  return segments.reduce((total, segment) => total + segmentDistanceMiles(segment, nowMs), 0);
}

// ── Event-log builder (used by tests to exercise full sessions) ───────────

export type TreadmillEvent =
  | { type: 'start'; speedMph: number; atMs: number }
  | { type: 'confirmSpeed'; speedMph: number; atMs: number }
  | { type: 'pause'; atMs: number }
  | { type: 'resume'; atMs: number };

export function buildTreadmillSegments(events: TreadmillEvent[]): TreadmillSegment[] {
  let segments: TreadmillSegment[] = [];
  let lastSpeed = 0;

  for (const event of events) {
    switch (event.type) {
      case 'start':
        lastSpeed = sanitizeSpeedMph(event.speedMph);
        segments = confirmSpeedChange(segments, lastSpeed, event.atMs);
        break;
      case 'confirmSpeed':
        lastSpeed = sanitizeSpeedMph(event.speedMph);
        segments = confirmSpeedChange(segments, lastSpeed, event.atMs);
        break;
      case 'pause':
        segments = closeOpenSegment(segments, event.atMs);
        break;
      case 'resume':
        segments = [...segments, openSegment(lastSpeed, event.atMs)];
        break;
      default:
        break;
    }
  }

  return segments;
}

// ── Final distance correction ──────────────────────────────────────────────

export type FinalDistanceChoice = 'use_estimate' | 'use_display' | 'manual_entry';

export type FinalDistanceResult = {
  distanceMiles: number;
  distanceSource: DistanceSource;
  originalEstimatedDistanceMiles: number;
};

// Fallback estimate for when the athlete never confirmed any treadmill
// speed (so there are no segments to integrate) but a prescribed workout
// with a pace target exists — distance from prescribed pace midpoint ×
// planned duration, distinct from (and honestly labeled apart from) a
// confirmed-speed estimate. Guards invalid/missing input by returning null
// rather than fabricating a number.
export function estimateMilesFromPrescription(
  durationMinutes: number,
  paceRange: { minSecPerMi: number; maxSecPerMi: number } | null | undefined,
): number | null {
  if (!paceRange) return null;
  if (!isFiniteNumber(durationMinutes) || durationMinutes <= 0) return null;
  const { minSecPerMi, maxSecPerMi } = paceRange;
  if (!isFiniteNumber(minSecPerMi) || !isFiniteNumber(maxSecPerMi) || minSecPerMi <= 0 || maxSecPerMi <= 0) return null;
  const midpointSecPerMile = (minSecPerMi + maxSecPerMi) / 2;
  return (durationMinutes * 60) / midpointSecPerMile;
}

// Resolves the athlete's completion-time distance choice. The estimate is
// always preserved as `originalEstimatedDistanceMiles`, even when they
// override it with the treadmill's displayed reading or a manual value.
// `estimateSource` lets the caller distinguish a confirmed-speed estimate
// from a prescribed-pace fallback (used when no speed was ever confirmed).
export function resolveFinalDistance(input: {
  estimateMiles: number;
  enteredMiles?: number | null;
  choice: FinalDistanceChoice;
  estimateSource?: DistanceSource;
}): FinalDistanceResult {
  const originalEstimatedDistanceMiles = isFiniteNumber(input.estimateMiles) && input.estimateMiles >= 0
    ? input.estimateMiles
    : 0;

  if (input.choice === 'use_estimate') {
    return {
      distanceMiles: originalEstimatedDistanceMiles,
      distanceSource: input.estimateSource ?? 'confirmed_speed_estimate',
      originalEstimatedDistanceMiles,
    };
  }

  const enteredValid = input.enteredMiles != null && isFiniteNumber(input.enteredMiles) && input.enteredMiles > 0;
  if (!enteredValid) {
    // No usable entered value — fall back to the estimate, and keep the
    // estimate's source label rather than claiming an equipment/manual read.
    return {
      distanceMiles: originalEstimatedDistanceMiles,
      distanceSource: input.estimateSource ?? 'confirmed_speed_estimate',
      originalEstimatedDistanceMiles,
    };
  }

  return {
    distanceMiles: input.enteredMiles as number,
    distanceSource: input.choice === 'use_display' ? 'equipment_display' : 'manual_entry',
    originalEstimatedDistanceMiles,
  };
}

// Pace from final distance + moving time, guarded against divide-by-zero /
// invalid input. Returns null (never NaN/Infinity) when undefined.
export function safePaceSecPerMile(distanceMiles: number, movingSeconds: number): number | null {
  if (!isFiniteNumber(distanceMiles) || !isFiniteNumber(movingSeconds)) return null;
  if (distanceMiles <= 0 || movingSeconds <= 0) return null;
  return movingSeconds / distanceMiles;
}
