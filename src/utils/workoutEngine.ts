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
  foundation: 0.55,
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
  foundation: {
    beginner:     ['run_walk', 'rest',      'run_walk', 'rest',      'run_walk', 'easy_run', 'rest'],
    intermediate: ['run_walk', 'mobility',  'run_walk', 'rest',      'run_walk', 'easy_run', 'rest'],
    advanced:     ['run_walk', 'mobility',  'run_walk', 'rest',      'run_walk', 'easy_run', 'rest'],
  },
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
  foundation: 'Building the aerobic engine from the ground up. Run/walk intervals let tendons, bones, and the cardiovascular system adapt gradually — the safest, most durable way to start a running habit before any structured intensity is introduced.',
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
    foundation: 'Foundation — building the habit',
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

// ─── Beginner / foundation safety filter ──────────────────────────────────────
//
// Two independent guards:
//   1. Foundation phase, or a beginner in base phase, is not ready for any
//      threshold-or-harder quality — everything downgrades to easy_run,
//      except the first offender in base phase becomes strides (a small,
//      low-risk taste of quality rather than pure easy running).
//   2. Beginners never get vo2/hill_repeats in ANY phase — those convert to
//      the gentler fartlek in build/peak (still some speed stimulus) or
//      easy_run everywhere else.

const QUALITY_OFFENDERS: RichWorkoutType[] = [
  'vo2', 'hill_repeats', 'tempo', 'threshold', 'progression_run', 'fartlek',
];

export function applyExperienceSafety(
  types:            RichWorkoutType[],
  progressionLevel: ProgressionLevel,
  phase:            TrainingPhase,
): RichWorkoutType[] {
  let result = [...types];

  const gatePhase = phase === 'foundation' || (progressionLevel === 'beginner' && phase === 'base');
  if (gatePhase) {
    let firstHandled = false;
    result = result.map(t => {
      if (!QUALITY_OFFENDERS.includes(t)) return t;
      if (!firstHandled) {
        firstHandled = true;
        return phase === 'base' ? 'strides' : 'easy_run';
      }
      return 'easy_run';
    });
  }

  if (progressionLevel === 'beginner') {
    const gentler = phase === 'build' || phase === 'peak';
    result = result.map(t => {
      if (t === 'vo2' || t === 'hill_repeats') return gentler ? 'fartlek' : 'easy_run';
      return t;
    });
  }

  return result;
}

function limitRunDays(types: RichWorkoutType[], desiredRunDays?: number): RichWorkoutType[] {
  if (!desiredRunDays || desiredRunDays >= types.filter(t => t !== 'rest' && t !== 'mobility').length) {
    return types;
  }

  const keepPriority: Partial<Record<RichWorkoutType, number>> = {
    long_run: 100,
    progression_run: 90,
    threshold: 85,
    tempo: 80,
    vo2: 78,
    fartlek: 74,
    hill_repeats: 72,
    marathon_pace: 70,
    easy_run: 55,
    strides: 50,
    recovery_run: 40,
    deload_session: 35,
    taper_session: 35,
    cross_training: 25,
  };

  const candidates = types
    .map((type, index) => ({ type, index, priority: keepPriority[type] ?? 0 }))
    .filter(item => item.type !== 'rest' && item.type !== 'mobility')
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .slice(0, Math.max(1, desiredRunDays));

  const keepIndexes = new Set(candidates.map(item => item.index));
  return types.map((type, index) => keepIndexes.has(index) ? type : 'rest');
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

// ─── Baseline template lookup ─────────────────────────────────────────────────
//
// Exposes the raw phase/level template (before adaptive modifiers, style, and
// safety filtering) so trainingEngine.ts can diff it against the final week
// and surface human-readable adaptation notes ("Downgraded Tuesday...").

// Lighter-weight variant taking explicit phase/level/weekInBlock — used by the
// calendar screen to preview future/past weeks without assembling a full
// WorkoutEngineInput (titles only, no rich generation).
export function getPhaseTypesForWeek(
  phase:            TrainingPhase,
  progressionLevel: ProgressionLevel,
  weekInBlock:       number,
): RichWorkoutType[] {
  const isAutoDeload = weekInBlock === 4 && phase !== 'deload' && phase !== 'taper';
  return isAutoDeload
    ? (DELOAD_OVERRIDE[progressionLevel] ?? DELOAD_OVERRIDE['intermediate'])
    : (WEEK_TEMPLATES[phase]?.[progressionLevel] ?? WEEK_TEMPLATES['base']!['intermediate']!);
}

export function getBaseTemplate(input: WorkoutEngineInput): RichWorkoutType[] {
  const weekInBlock = ((input.currentWeek - 1) % 4) + 1;
  return getPhaseTypesForWeek(input.trainingPhase, input.progressionLevel, weekInBlock);
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
  const safeTypes     = applyExperienceSafety(styledTypes, progressionLevel, trainingPhase);
  const plannedTypes = limitRunDays(safeTypes, input.runDays?.length);

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

  const workouts: RichWorkout[] = plannedTypes.map((richType, dayIndex) => {
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
