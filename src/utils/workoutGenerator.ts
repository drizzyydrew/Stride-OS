import type {
  TrainingWeek,
  Workout,
  ReadinessState,
  PaceZones,
  PaceGuidance,
  GeneratableWorkoutType,
  WorkoutGeneratorInput,
} from '../types/training';

import {
  computeProgressedMileage,
  resolvePhaseIntensityMultiplier,
  selectPhaseWorkouts,
} from './progression';

// ─── Pace Formatting ─────────────────────────────────────────────────────────

function formatPace(minutesPerMile: number): string {
  const mins = Math.floor(minutesPerMile);
  const secs = Math.round((minutesPerMile - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function paceRange(baseMpm: number, halfSpreadMpm: number): string {
  const low  = Math.max(baseMpm - halfSpreadMpm, 0);
  const high = baseMpm + halfSpreadMpm;
  return `${formatPace(low)}–${formatPace(high)}/mi`;
}

// ─── Race Profile Lookup ──────────────────────────────────────────────────────

type RaceProfile = {
  racePace: number;
  recoveryOffset: number;
  easyOffset: number;
  thresholdOffset: number;
  vo2Offset: number;
  stridesOffset: number;
};

// Offsets are added to race pace (positive = slower, negative = faster).
// Spreads tighten on harder zones where execution precision matters more.
const RACE_PROFILES: Record<string, RaceProfile> = {
  sub_4_marathon:   { racePace: 9.16,  recoveryOffset: 2.0,  easyOffset: 1.5,  thresholdOffset: -1.0,  vo2Offset: -1.75, stridesOffset: -2.25 },
  sub_430_marathon: { racePace: 10.31, recoveryOffset: 2.0,  easyOffset: 1.5,  thresholdOffset: -1.0,  vo2Offset: -1.75, stridesOffset: -2.25 },
  sub_5_marathon:   { racePace: 11.45, recoveryOffset: 2.0,  easyOffset: 1.5,  thresholdOffset: -1.0,  vo2Offset: -1.75, stridesOffset: -2.25 },
  sub_145_half:     { racePace: 8.02,  recoveryOffset: 2.25, easyOffset: 1.75, thresholdOffset: -0.5,  vo2Offset: -1.25, stridesOffset: -1.75 },
  sub_2_half:       { racePace: 9.16,  recoveryOffset: 2.25, easyOffset: 1.75, thresholdOffset: -0.5,  vo2Offset: -1.25, stridesOffset: -1.75 },
  sub_20_5k:        { racePace: 6.45,  recoveryOffset: 2.75, easyOffset: 2.25, thresholdOffset:  0.25, vo2Offset: -0.25, stridesOffset: -0.75 },
  sub_25_5k:        { racePace: 8.07,  recoveryOffset: 2.75, easyOffset: 2.25, thresholdOffset:  0.25, vo2Offset: -0.25, stridesOffset: -0.75 },
};

const DEFAULT_PROFILE: RaceProfile = {
  racePace: 10.0,
  recoveryOffset: 2.0,
  easyOffset: 1.5,
  thresholdOffset: -1.0,
  vo2Offset: -1.75,
  stridesOffset: -2.25,
};

function matchRaceProfile(goalRace: string): RaceProfile {
  const g = goalRace.toLowerCase();

  if (g.includes('marathon')) {
    if (g.includes('sub 4') && !g.includes('4:30') && !g.includes('4.5')) return RACE_PROFILES.sub_4_marathon!;
    if (g.includes('4:30') || g.includes('4.5'))                           return RACE_PROFILES.sub_430_marathon!;
    if (g.includes('sub 5'))                                               return RACE_PROFILES.sub_5_marathon!;
  }

  if (g.includes('half')) {
    if (g.includes('1:45') || g.includes('1.45')) return RACE_PROFILES.sub_145_half!;
    if (g.includes('sub 2'))                       return RACE_PROFILES.sub_2_half!;
  }

  if (g.includes('5k') || g.includes('5 k')) {
    if (g.includes('sub 20')) return RACE_PROFILES.sub_20_5k!;
    if (g.includes('sub 25')) return RACE_PROFILES.sub_25_5k!;
  }

  return DEFAULT_PROFILE;
}

// ─── Public: Pace Zone Derivation ────────────────────────────────────────────

export function derivePaceZones(goalRace: string): PaceZones {
  const p = matchRaceProfile(goalRace);

  return {
    recovery: {
      label: 'Recovery Pace',
      description: 'Fully conversational. Heart rate should feel almost too easy.',
      targetPace: paceRange(p.racePace + p.recoveryOffset, 0.5),
    },
    easy: {
      label: 'Easy Aerobic Pace',
      description: 'Conversational Zone 2. Could sustain for hours without strain.',
      targetPace: paceRange(p.racePace + p.easyOffset, 0.375),
    },
    threshold: {
      label: 'Threshold Pace',
      description: 'Comfortably hard. Short sentences only. Lactate threshold effort.',
      targetPace: paceRange(p.racePace + p.thresholdOffset, 0.25),
    },
    vo2: {
      label: 'VO2 Max Pace',
      description: 'Hard controlled effort. 3K–5K race intensity. Brief recoveries between reps.',
      targetPace: paceRange(p.racePace + p.vo2Offset, 0.25),
    },
    strides: {
      label: 'Stride Pace',
      description: 'Fast but relaxed surges. Full recovery between each effort.',
      targetPace: paceRange(p.racePace + p.stridesOffset, 0.375),
    },
  };
}

// ─── Public: Readiness Resolution ────────────────────────────────────────────

export function resolveReadiness(
  recoveryScore: number,
  fatigueScore: number,
): ReadinessState {
  const isLow  = recoveryScore < 55 || fatigueScore > 75;
  const isHigh = recoveryScore >= 80 && fatigueScore < 45;

  return {
    recoveryScore,
    fatigueScore,
    readinessLabel:       isHigh ? 'high' : isLow ? 'low' : 'moderate',
    recommendedIntensity: isHigh ? 'hard' : isLow ? 'recovery' : 'moderate',
  };
}

// ─── Workout Builders ─────────────────────────────────────────────────────────

// intensityMultiplier scales physiological cost without changing pace guidance.
// Duration is volume-driven (mileage); cost is phase-driven (multiplier).

function buildRecoveryRun(
  paceZones: PaceZones,
  mileage: number,
  multiplier: number,
): Workout {
  return {
    id: 'recovery_run',
    title: 'Recovery Run',
    description: 'Low-intensity aerobic work to promote blood flow and clear metabolic waste without adding meaningful training stress.',
    type: 'recovery',
    zone: 'recovery',
    durationMinutes: 30,
    targetDistance: Math.round(mileage * 0.07),
    energySystem: 'aerobic_power',
    recoveryCost: Math.round(10 * multiplier),
    fatigueScore: Math.round(8  * multiplier),
    completed: false,
    intensity: 'very_easy',
    paceGuidance: paceZones.recovery,
  };
}

function buildEasyRun(
  paceZones: PaceZones,
  mileage: number,
  multiplier: number,
): Workout {
  return {
    id: 'easy_run',
    title: 'Easy Aerobic Run',
    description: 'Zone 2 aerobic development. Builds mitochondrial density, capillary bed, and fat-oxidation capacity.',
    type: 'easy_run',
    zone: 'aerobic',
    durationMinutes: 45,
    targetDistance: Math.round(mileage * 0.18),
    energySystem: 'aerobic_power',
    recoveryCost: Math.round(25 * multiplier),
    fatigueScore: Math.round(20 * multiplier),
    completed: false,
    intensity: 'easy',
    paceGuidance: paceZones.easy,
  };
}

function buildLongRun(
  paceZones: PaceZones,
  mileage: number,
  multiplier: number,
): Workout {
  return {
    id: 'long_run',
    title: 'Long Run',
    description: 'Extended aerobic stimulus for glycogen durability, fatigue resistance, and race-specific endurance adaptation.',
    type: 'long_run',
    zone: 'aerobic',
    durationMinutes: Math.min(150, Math.round(90 + mileage * 0.5)),
    targetDistance: Math.round(mileage * 0.30),
    energySystem: 'aerobic_power',
    recoveryCost: Math.round(55 * multiplier),
    fatigueScore: Math.round(45 * multiplier),
    completed: false,
    intensity: 'easy',
    paceGuidance: paceZones.easy,
  };
}

function buildThresholdWorkout(
  paceZones: PaceZones,
  mileage: number,
  multiplier: number,
): Workout {
  return {
    id: 'threshold',
    title: 'Threshold Run',
    description: '20–30 minutes at lactate threshold. Raises anaerobic threshold and improves sustainable race pace.',
    type: 'threshold',
    zone: 'threshold',
    durationMinutes: 50,
    targetDistance: Math.round(mileage * 0.20),
    energySystem: 'aerobic_power',
    recoveryCost: Math.round(55 * multiplier),
    fatigueScore: Math.round(50 * multiplier),
    completed: false,
    intensity: 'hard',
    paceGuidance: paceZones.threshold,
  };
}

function buildVO2Workout(
  paceZones: PaceZones,
  mileage: number,
  multiplier: number,
): Workout {
  return {
    id: 'vo2_intervals',
    title: 'VO2 Intervals',
    description: 'Four 4-minute controlled hard intervals (Norwegian 4x4 protocol). Elevates aerobic ceiling and cardiac output.',
    type: 'norwegian_4x4',
    zone: 'vo2',
    durationMinutes: 50,
    targetDistance: Math.round(mileage * 0.18),
    energySystem: 'aerobic_power',
    recoveryCost: Math.round(65 * multiplier),
    fatigueScore: Math.round(58 * multiplier),
    completed: false,
    intensity: 'hard',
    paceGuidance: paceZones.vo2,
  };
}

function buildStrides(
  paceZones: PaceZones,
  mileage: number,
  multiplier: number,
): Workout {
  return {
    id: 'strides',
    title: 'Strides',
    description: '6–8 × 20-second relaxed accelerations. Improves neuromuscular power, running economy, and stride mechanics.',
    type: 'strides',
    zone: 'anaerobic',
    durationMinutes: 25,
    targetDistance: Math.round(mileage * 0.07),
    energySystem: 'processing_power',
    recoveryCost: Math.round(20 * multiplier),
    fatigueScore: Math.round(18 * multiplier),
    completed: false,
    intensity: 'moderate',
    paceGuidance: paceZones.strides,
  };
}

const REST_PACE_GUIDANCE: PaceGuidance = {
  label: 'Rest',
  description: 'No running. Focus on sleep, hydration, and nutrition.',
  targetPace: 'N/A',
};

function buildRestDay(): Workout {
  return {
    id: 'rest_day',
    title: 'Rest Day',
    description: 'Full rest. No structured exercise. Prioritize sleep and recovery for adaptation to take hold.',
    type: 'rest',
    zone: 'recovery',
    durationMinutes: 0,
    targetDistance: 0,
    energySystem: 'aerobic_power',
    recoveryCost: -15,
    fatigueScore: -5,
    completed: false,
    intensity: 'rest',
    paceGuidance: REST_PACE_GUIDANCE,
  };
}

// ─── Internal Dispatch ────────────────────────────────────────────────────────

function buildWorkoutByType(
  type: GeneratableWorkoutType,
  paceZones: PaceZones,
  mileage: number,
  multiplier: number,
): Workout {
  switch (type) {
    case 'recovery_run': return buildRecoveryRun(paceZones, mileage, multiplier);
    case 'easy_run':     return buildEasyRun(paceZones, mileage, multiplier);
    case 'long_run':     return buildLongRun(paceZones, mileage, multiplier);
    case 'threshold':    return buildThresholdWorkout(paceZones, mileage, multiplier);
    case 'vo2':          return buildVO2Workout(paceZones, mileage, multiplier);
    case 'strides':      return buildStrides(paceZones, mileage, multiplier);
    case 'rest':         return buildRestDay();
  }
}

// ─── Public: Single Workout Generation ───────────────────────────────────────

export function generateWorkout(
  type: GeneratableWorkoutType,
  input: WorkoutGeneratorInput,
): Workout {
  const paceZones  = derivePaceZones(input.goalRace);
  const multiplier = resolvePhaseIntensityMultiplier(input.trainingPhase);
  const mileage    = computeProgressedMileage({
    baseMileage:      input.weeklyMileage,
    currentWeek:      input.currentWeek,
    phase:            input.trainingPhase,
    progressionLevel: input.progressionLevel,
  });

  return buildWorkoutByType(type, paceZones, mileage, multiplier);
}

// ─── Public: Full Week Generation ────────────────────────────────────────────

export function generateTrainingWeek(input: WorkoutGeneratorInput): TrainingWeek {
  const readiness  = resolveReadiness(input.recoveryScore, input.fatigueScore);
  const paceZones  = derivePaceZones(input.goalRace);
  const multiplier = resolvePhaseIntensityMultiplier(input.trainingPhase);
  const mileage    = computeProgressedMileage({
    baseMileage:      input.weeklyMileage,
    currentWeek:      input.currentWeek,
    phase:            input.trainingPhase,
    progressionLevel: input.progressionLevel,
  });

  const workoutTypes = selectPhaseWorkouts({
    phase:           input.trainingPhase,
    progressionLevel: input.progressionLevel,
    readinessLabel:  readiness.readinessLabel,
  });

  const plannedWorkouts = workoutTypes.map(type =>
    buildWorkoutByType(type, paceZones, mileage, multiplier),
  );

  return {
    id:            `week_${input.currentWeek}_${input.trainingPhase}`,
    weekNumber:    input.currentWeek,
    trainingPhase: input.trainingPhase,
    totalMileage:  mileage,
    isDeloadWeek:  input.trainingPhase === 'deload',
    plannedWorkouts,
  };
}
