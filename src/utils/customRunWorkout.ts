import type { CustomRunDefinition, CustomRunSegment } from '../types/customWorkout';
import type { RichWorkout, RichWorkoutType, WorkoutSegment } from '../types/workout';
import type { TrainingZone, WorkoutIntensity, WorkoutType } from '../types/training';

function formatPace(seconds: number): string {
  const safe = Math.max(1, Math.round(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${sec.toString().padStart(2, '0')}/mi`;
}

function formatSegmentPace(secondsPerMile: number, unit: CustomRunSegment['targetPaceUnit'] = 'mi'): string {
  const seconds = unit === 'km' ? Math.round(secondsPerMile / 1.609344) : Math.round(secondsPerMile);
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}/${unit}`;
}

/** Up to 2 decimals without trailing zeros: 1.25 -> "1.25", 3 -> "3", .5 -> "0.5". */
function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function durationLabel(segment: CustomRunSegment): string {
  if (segment.target === 'distance') {
    const miles = segment.distanceMiles ?? 0;
    if (segment.distanceUnit === 'km') return `${trimNumber(miles * 1.609344)} km`;
    if (segment.distanceUnit === 'm') return `${Math.round(miles * 1609.344)} m`;
    if (segment.distanceUnit === 'mi') return `${trimNumber(miles)} mi`;
    if (miles < 0.2) return `${Math.round(miles * 1609.344)} m`;
    return `${trimNumber(miles)} mi`;
  }
  const totalSeconds = Math.round((segment.durationMinutes ?? 0) * 60);
  if (totalSeconds % 60 === 0) return `${totalSeconds / 60} min`;
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')} min`;
}

function segmentPaceGuide(segment: CustomRunSegment): string {
  if (segment.targetPaceSecPerMile) return formatSegmentPace(segment.targetPaceSecPerMile, segment.targetPaceUnit);
  if (segment.targetHrZone) return `Zone ${segment.targetHrZone}`;
  return segment.kind === 'recovery' || segment.kind === 'cooldown' ? 'Easy' : 'By feel';
}

function segmentRpe(zone: number): [number, number] {
  if (zone <= 1) return [1, 3];
  if (zone === 2) return [3, 4];
  if (zone === 3) return [5, 6];
  if (zone === 4) return [7, 8];
  return [8, 10];
}

function toWorkoutSegment(segment: CustomRunSegment): WorkoutSegment {
  const hrZone = segment.targetHrZone ?? (segment.kind === 'run' ? 3 : 2);
  const isDistance = segment.target === 'distance';
  return {
    label: segment.label.trim() || 'Segment',
    duration: durationLabel(segment),
    paceGuide: segmentPaceGuide(segment),
    hrZone,
    rpe: segmentRpe(hrZone),
    instructions: `${segment.label.trim() || 'Segment'}: ${durationLabel(segment)} at ${segmentPaceGuide(segment)}.`,
    targetMiles: isDistance && (segment.distanceMiles ?? 0) > 0 ? segment.distanceMiles : undefined,
    targetSeconds: !isDistance && (segment.durationMinutes ?? 0) > 0 ? Math.round((segment.durationMinutes ?? 0) * 60) : undefined,
    targetPaceSecPerMile: segment.targetPaceSecPerMile && segment.targetPaceSecPerMile > 0 ? segment.targetPaceSecPerMile : undefined,
  };
}

// A warmup/cooldown slot the athlete didn't define. Empty duration means the
// run screen skips it (workoutSegments filters on duration).
const EMPTY_SEGMENT: WorkoutSegment = {
  label: '',
  duration: '',
  paceGuide: '',
  hrZone: 2,
  rpe: [3, 4],
  instructions: '',
};

function mapRunType(run: CustomRunDefinition): {
  type: WorkoutType;
  richType: RichWorkoutType;
  zone: TrainingZone;
  intensity: WorkoutIntensity;
} {
  if (run.runType === 'intervals' || run.runType === 'long_run_strides' || run.runType === 'custom_segments') {
    return { type: 'intervals', richType: 'vo2', zone: 'vo2', intensity: 'hard' };
  }
  if (run.runType === 'tempo') return { type: 'tempo', richType: 'tempo', zone: 'threshold', intensity: 'moderate' };
  if (run.runType === 'fartlek') return { type: 'fartlek', richType: 'fartlek', zone: 'threshold', intensity: 'moderate' };
  return { type: 'easy_run', richType: 'easy_run', zone: 'easy', intensity: 'easy' };
}

function fallbackSegments(run: CustomRunDefinition): CustomRunSegment[] {
  return [{
    id: `${run.id}_all`,
    label: run.name,
    kind: 'run',
    target: run.distanceMiles > 0 ? 'distance' : 'time',
    distanceMiles: run.distanceMiles > 0 ? run.distanceMiles : undefined,
    durationMinutes: run.distanceMiles > 0 ? undefined : run.durationMinutes,
    targetHrZone: 2,
  }];
}

export function customRunToRichWorkout(run: CustomRunDefinition): RichWorkout {
  const segments = run.structuredSegments?.length ? run.structuredSegments : fallbackSegments(run);
  const mappedSegments = segments.map(toWorkoutSegment);
  // Preserve the athlete's exact order: a leading warmup and trailing cooldown
  // fill those slots; everything else (including extra warmup/cooldown
  // segments) stays in the main set in place. Nothing is dropped or doubled.
  const hasWarmup = segments[0]?.kind === 'warmup';
  const hasCooldown = segments.length > 1 && segments[segments.length - 1]?.kind === 'cooldown';
  const warmup = hasWarmup ? mappedSegments[0]! : EMPTY_SEGMENT;
  const cooldown = hasCooldown ? mappedSegments[mappedSegments.length - 1]! : EMPTY_SEGMENT;
  const mainSet = mappedSegments.slice(hasWarmup ? 1 : 0, hasCooldown ? mappedSegments.length - 1 : mappedSegments.length);
  const runTargets = segments.filter(segment => segment.kind === 'run' && (segment.targetPaceSecPerMile || segment.targetHrZone));
  const paces = segments.map(segment => segment.targetPaceSecPerMile).filter((pace): pace is number => Boolean(pace));
  const primaryZone = runTargets[0]?.targetHrZone ?? segments.find(segment => segment.targetHrZone)?.targetHrZone ?? 2;
  const map = mapRunType(run);
  const paceRange = paces.length
    ? { minSecPerMi: Math.max(...paces), maxSecPerMi: Math.min(...paces) }
    : { minSecPerMi: 660, maxSecPerMi: 540 };

  return {
    id: run.id,
    title: run.name,
    description: run.segmentSummary,
    type: map.type,
    richType: map.richType,
    zone: map.zone,
    durationMinutes: run.durationMinutes,
    targetDistance: run.distanceMiles,
    energySystem: 'aerobic_power',
    recoveryCost: map.intensity === 'hard' ? 55 : 35,
    fatigueScore: map.intensity === 'hard' ? 50 : 28,
    completed: false,
    intensity: map.intensity,
    paceGuidance: {
      label: 'Custom',
      targetPace: paces[0] ? formatPace(paces[0]) : 'By feel',
      description: run.segmentSummary,
    },
    dayIndex: new Date().getDay(),
    paceRange,
    hrZoneTarget: primaryZone,
    rpeRange: segmentRpe(primaryZone),
    warmup,
    mainSet: mainSet.length ? mainSet : [mappedSegments[0]!],
    cooldown,
    intervals: {
      setCount: mainSet.length || mappedSegments.length,
      workLabel: mainSet[0]?.duration ?? mappedSegments[0]?.duration ?? `${run.durationMinutes} min`,
      restLabel: 'as configured',
      workPaceGuide: mainSet[0]?.paceGuide ?? 'By feel',
      workHRZone: primaryZone,
      workRPE: segmentRpe(primaryZone),
      restType: 'jog',
      totalWorkMin: run.durationMinutes,
    },
    purpose: run.segmentSummary || 'Custom structured run.',
    instructions: mappedSegments.map(segment => segment.instructions),
    executionCues: ['Hold the target for the current segment.', 'Use recovery segments to reset form.'],
    failureConditions: ['Stop if pain, dizziness, chest pain, or unusual symptoms occur.'],
    modifications: [{
      condition: 'If the target is too aggressive today',
      action: 'Keep the segment order, reduce pace pressure, and use the HR zone as the ceiling.',
    }],
    rationale: {
      adaptation: 'Specific workout execution',
      mechanism: 'Custom segments let time, distance, pace, and heart-rate targets match the purpose of the day.',
      timeframe: 'Useful immediately during the run and across repeated sessions.',
      scienceBasis: 'Structured intensity distribution and controlled recovery.',
    },
    score: {
      intendedLoad: Math.max(10, Math.round(run.durationMinutes * (map.intensity === 'hard' ? 1.4 : 0.9))),
      estimatedFatigueCost: map.intensity === 'hard' ? 46 : 24,
      expectedAdaptation: map.intensity === 'hard' ? 70 : 48,
      recoveryDemandHours: map.intensity === 'hard' ? 48 : 24,
      confidenceScore: 64,
      executionDifficulty: map.intensity === 'hard' ? 66 : 38,
    },
  };
}
