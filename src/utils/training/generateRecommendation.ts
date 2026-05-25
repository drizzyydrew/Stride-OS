// ─── Adaptive Training Recommendation Engine ──────────────────────────────────
//
// Physiological model overview:
//
// READINESS SCORE (composite, 0–100)
//   Weighted blend of four independent signals:
//     Recovery (40%) — the primary readiness driver. Derived from sleep, HR delta,
//       and fatigue drag in calculateRecoveryScore.
//     Inverse fatigue (35%) — accumulated training stress suppresses capacity.
//     Inverse soreness (15%) — subjective musculoskeletal state. Defaults to the
//       midpoint (5/10) when no morning check-in exists so the engine still runs.
//     Motivation (10%) — psychological readiness. Low motivation is a validated
//       marker of non-functional overreaching (Meeusen et al., 2013).
//
// INTENSITY RECOMMENDATION
//   1. Base intensity rank from readiness score.
//   2. ACWR safety cap — Gabbett (2016): ACWR > 1.5 → cap at easy;
//      ACWR 1.3–1.5 → drop one rank.
//   3. Phase ceiling — deload ≤ easy; taper ≤ moderate.
//   4. Progression ceiling — beginner ≤ moderate.
//   Compare recommended rank to planned rank → derive adjustment label.
//
// DURATION SCALING
//   Planned duration × (readiness factor) × (phase factor), rounded to 5 min.
//   Always ≥ 15 min for non-rest recommendations.
//
// RECOVERY RECOMMENDATIONS
//   Triggered by discrete thresholds. Priority = worst signal.
//
// INJURY RISK
//   ACWR > 1.5 → high. ACWR > 1.3 OR fatigue > 70 → elevated.
//   Combined fatigue + soreness overreach per Meeusen (2013).
//
// DELOAD RECOMMENDATION
//   Any single mandatory/recommended condition is sufficient to flag.
//   Plan-mandated deload phase always shows as 'suggested' minimum.

import type { WorkoutIntensity, WorkoutType } from '../../types/training';
import type {
  RecommendationInput,
  TrainingRecommendation,
  IntensityRecommendation,
  RecoveryRecommendation,
  InjuryRiskWarning,
  DeloadRecommendation,
} from '../../types/recommendation';
import { calculateACWR } from './calculateACWR';

// ─── Intensity rank helpers ───────────────────────────────────────────────────

const INTENSITY_RANK: Record<WorkoutIntensity, number> = {
  rest:      0,
  very_easy: 1,
  easy:      2,
  moderate:  3,
  hard:      4,
  max:       5,
};

const RANK_TO_INTENSITY: WorkoutIntensity[] = [
  'rest', 'very_easy', 'easy', 'moderate', 'hard', 'max',
];

function clampIntensity(rank: number): WorkoutIntensity {
  return RANK_TO_INTENSITY[Math.max(0, Math.min(5, rank))]!;
}

// ─── Composite readiness ──────────────────────────────────────────────────────
//
// When soreness/motivation are null (athlete skipped check-in), we default to
// neutral mid-values so the engine still produces a useful recommendation. The
// UI notes that accuracy improves after check-in.

function computeReadiness(
  recoveryScore: number,
  fatigueScore:  number,
  soreness:      number | null,
  motivation:    number | null,
): number {
  const s = soreness   ?? 5;   // neutral: 5/10
  const m = motivation ?? 7;   // slightly above midpoint — most athletes train motivated

  const recoveryPart  = recoveryScore * 0.40;
  const fatiguePart   = (100 - fatigueScore) * 0.35;
  const sorenessPart  = ((11 - s) / 10) * 15;   // soreness=1 → 15pts; soreness=10 → 1.5pts
  const motivPart     = (m / 10) * 10;           // motivation=10 → 10pts; motivation=1 → 1pt

  return Math.max(0, Math.min(100, Math.round(
    recoveryPart + fatiguePart + sorenessPart + motivPart,
  )));
}

// ─── Intensity recommendation ─────────────────────────────────────────────────

function buildIntensityRec(
  readiness:        number,
  fatigueScore:     number,
  trainingPhase:    RecommendationInput['trainingPhase'],
  progressionLevel: RecommendationInput['progressionLevel'],
  plannedIntensity: WorkoutIntensity,
  plannedType:      WorkoutType,
  plannedDuration:  number,
  acwr:             number,
): IntensityRecommendation {
  // 1. Base rank from composite readiness
  let rank =
    readiness >= 78 ? 4 :   // hard
    readiness >= 60 ? 3 :   // moderate
    readiness >= 40 ? 2 :   // easy
    readiness >= 20 ? 1 :   // very_easy
    0;                      // rest

  // 2. ACWR safety constraints
  if (acwr > 1.5)      rank = Math.min(rank, 2);            // cap at easy
  else if (acwr > 1.3) rank = Math.max(0, rank - 1);        // drop one level

  // 3. Phase ceiling
  if (trainingPhase === 'deload') rank = Math.min(rank, 2); // ≤ easy
  if (trainingPhase === 'taper')  rank = Math.min(rank, 3); // ≤ moderate

  // 4. Progression ceiling (beginners shouldn't be doing max-intensity work)
  if (progressionLevel === 'beginner') rank = Math.min(rank, 3); // ≤ moderate

  rank = Math.max(0, rank);
  const recommendedIntensity = clampIntensity(rank);

  // 5. Duration scaling
  const durationFactor =
    readiness >= 78 ? 1.00 :
    readiness >= 60 ? 0.90 :
    readiness >= 40 ? 0.75 :
    0.60;

  const phaseFactor =
    trainingPhase === 'deload' ? 0.70 :
    trainingPhase === 'taper'  ? 0.80 :
    1.00;

  const effectiveFactor = Math.min(durationFactor, phaseFactor);
  const rawDuration     = plannedDuration * effectiveFactor;
  // Round to nearest 5 min; floor to 15 min for any non-rest session
  const recommendedDurationMinutes = rank === 0
    ? 0
    : Math.max(15, Math.round(rawDuration / 5) * 5);

  // 6. Adjustment label (compare recommended rank to planned rank)
  const plannedRank = INTENSITY_RANK[plannedIntensity];

  const adjustmentFromPlan: IntensityRecommendation['adjustmentFromPlan'] =
    rank === 0 && plannedRank > 0          ? 'swap_to_rest' :
    rank <= 2  && plannedRank >= 4         ? 'swap_to_easy' :
    rank < plannedRank                     ? 'scale_down'   :
    rank > plannedRank && fatigueScore < 30 ? 'scale_up'   :
    'as_planned';

  const rationale = buildRationale(
    readiness, acwr, trainingPhase, fatigueScore, plannedType, adjustmentFromPlan,
  );

  return {
    recommendedIntensity,
    recommendedDurationMinutes,
    adjustmentFromPlan,
    rationale,
  };
}

function buildRationale(
  readiness:   number,
  acwr:        number,
  phase:       RecommendationInput['trainingPhase'],
  fatigue:     number,
  plannedType: WorkoutType,
  adjustment:  IntensityRecommendation['adjustmentFromPlan'],
): string {
  if (adjustment === 'swap_to_rest') {
    return 'Readiness is critically low. A full rest day now prevents a multi-day setback later.';
  }
  if (acwr > 1.5) {
    return `Training load has spiked — ACWR ${acwr.toFixed(2)} is above the 1.5 injury-risk ceiling. Back off to protect soft tissue.`;
  }
  if (acwr > 1.3) {
    return `Acute load ratio is elevated (${acwr.toFixed(2)}). Dropping one intensity level keeps you in the optimal 0.8–1.3 training zone.`;
  }
  if (phase === 'deload') {
    return 'Deload week — cut volume ~30% and keep intensity low. Adaptation happens during recovery, not loading.';
  }
  if (phase === 'taper') {
    return 'Taper phase — keep legs fresh with controlled efforts. Quality over quantity heading into race week.';
  }
  if (fatigue > 70) {
    return `Fatigue score is ${fatigue}/100. Backing off now converts accumulated stress into measurable fitness gains.`;
  }
  if (adjustment === 'swap_to_easy') {
    return 'Multiple suppressed signals. Swap the hard session for easy aerobic work — the fitness will still be there tomorrow.';
  }
  if (readiness >= 78) {
    return 'All signals are green. You are primed for a quality training stimulus today.';
  }
  if (readiness >= 60) {
    return 'Good readiness. Complete the session at a controlled effort — avoid pushing to max.';
  }
  return 'Moderate readiness. Keep effort comfortable and prioritize form over pace.';
}

// ─── Recovery recommendation ──────────────────────────────────────────────────
//
// Actions are triggered by discrete thresholds. We collect all that apply,
// then keep the most important three. Priority is set by the worst signal.

function buildRecoveryRec(
  recoveryScore: number,
  fatigueScore:  number,
  soreness:      number | null,
  motivation:    number | null,
  acwr:          number,
): RecoveryRecommendation {
  const s = soreness   ?? 5;
  const m = motivation ?? 7;

  const actions: string[] = [];

  if (recoveryScore < 50)         actions.push('Prioritize 8+ hours of sleep tonight');
  if (fatigueScore > 70)          actions.push('Allow 48h between hard sessions — fitness is built during rest');
  if (fatigueScore > 55)          actions.push('Add a 10-min easy walk or light mobility session today');
  if (s >= 8)                     actions.push('High soreness needs blood flow — gentle movement, no impact');
  else if (s >= 6)                actions.push('Warm up for 10+ min before any intensity work today');
  if (m <= 3)                     actions.push('Low motivation often signals accumulated stress — trust the rest');
  if (acwr > 1.3)                 actions.push('Reduce training load before ramping volume again');
  if (recoveryScore < 40)         actions.push('Consider foam rolling, compression, or cold-water immersion');

  const unique  = [...new Set(actions)].slice(0, 3);
  if (unique.length === 0) unique.push('Continue current recovery habits — they are working well');

  const priority: RecoveryRecommendation['priority'] =
    recoveryScore < 35 || fatigueScore > 80 || s >= 9 ? 'critical' :
    recoveryScore < 50 || fatigueScore > 70 || s >= 7 ? 'high'     :
    recoveryScore < 65 || fatigueScore > 55 || s >= 5 ? 'moderate' :
    'low';

  return { priority, actions: unique };
}

// ─── Injury risk warning ──────────────────────────────────────────────────────
//
// Triggers are surfaced as readable strings — the athlete can see exactly why
// the flag was raised without needing to interpret raw numbers.

function buildInjuryRisk(
  fatigueScore: number,
  soreness:     number | null,
  motivation:   number | null,
  acwr:         number,
): InjuryRiskWarning {
  const s = soreness   ?? 5;
  const m = motivation ?? 7;

  const triggers: string[] = [];

  if (acwr > 1.5)
    triggers.push(`ACWR ${acwr.toFixed(2)} — acute load spike above the 1.5 safe ceiling`);
  else if (acwr > 1.3)
    triggers.push(`ACWR ${acwr.toFixed(2)} — approaching elevated risk zone (ceiling: 1.3)`);

  if (fatigueScore > 80)
    triggers.push(`Cumulative fatigue ${fatigueScore}/100 — overreach threshold exceeded`);
  else if (fatigueScore > 70)
    triggers.push(`Elevated fatigue score: ${fatigueScore}/100`);

  if (s >= 8 && fatigueScore > 60)
    triggers.push('High soreness + high fatigue — validated non-functional overreaching signal');
  else if (s >= 8)
    triggers.push(`Soreness ${s}/10 — significant musculoskeletal stress`);

  if (m <= 2)
    triggers.push('Critically low motivation — a recognized non-functional overreaching marker');

  const level: InjuryRiskWarning['level'] =
    acwr > 1.5 || (fatigueScore > 80 && s >= 7)          ? 'high'     :
    acwr > 1.3 || fatigueScore > 70 || (s >= 7 && m <= 3) ? 'elevated' :
    'none';

  const advice =
    level === 'high'     ? 'Skip or heavily reduce today\'s session. No training stimulus is worth the injury risk at this point.' :
    level === 'elevated' ? 'Scale back intensity and duration. A quality easy effort is worth more than grinding through a hard session.' :
    'No significant risk factors detected. Train as planned.';

  return { level, triggers, advice };
}

// ─── Deload recommendation ────────────────────────────────────────────────────
//
// Deload urgency is derived from the worst combination of signals:
//   mandatory   → dangerous fatigue/recovery extremes or very high ACWR
//   recommended → clear overreaching indicators
//   suggested   → early warning signals or plan-mandated deload phase
//   none        → no action needed

function buildDeloadRec(
  fatigueScore:  number,
  recoveryScore: number,
  trainingPhase: RecommendationInput['trainingPhase'],
  acwr:          number,
  soreness:      number | null,
): DeloadRecommendation {
  const s = soreness ?? 5;

  const isMandatory   = (fatigueScore > 80 && recoveryScore < 35) || acwr > 1.7;
  const isRecommended = !isMandatory && ((fatigueScore > 70 && recoveryScore < 45) || acwr > 1.5);
  const isSuggested   = !isMandatory && !isRecommended && (
    fatigueScore > 60 || acwr > 1.3 || trainingPhase === 'deload' || (s >= 8 && fatigueScore > 55)
  );

  const urgency: DeloadRecommendation['urgency'] =
    isMandatory   ? 'mandatory'   :
    isRecommended ? 'recommended' :
    isSuggested   ? 'suggested'   :
    'none';

  const shouldDeload = urgency !== 'none';

  const rationale =
    urgency === 'mandatory'   ? `Fatigue (${fatigueScore}/100) and recovery (${recoveryScore}/100) are at dangerous extremes. A deload is non-negotiable.` :
    urgency === 'recommended' ? `Accumulated load (fatigue: ${fatigueScore}/100, ACWR: ${acwr.toFixed(2)}) indicates a lower-volume week is needed to supercompensate.` :
    urgency === 'suggested'   ? (trainingPhase === 'deload'
      ? 'Your plan calls for a deload week. Reduce volume ~30% and hold intensity low.'
      : 'Early deload indicators present. Consider a lighter week before load increases further.')  :
    'No deload needed — current training load is within sustainable limits.';

  return { shouldDeload, urgency, rationale };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function generateRecommendation(input: RecommendationInput): TrainingRecommendation {
  const {
    recoveryScore, fatigueScore,
    trainingPhase, progressionLevel,
    soreness, motivation,
    plannedIntensity, plannedType, plannedDuration,
    history,
  } = input;

  const { acwr } = calculateACWR(history);

  const readinessScore = computeReadiness(recoveryScore, fatigueScore, soreness, motivation);

  const overallReadiness: TrainingRecommendation['overallReadiness'] =
    readinessScore >= 75 ? 'peak' :
    readinessScore >= 55 ? 'good' :
    readinessScore >= 35 ? 'fair' :
    'poor';

  const intensity  = buildIntensityRec(
    readinessScore, fatigueScore,
    trainingPhase, progressionLevel,
    plannedIntensity, plannedType, plannedDuration,
    acwr,
  );

  const recovery   = buildRecoveryRec(recoveryScore, fatigueScore, soreness, motivation, acwr);
  const injuryRisk = buildInjuryRisk(fatigueScore, soreness, motivation, acwr);
  const deload     = buildDeloadRec(fatigueScore, recoveryScore, trainingPhase, acwr, soreness);

  return { readinessScore, overallReadiness, intensity, recovery, injuryRisk, deload };
}
