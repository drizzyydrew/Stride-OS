import type {
  TrainingPhase,
  ProgressionLevel,
  GeneratableWorkoutType,
} from '../types/training';
import { shouldApplyDeload } from './training/deloadModel';

// ─── Level Classification ─────────────────────────────────────────────────────

export function resolveProgressionLevel(weeklyMileage: number): ProgressionLevel {
  if (weeklyMileage < 25) return 'beginner';
  if (weeklyMileage <= 50) return 'intermediate';
  return 'advanced';
}

// ─── Deload Detection ─────────────────────────────────────────────────────────

// Every 4th training week triggers a deload. Periodization overrides this for taper.
export function shouldDeload(currentWeek: number): boolean {
  return shouldApplyDeload(currentWeek);
}

// ─── Mileage Progression ──────────────────────────────────────────────────────

// Maximum weekly increase rate per level (applied as compound growth within a phase).
const WEEKLY_INCREASE_RATE: Record<ProgressionLevel, number> = {
  beginner:     0.07,
  intermediate: 0.10,
  advanced:     0.12,
};

// Peak mileage target as a multiplier of base, per phase.
// Build exceeds base by 25%; peak backs off slightly for quality; deload/taper reduce load.
const PHASE_MILEAGE_CEILING: Record<TrainingPhase, number> = {
  foundation: 0.85,
  base:   1.00,
  aerobic_development: 1.08,
  threshold: 1.15,
  vo2: 1.10,
  race_specific: 1.12,
  build:  1.25,
  peak:   1.15,
  deload: 0.65,
  taper:  0.75,
  transition: 0.70,
  recovery: 0.60,
};

export type MileageProgressionInput = {
  baseMileage: number;
  currentWeek: number;
  phase: TrainingPhase;
  progressionLevel: ProgressionLevel;
};

export function computeProgressedMileage({
  baseMileage,
  currentWeek,
  phase,
  progressionLevel,
}: MileageProgressionInput): number {
  const ceiling = PHASE_MILEAGE_CEILING[phase];
  const rate    = WEEKLY_INCREASE_RATE[progressionLevel];

  // Compound weekly growth within the phase, capped at the phase ceiling.
  // Week 1 = no increase; each subsequent week adds rate% until ceiling.
  const growth = Math.min(ceiling, 1 + rate * (currentWeek - 1));

  return Math.round(baseMileage * growth * 10) / 10;
}

// ─── Intensity Multiplier ─────────────────────────────────────────────────────

// Scales recoveryCost and fatigueScore on generated workouts.
// < 1.0 = lower physiological stress; > 1.0 = higher.
const PHASE_INTENSITY_MULTIPLIER: Record<TrainingPhase, number> = {
  foundation: 0.55,
  base:   0.70,
  aerobic_development: 0.78,
  threshold: 0.95,
  vo2: 1.05,
  race_specific: 1.00,
  build:  1.00,
  peak:   1.15,
  deload: 0.40,
  taper:  0.60,
  transition: 0.45,
  recovery: 0.35,
};

export function resolvePhaseIntensityMultiplier(phase: TrainingPhase): number {
  return PHASE_INTENSITY_MULTIPLIER[phase];
}

// ─── Phase Workout Selection ──────────────────────────────────────────────────

export type WorkoutSelectionInput = {
  phase: TrainingPhase;
  progressionLevel: ProgressionLevel;
  readinessLabel: 'high' | 'moderate' | 'low';
};

// Returns an ordered 7-element array (Mon–Sun) of workout types for the week.
// Readiness overrides phase when the athlete is in a low state.
export function selectPhaseWorkouts({
  phase,
  progressionLevel,
  readinessLabel,
}: WorkoutSelectionInput): GeneratableWorkoutType[] {
  if (readinessLabel === 'low') {
    return ['rest', 'recovery_run', 'easy_run', 'recovery_run', 'rest', 'strides', 'rest'];
  }

  switch (phase) {
    case 'foundation':
      return   ['easy_run', 'rest',      'easy_run', 'rest',     'easy_run', 'rest',      'rest'];

    case 'base':
    case 'aerobic_development':
      if (progressionLevel === 'beginner') {
        return ['easy_run', 'rest',      'easy_run', 'rest',     'long_run', 'strides',  'rest'];
      }
      return   ['easy_run', 'strides',   'easy_run', 'rest',     'long_run', 'easy_run', 'rest'];

    case 'build':
    case 'threshold':
    case 'vo2':
    case 'race_specific':
      if (progressionLevel === 'beginner') {
        return ['easy_run', 'threshold', 'rest',     'easy_run', 'long_run', 'strides',  'rest'];
      }
      return   ['easy_run', 'threshold', 'easy_run', 'rest',     'long_run', 'vo2',      'rest'];

    case 'peak':
      if (progressionLevel === 'beginner') {
        return ['easy_run', 'threshold', 'rest',     'easy_run', 'long_run', 'strides',  'rest'];
      }
      return   ['easy_run', 'vo2',       'easy_run', 'threshold','rest',     'long_run', 'strides'];

    case 'deload':
    case 'transition':
    case 'recovery':
      return   ['rest', 'recovery_run', 'easy_run', 'rest', 'recovery_run', 'strides', 'rest'];

    case 'taper':
      return   ['easy_run', 'strides', 'rest', 'easy_run', 'threshold', 'rest', 'rest'];
  }
}
