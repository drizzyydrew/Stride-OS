import type { UnitSystem } from '../store/settingsStore';
import { formatDistance, formatPaceSecPerMile } from '../lib/units';

export type WorkoutSegmentKind =
  | 'warmup'
  | 'run'
  | 'walk'
  | 'recovery'
  | 'easy'
  | 'tempo'
  | 'threshold'
  | 'interval'
  | 'stride'
  | 'sprint'
  | 'hill'
  | 'cooldown'
  | 'custom';

export type WorkoutSegmentTarget =
  | { type: 'time'; seconds: number }
  | { type: 'distance'; meters: number };

export type WorkoutIntensityTarget = {
  paceSecPerMile?: number;
  heartRateZone?: 1 | 2 | 3 | 4 | 5;
  rpe?: number;
};

export type WorkoutSegment = {
  id: string;
  kind: WorkoutSegmentKind;
  label?: string;
  target: WorkoutSegmentTarget;
  intensity?: WorkoutIntensityTarget;
};

export type WorkoutSegmentGroup = {
  id: string;
  repeatCount: number;
  segments: WorkoutSegment[];
};

export type StructuredWorkout = {
  id: string;
  name: string;
  warmup?: WorkoutSegment;
  groups: WorkoutSegmentGroup[];
  cooldown?: WorkoutSegment;
};

export type StructuredWorkoutEstimate = {
  totalSeconds: number;
  totalMeters: number;
  approximate: boolean;
  segments: { segmentId: string; seconds: number; meters: number; label: string }[];
};

export type SegmentVoiceCue = {
  atSecond: number;
  text: string;
  category: 'transition' | 'countdown';
};

const DEFAULT_PACE_SEC_PER_MILE: Record<WorkoutSegmentKind, number> = {
  warmup: 900,
  run: 660,
  walk: 1200,
  recovery: 780,
  easy: 720,
  tempo: 540,
  threshold: 510,
  interval: 480,
  stride: 420,
  sprint: 360,
  hill: 600,
  cooldown: 900,
  custom: 720,
};

function safePositive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function segmentLabel(segment: WorkoutSegment): string {
  return segment.label?.trim() || segment.kind.replace(/_/g, ' ');
}

function estimateSegment(
  segment: WorkoutSegment,
  fallbackPaceSecPerMile?: number,
): { seconds: number; meters: number; approximate: boolean } {
  if (segment.target.type === 'time') {
    const seconds = Math.max(0, Math.round(segment.target.seconds));
    const pace = segment.intensity?.paceSecPerMile ?? fallbackPaceSecPerMile ?? DEFAULT_PACE_SEC_PER_MILE[segment.kind];
    const meters = safePositive(pace) ? (seconds / pace) * 1609.344 : 0;
    return { seconds, meters, approximate: !segment.intensity?.paceSecPerMile };
  }
  const meters = Math.max(0, segment.target.meters);
  const pace = segment.intensity?.paceSecPerMile ?? fallbackPaceSecPerMile ?? DEFAULT_PACE_SEC_PER_MILE[segment.kind];
  const seconds = safePositive(pace) ? (meters / 1609.344) * pace : 0;
  return { seconds: Math.round(seconds), meters, approximate: !segment.intensity?.paceSecPerMile };
}

export function flattenStructuredWorkout(workout: StructuredWorkout): WorkoutSegment[] {
  const out: WorkoutSegment[] = [];
  if (workout.warmup) out.push(workout.warmup);
  for (const group of workout.groups) {
    const repeats = Math.max(1, Math.floor(group.repeatCount));
    for (let i = 0; i < repeats; i += 1) out.push(...group.segments);
  }
  if (workout.cooldown) out.push(workout.cooldown);
  return out;
}

export function estimateStructuredWorkout(
  workout: StructuredWorkout,
  options: { fallbackRunPaceSecPerMile?: number; fallbackWalkPaceSecPerMile?: number } = {},
): StructuredWorkoutEstimate {
  let totalSeconds = 0;
  let totalMeters = 0;
  let approximate = false;
  const segments: StructuredWorkoutEstimate['segments'] = [];
  for (const segment of flattenStructuredWorkout(workout)) {
    const fallback = segment.kind === 'walk' ? options.fallbackWalkPaceSecPerMile : options.fallbackRunPaceSecPerMile;
    const estimate = estimateSegment(segment, fallback);
    totalSeconds += estimate.seconds;
    totalMeters += estimate.meters;
    approximate = approximate || estimate.approximate;
    segments.push({
      segmentId: segment.id,
      seconds: estimate.seconds,
      meters: estimate.meters,
      label: segmentLabel(segment),
    });
  }
  return { totalSeconds, totalMeters, approximate, segments };
}

export function reorderWorkoutGroup(
  group: WorkoutSegmentGroup,
  fromIndex: number,
  toIndex: number,
): WorkoutSegmentGroup {
  const segments = [...group.segments];
  const from = Math.max(0, Math.min(segments.length - 1, fromIndex));
  const to = Math.max(0, Math.min(segments.length - 1, toIndex));
  const [item] = segments.splice(from, 1);
  if (item) segments.splice(to, 0, item);
  return { ...group, segments };
}

export function duplicateWorkoutSegment(segment: WorkoutSegment, id: string): WorkoutSegment {
  return { ...segment, id };
}

export function formatStructuredWorkoutEstimate(estimate: StructuredWorkoutEstimate, units: UnitSystem): string {
  const distance = formatDistance(estimate.totalMeters / 1609.344, units);
  const minutes = Math.round(estimate.totalSeconds / 60);
  return `${estimate.approximate ? '~' : ''}${minutes} min - ${distance}`;
}

export function formatSegmentTarget(segment: WorkoutSegment, units: UnitSystem): string {
  if (segment.target.type === 'time') {
    const seconds = Math.max(0, Math.round(segment.target.seconds));
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return minutes > 0 ? `${minutes}:${String(rem).padStart(2, '0')}` : `${rem} sec`;
  }
  return formatDistance(segment.target.meters / 1609.344, units);
}

export function buildSegmentVoiceCues(
  workout: StructuredWorkout,
  options: { countdowns?: boolean } = {},
): SegmentVoiceCue[] {
  const cues: SegmentVoiceCue[] = [];
  let cursor = 0;
  for (const segment of flattenStructuredWorkout(workout)) {
    const estimate = estimateSegment(segment);
    const label = segmentLabel(segment);
    if (cursor > 0) {
      cues.push({ atSecond: cursor, text: `${label} for ${formatSegmentTarget(segment, 'imperial')}.`, category: 'transition' });
    }
    if (options.countdowns && estimate.seconds >= 35) {
      for (const offset of [30, 10, 5]) {
        cues.push({ atSecond: cursor + Math.max(0, estimate.seconds - offset), text: `${offset} seconds.`, category: 'countdown' });
      }
    }
    cursor += estimate.seconds;
  }
  cues.push({ atSecond: cursor, text: 'Workout complete.', category: 'transition' });
  return cues.sort((a, b) => a.atSecond - b.atSecond || a.text.localeCompare(b.text));
}

export function workoutFromRunWalkTemplate(input: {
  id: string;
  name: string;
  warmupSeconds: number;
  runSeconds: number;
  walkSeconds: number;
  repeatCount: number;
  cooldownSeconds: number;
}): StructuredWorkout {
  return {
    id: input.id,
    name: input.name,
    warmup: { id: `${input.id}:warmup`, kind: 'warmup', target: { type: 'time', seconds: input.warmupSeconds } },
    groups: [{
      id: `${input.id}:main`,
      repeatCount: input.repeatCount,
      segments: [
        { id: `${input.id}:run`, kind: 'run', target: { type: 'time', seconds: input.runSeconds } },
        { id: `${input.id}:walk`, kind: 'walk', target: { type: 'time', seconds: input.walkSeconds } },
      ],
    }],
    cooldown: { id: `${input.id}:cooldown`, kind: 'cooldown', target: { type: 'time', seconds: input.cooldownSeconds } },
  };
}
