import type { CustomRunDefinition, CustomRunSegment } from '../types/customWorkout';
import type { RichWorkout, RichWorkoutType, WorkoutSegment } from '../types/workout';
import type { TrainingZone, WorkoutIntensity, WorkoutType } from '../types/training';

function formatPace(seconds: number): string {
  const safe = Math.max(1, Math.round(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${sec.toString().padStart(2, '0')}/mi`;
}

function durationLabel(segment: CustomRunSegment): string {
  if (segment.target === 'distance') {
    const miles = segment.distanceMiles ?? 0;
    if (miles < 0.2) return `${Math.round(miles * 1609.344)}m`;
    return `${miles.toFixed(miles >= 1 ? 1 : 2)} mi`;
  }
  return `${Math.round(segment.durationMinutes ?? 0)} min`;
}

function segmentPaceGuide(segment: CustomRunSegment): string {
  if (segment.targetPaceSecPerMile) return formatPace(segment.targetPaceSecPerMile);
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
  return {
    label: segment.label.trim() || 'Segment',
    duration: durationLabel(segment),
    paceGuide: segmentPaceGuide(segment),
    hrZone,
    rpe: segmentRpe(hrZone),
    instructions: `${segment.label.trim() || 'Segment'}: ${durationLabel(segment)} at ${segmentPaceGuide(segment)}.`,
  };
}

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
  const warmup = mappedSegments.find((_, index) => segments[index]?.kind === 'warmup') ?? mappedSegments[0]!;
  const cooldown = mappedSegments.find((_, index) => segments[index]?.kind === 'cooldown') ?? mappedSegments[mappedSegments.length - 1]!;
  const mainSet = mappedSegments.filter((_, index) => {
    const kind = segments[index]?.kind;
    return kind !== 'warmup' && kind !== 'cooldown';
  });
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
