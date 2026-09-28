// ─── Structured-workout segment coaching ─────────────────────────────────────
//
// Pure helpers for running a structured workout segment by segment: what the
// segment's target is (time or distance), live "speed up / ease off" pace
// cues against the segment's target pace, and end-of-segment feedback.
// Kept free of React/store imports so they are unit-tested directly.

import type { WorkoutSegment } from '../types/workout';

export type SegmentTarget =
  | { kind: 'time'; seconds: number }
  | { kind: 'distance'; miles: number };

const METERS_PER_MILE = 1609.344;
const KM_PER_MILE = 1.609344;

/**
 * Target for a segment. Numeric fields (set for custom workouts) win; the
 * display string is only a fallback for plan-generated workouts.
 */
export function segmentTarget(segment: WorkoutSegment): SegmentTarget | null {
  if (typeof segment.targetMiles === 'number' && segment.targetMiles > 0) {
    return { kind: 'distance', miles: segment.targetMiles };
  }
  if (typeof segment.targetSeconds === 'number' && segment.targetSeconds > 0) {
    return { kind: 'time', seconds: Math.round(segment.targetSeconds) };
  }
  return parseDurationTarget(segment.duration);
}

/**
 * Parses "10 min", "90 sec", "1:30", "0.25 mi", "400m", "1.5 km", "1 hr".
 * The unit is read as the token directly after the number, so "10 min" is
 * never mistaken for miles (the old check matched " mi" inside "min").
 */
export function parseDurationTarget(duration: string): SegmentTarget | null {
  const raw = duration.trim().toLowerCase();
  if (!raw) return null;

  const clock = raw.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?\b/);
  if (clock) {
    const seconds = clock[3] != null
      ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
      : Number(clock[1]) * 60 + Number(clock[2]);
    return seconds > 0 ? { kind: 'time', seconds } : null;
  }

  const match = raw.match(/(\d*\.?\d+)\s*([a-z]*)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2];

  if (unit === 'mi' || unit === 'mile' || unit === 'miles') return { kind: 'distance', miles: value };
  if (unit === 'km' || unit.startsWith('kilomet')) return { kind: 'distance', miles: value / KM_PER_MILE };
  if (unit === 'm' || unit.startsWith('meter') || unit.startsWith('metre')) return { kind: 'distance', miles: value / METERS_PER_MILE };
  if (unit === 's' || unit.startsWith('sec')) return { kind: 'time', seconds: Math.round(value) };
  if (unit === 'h' || unit === 'hr' || unit === 'hrs' || unit.startsWith('hour')) return { kind: 'time', seconds: Math.round(value * 3600) };
  // "min", "mins", "minute(s)", or a bare number: minutes.
  return { kind: 'time', seconds: Math.round(value * 60) };
}

export function formatPaceClock(secondsPerUnit: number): string {
  const safe = Math.max(1, Math.round(secondsPerUnit));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** "7:30 per mile" in the athlete's units (pace stored as seconds per mile). */
export function spokenPace(secondsPerMile: number, imperial: boolean): string {
  const perUnit = imperial ? secondsPerMile : secondsPerMile / KM_PER_MILE;
  return `${formatPaceClock(perUnit)} per ${imperial ? 'mile' : 'kilometer'}`;
}

export function segmentStartCue(segment: WorkoutSegment, index: number, imperial: boolean): string {
  const pace = typeof segment.targetPaceSecPerMile === 'number' && segment.targetPaceSecPerMile > 0
    ? ` Target pace ${spokenPace(segment.targetPaceSecPerMile, imperial)}.`
    : segment.paceGuide ? ` ${segment.paceGuide}.` : '';
  return `Segment ${index + 1}: ${segment.label}. ${segment.duration}.${pace}`;
}

// Live cue tuning. Tolerance scales with pace (faster paces get tighter
// windows) but never below 5 s/mi. The grace period lets the athlete settle
// into a new segment; the cooldown keeps cues from nagging.
export const PACE_CUE_GRACE_SECONDS = 30;
export const PACE_CUE_COOLDOWN_SECONDS = 60;
export function paceToleranceSecPerMile(targetSecPerMile: number): number {
  return Math.max(5, Math.round(targetSecPerMile * 0.025));
}

/** Tighter band for the after-segment verdict (a summary, not a nag). */
export function feedbackToleranceSecPerMile(targetSecPerMile: number): number {
  return Math.max(3, Math.round(targetSecPerMile * 0.01));
}

export type PaceCueInput = {
  targetPaceSecPerMile: number | undefined;
  currentPaceSecPerMile: number;
  segmentElapsedSeconds: number;
  secondsSinceLastPaceCue: number | null;
  imperial: boolean;
};

export type PaceCue = { direction: 'faster' | 'slower'; text: string };

/** A "speed up" / "ease off" cue, or null when on pace or not yet due. */
export function evaluateSegmentPaceCue(input: PaceCueInput): PaceCue | null {
  const target = input.targetPaceSecPerMile;
  if (!target || target <= 0) return null;
  if (!Number.isFinite(input.currentPaceSecPerMile) || input.currentPaceSecPerMile <= 0) return null;
  // Rolling pace is meaningless near a standstill (auto-pause handles that).
  if (input.currentPaceSecPerMile > 30 * 60) return null;
  if (input.segmentElapsedSeconds < PACE_CUE_GRACE_SECONDS) return null;
  if (input.secondsSinceLastPaceCue != null && input.secondsSinceLastPaceCue < PACE_CUE_COOLDOWN_SECONDS) return null;

  const delta = input.currentPaceSecPerMile - target; // + = slower than target
  const tolerance = paceToleranceSecPerMile(target);
  if (Math.abs(delta) <= tolerance) return null;
  const targetText = spokenPace(target, input.imperial);
  return delta > 0
    ? { direction: 'faster', text: `Speed up. Target ${targetText}.` }
    : { direction: 'slower', text: `Ease off. Target ${targetText}.` };
}

/** Spoken summary when a segment completes. */
export function segmentFeedbackCue(args: {
  index: number;
  segmentSeconds: number;
  segmentMiles: number;
  targetPaceSecPerMile: number | undefined;
  imperial: boolean;
}): string {
  if (args.segmentMiles < 0.01 || args.segmentSeconds <= 0) {
    return `Segment ${args.index + 1} complete.`;
  }
  const actual = args.segmentSeconds / args.segmentMiles;
  const base = `Segment ${args.index + 1} complete. You averaged ${spokenPace(actual, args.imperial)}`;
  const target = args.targetPaceSecPerMile;
  if (!target || target <= 0) return `${base}.`;
  const unitFactor = args.imperial ? 1 : 1 / KM_PER_MILE;
  const deltaSeconds = Math.round((actual - target) * unitFactor);
  const tolerance = Math.round(feedbackToleranceSecPerMile(target) * unitFactor);
  if (Math.abs(deltaSeconds) <= tolerance) return `${base}, right on target.`;
  const seconds = Math.abs(deltaSeconds);
  return deltaSeconds > 0
    ? `${base}, ${seconds} second${seconds === 1 ? '' : 's'} slower than target. Too slow.`
    : `${base}, ${seconds} second${seconds === 1 ? '' : 's'} faster than target. Too fast.`;
}

// ─── Paced cueing (Build 91) ─────────────────────────────────────────────────
// Like the heart-rate zone cues: speak only after the athlete has been off
// pace for a sustained stretch, never more than once per PACE_CUE_MIN_GAP,
// and give an occasional "on pace" check-in so silence doesn't feel broken.
export const PACE_OFF_SUSTAIN_SECONDS = 20;
export const PACE_CUE_MIN_GAP_SECONDS = 120;
export const PACE_ON_TARGET_CHECKIN_SECONDS = 300;

export type PaceCueState = {
  offPaceSince: number | null;
  direction: 'faster' | 'slower' | null;
  lastCueAt: number | null;
};

export const INITIAL_PACE_CUE_STATE: PaceCueState = { offPaceSince: null, direction: null, lastCueAt: null };

export function nextPaceCue(
  state: PaceCueState,
  input: {
    targetPaceSecPerMile: number | undefined;
    currentPaceSecPerMile: number;
    segmentElapsedSeconds: number;
    elapsedSeconds: number;
    imperial: boolean;
  },
): { cue: string | null; state: PaceCueState } {
  const target = input.targetPaceSecPerMile;
  const pace = input.currentPaceSecPerMile;
  if (!target || target <= 0 || !Number.isFinite(pace) || pace <= 0 || pace > 30 * 60) {
    return { cue: null, state: { ...state, offPaceSince: null, direction: null } };
  }
  if (input.segmentElapsedSeconds < PACE_CUE_GRACE_SECONDS) {
    return { cue: null, state: { ...state, offPaceSince: null, direction: null } };
  }
  const now = input.elapsedSeconds;
  const sinceLastCue = state.lastCueAt == null ? Number.POSITIVE_INFINITY : now - state.lastCueAt;
  const delta = pace - target;
  const tolerance = paceToleranceSecPerMile(target);
  const targetText = spokenPace(target, input.imperial);

  if (Math.abs(delta) <= tolerance) {
    const next: PaceCueState = { ...state, offPaceSince: null, direction: null };
    if (sinceLastCue >= PACE_ON_TARGET_CHECKIN_SECONDS) {
      return { cue: `On pace. ${spokenPace(pace, input.imperial)}.`, state: { ...next, lastCueAt: now } };
    }
    return { cue: null, state: next };
  }

  const direction: 'faster' | 'slower' = delta > 0 ? 'faster' : 'slower';
  const offPaceSince = state.direction === direction && state.offPaceSince != null ? state.offPaceSince : now;
  const next: PaceCueState = { ...state, offPaceSince, direction };
  if (now - offPaceSince < PACE_OFF_SUSTAIN_SECONDS || sinceLastCue < PACE_CUE_MIN_GAP_SECONDS) {
    return { cue: null, state: next };
  }
  const text = direction === 'faster'
    ? `Speed up. Target ${targetText}.`
    : `Ease off. Target ${targetText}.`;
  return { cue: text, state: { ...next, lastCueAt: now } };
}
