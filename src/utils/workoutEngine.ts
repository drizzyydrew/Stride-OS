// ─── Workout Engine ────────────────────────────────────────────────────────────
//
// Deterministic engine producing a complete RichWeek from WorkoutEngineInput.
// Phase-based templates select 7 session types per week. The adaptive modifier
// layer adjusts types for fatigue, recovery, ACWR, and injury risk. Environmental
// adjustments (heat, altitude) are computed post-build and attached per workout.
//
// AI REPLACEMENT HOOK: generateRichWeek() is the designated boundary for AI
// enhancement. A Claude API call can receive WorkoutEngineInput and return an
// identical RichWeek — adding personalized rationale, novel variants, and
// narrative coaching — without any changes to downstream components.

import type {
  WorkoutEngineInput, RichWeek, RichWorkout, RichWorkoutType,
  EnvironmentAdjustment, PaceRange,
} from '../types/workout';
import type { TrainingPhase, ProgressionLevel, TrainingStyle } from '../types/training';
import { buildPaceContext, buildRichWorkout, BuildContext } from './workoutBuilder';
import { applyAdaptiveModifiers } from './adaptiveModifier';
import { formatPace } from './calibrationEngine';

// ─── Phase intensity multipliers ──────────────────────────────────────────────

const PHASE_MULTIPLIER: Record<TrainingPhase, number> = {
  base:   0.70,
  build:  1.00,
  peak:   1.15,
  deload: 0.40,
  taper:  0.60,
};

// ─── 7-day week templates (Mon–Sun) ───────────────────────────────────────────
//
// Week 4 of every 4-week mesocycle block automatically falls back to
// DELOAD_OVERRIDE (unless the phase itself is already deload or taper).

const WEEK_TEMPLATES: Record<TrainingPhase, Record<ProgressionLevel, RichWorkoutType[]>> = {
  base: {
    beginner:     ['easy_run', 'strides',    'easy_run',  'rest',     'easy_run',  'long_run', 'recovery_run'],
    intermediate: ['easy_run', 'strides',    'threshold', 'easy_run', 'rest',      'long_run', 'recovery_run'],
    advanced:     ['easy_run', 'threshold',  'strides',   'easy_run', 'strides',   'long_run', 'recovery_run'],
  },
  build: {
    beginner:     ['easy_run', 'fartlek',    'easy_run',  'easy_run', 'rest',      'long_run', 'recovery_run'],
    intermediate: ['easy_run', 'threshold',  'easy_run',  'fartlek',  'rest',      'long_run', 'recovery_run'],
    advanced:     ['easy_run', 'vo2',        'easy_run',  'threshold','strides',   'long_run', 'recovery_run'],
  },
  peak: {
    beginner:     ['easy_run', 'tempo',      'easy_run',  'strides',  'rest',      'long_run',        'recovery_run'],
    intermediate: ['easy_run', 'vo2',        'easy_run',  'threshold','rest',      'progression_run', 'recovery_run'],
    advanced:     ['easy_run', 'vo2',        'easy_run',  'threshold','strides',   'progression_run', 'easy_run'],
  },
  deload: {
    beginner:     ['deload_session', 'mobility',       'deload_session', 'rest',      'easy_run',      'deload_session', 'rest'],
    intermediate: ['easy_run',       'mobility',       'deload_session', 'easy_run',  'rest',          'easy_run',       'rest'],
    advanced:     ['easy_run',       'deload_session', 'strides',        'easy_run',  'rest',          'deload_session', 'rest'],
  },
  taper: {
    beginner:     ['easy_run', 'taper_session', 'rest',    'taper_session', 'rest', 'taper_session', 'rest'],
    intermediate: ['easy_run', 'taper_session', 'strides', 'easy_run',      'rest', 'taper_session', 'rest'],
    advanced:     ['easy_run', 'taper_session', 'strides', 'threshold',     'rest', 'taper_session', 'easy_run'],
  },
};

// Applied when weekInBlock === 4 and phase is base/build/peak
const DELOAD_OVERRIDE: Record<ProgressionLevel, RichWorkoutType[]> = {
  beginner:     ['deload_session', 'mobility',       'rest',      'deload_session', 'rest', 'easy_run',      'rest'],
  intermediate: ['easy_run',       'deload_session', 'mobility',  'deload_session', 'rest', 'easy_run',      'rest'],
  advanced:     ['easy_run',       'deload_session', 'strides',   'easy_run',       'rest', 'deload_session','rest'],
};

// ─── Week-level scoring ────────────────────────────────────────────────────────

function computeWeekScore(workouts: RichWorkout[]): RichWeek['weekScore'] {
  let totalIntendedLoad    = 0;
  let intendedFatigueDelta = 0;
  let easy = 0, moderate = 0, hard = 0;

  for (const w of workouts) {
    totalIntendedLoad    += w.score.intendedLoad;
    intendedFatigueDelta += w.score.estimatedFatigueCost;
    const i = w.intensity;
    if (i === 'easy' || i === 'very_easy' || i === 'rest') easy++;
    else if (i === 'moderate') moderate++;
    else if (i === 'hard' || i === 'max') hard++;
  }

  const expectedAdaptations = [
    ...new Set(workouts.map(w => w.rationale.adaptation).filter(Boolean)),
  ];

  return {
    totalIntendedLoad:    Math.round(totalIntendedLoad),
    intendedFatigueDelta: Math.round(intendedFatigueDelta),
    intensityBalance:     { easy, moderate, hard },
    expectedAdaptations,
  };
}

// ─── Progression note + phase rationale ───────────────────────────────────────

const PHASE_RATIONALE: Record<TrainingPhase, string> = {
  base:   'Establishing aerobic base via 80/20 polarized distribution. High easy volume primes mitochondrial density before structured intensity is introduced.',
  build:  'Progressive intensity loading — threshold and VO2max sessions target lactate threshold elevation and maximal oxygen uptake improvement.',
  peak:   'Race-specific sharpening. Reduced volume concentrates quality; sessions mirror target race demands to maximise neuromuscular specificity.',
  deload: 'Planned recovery phase. Reduced load allows supercompensation: accumulated adaptations consolidate before the next build block.',
  taper:  'Pre-race taper. Maintaining intensity at sharply reduced volume preserves fitness while eliminating residual fatigue for peak performance.',
};

function buildProgressionNote(
  trainingPhase: TrainingPhase,
  weekInBlock:   number,
  currentWeek:   number,
): string {
  const blockLabel: Record<TrainingPhase, string> = {
    base:   'Base block — aerobic foundation',
    build:  'Build block — intensity loading',
    peak:   'Peak block — race sharpening',
    deload: 'Deload — recovery & supercompensation',
    taper:  'Taper — pre-race freshening',
  };
  const weekLabel = trainingPhase === 'deload' || trainingPhase === 'taper'
    ? `Week ${currentWeek}`
    : `Week ${currentWeek} (block week ${weekInBlock}/4)`;
  return `${weekLabel} · ${blockLabel[trainingPhase]}`;
}

// ─── Environment adjustment ────────────────────────────────────────────────────
//
// Heat:     Cheuvront & Haymes (2001) — ~1% per °C above 20°C, capped at 6%
// Altitude: Daniels & Gilbert        — ~3% per 1000m above sea level

function computeEnvAdjustment(
  paceRange:           PaceRange,
  durationMinutes:     number,
  temperatureCelsius?: number,
  altitudeMeters?:     number,
): EnvironmentAdjustment | undefined {
  if (temperatureCelsius === undefined && altitudeMeters === undefined) return undefined;

  let heatFactor = 1.0;
  let altFactor  = 1.0;
  const notes: string[] = [];

  if (temperatureCelsius !== undefined && temperatureCelsius > 20) {
    const penalty = Math.min(0.06, (temperatureCelsius - 20) * 0.01);
    heatFactor    = 1 + penalty;
    notes.push(`+${Math.round(penalty * 100)}% pace penalty for ${temperatureCelsius}°C`);
  }

  if (altitudeMeters !== undefined && altitudeMeters > 0) {
    const penalty = (altitudeMeters / 1000) * 0.03;
    altFactor     = 1 + penalty;
    notes.push(`+${Math.round(penalty * 100)}% altitude penalty at ${altitudeMeters}m`);
  }

  const combined          = heatFactor * altFactor;
  const durationReduction = temperatureCelsius !== undefined && temperatureCelsius > 28
    ? Math.round(durationMinutes * 0.10) : 0;

  return {
    applied:        combined > 1.0,
    heatFactor:     heatFactor > 1   ? heatFactor   : undefined,
    altitudeFactor: altFactor  > 1   ? altFactor    : undefined,
    adjustedPaceRange: combined > 1.0 ? {
      minSecPerMi: Math.round(paceRange.minSecPerMi * combined),
      maxSecPerMi: Math.round(paceRange.maxSecPerMi * combined),
    } : undefined,
    durationReduction: durationReduction > 0 ? durationReduction : undefined,
    note: notes.length > 0
      ? notes.join('; ')
      : 'No environmental adjustment applied.',
  };
}

// ─── Training style modifier ──────────────────────────────────────────────────
//
// Applied after adaptive modifiers. Reshapes session distribution to match the
// athlete's preferred training philosophy without changing volume or rest days.
//
//   polarized  — 80 % easy + high-intensity vo2; eliminate middle-ground tempo/threshold
//   threshold  — tempo/threshold emphasis; convert fartlek → threshold
//   base_only  — all quality replaced with easy aerobic work
//   mixed      — no change (default)

function applyTrainingStyle(
  types: RichWorkoutType[],
  style?: TrainingStyle,
): RichWorkoutType[] {
  if (!style || style === 'mixed') return types;
  return types.map(t => {
    switch (style) {
      case 'polarized':
        if (t === 'threshold' || t === 'tempo') return 'vo2';
        if (t === 'fartlek' || t === 'marathon_pace') return 'easy_run';
        return t;
      case 'threshold':
        if (t === 'fartlek') return 'threshold';
        if (t === 'vo2') return 'threshold';
        return t;
      case 'base_only':
        if (['vo2', 'threshold', 'tempo', 'fartlek', 'hill_repeats',
             'progression_run', 'strides'].includes(t)) return 'easy_run';
        return t;
      default:
        return t;
    }
  });
}

// ─── Helper exported for screens that need to rebuild a single day ─────────────

export function buildRichDay(
  richType:   RichWorkoutType,
  input:      WorkoutEngineInput,
  dayIndex:   number,
): RichWorkout {
  const weekInBlock  = ((input.currentWeek - 1) % 4) + 1;
  const isAutoDeload = weekInBlock === 4 &&
    input.trainingPhase !== 'deload' && input.trainingPhase !== 'taper';
  const multiplier   = isAutoDeload
    ? PHASE_MULTIPLIER['deload']!
    : PHASE_MULTIPLIER[input.trainingPhase];
  const paceCtx      = buildPaceContext(input.calibration, input.goalRace);
  const ctx: BuildContext = {
    paceCtx,
    mileage:          input.weeklyMileage,
    multiplier:       multiplier ?? 1.0,
    weekInBlock,
    trainingPhase:    input.trainingPhase,
    progressionLevel: input.progressionLevel,
    calibration:      input.calibration,
  };
  return buildRichWorkout(richType, ctx, dayIndex);
}

// ─── Main engine ───────────────────────────────────────────────────────────────

export function generateRichWeek(input: WorkoutEngineInput): RichWeek {
  const {
    calibration, trainingPhase, progressionLevel,
    weeklyMileage, currentWeek, goalRace,
    temperatureCelsius, altitudeMeters,
  } = input;

  const weekInBlock  = ((currentWeek - 1) % 4) + 1;
  const isAutoDeload = weekInBlock === 4 &&
    trainingPhase !== 'deload' && trainingPhase !== 'taper';

  const baseTemplate = isAutoDeload
    ? (DELOAD_OVERRIDE[progressionLevel] ?? DELOAD_OVERRIDE['intermediate'])
    : (WEEK_TEMPLATES[trainingPhase]?.[progressionLevel] ?? WEEK_TEMPLATES['base']!['intermediate']!);

  const adaptedTypes = applyAdaptiveModifiers(baseTemplate, input, weekInBlock);
  const styledTypes  = applyTrainingStyle(adaptedTypes, input.trainingStyle);

  const multiplier = isAutoDeload
    ? PHASE_MULTIPLIER['deload']!
    : PHASE_MULTIPLIER[trainingPhase] ?? 1.0;
  const paceCtx = buildPaceContext(calibration, goalRace);

  const ctx: BuildContext = {
    paceCtx,
    mileage:          weeklyMileage,
    multiplier,
    weekInBlock,
    trainingPhase,
    progressionLevel,
    calibration,
  };

  const workouts: RichWorkout[] = styledTypes.map((richType, dayIndex) => {
    const workout = buildRichWorkout(richType, ctx, dayIndex);
    const envAdj  = computeEnvAdjustment(
      workout.paceRange,
      workout.durationMinutes,
      temperatureCelsius,
      altitudeMeters,
    );
    return envAdj ? { ...workout, environmentAdjustment: envAdj } : workout;
  });

  return {
    workouts,
    weekScore:       computeWeekScore(workouts),
    progressionNote: buildProgressionNote(trainingPhase, weekInBlock, currentWeek),
    phaseRationale:  PHASE_RATIONALE[trainingPhase] ?? '',
    generatedAt:     Date.now(),
  };
}
