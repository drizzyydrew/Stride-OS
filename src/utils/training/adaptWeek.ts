// ─── Adaptive Weekly Restructuring Engine ─────────────────────────────────────
//
// TRAINING THEORY BASIS
//
// The engine combines three well-established sports science frameworks:
//
// 1. ACUTE:CHRONIC WORKLOAD RATIO (Gabbett 2016)
//    ACWR > 1.3 → elevated injury risk; > 1.5 → high risk. The acute load (7-day
//    rolling average) has spiked relative to the chronic base (42-day average).
//    The engine restricts intensity to prevent further acute spike.
//
// 2. NON-FUNCTIONAL OVERREACHING (Meeusen et al. 2013)
//    Overreaching = performance plateau + high fatigue + mood disturbance + soreness.
//    Detection: fatigue > 70 + soreness ≥ 7 + low motivation. The engine recognises
//    this combination and mandates recovery work before hard sessions can resume.
//
// 3. PERIODIZATION INTEGRITY (Bompa 1999)
//    The long run is the #1 weekly aerobic stimulus in endurance training. Threshold
//    and VO2 sessions are "key quality" workouts that drive race-pace adaptation.
//    The engine protects these in priority order: long run > key quality > everything else.
//
// ADAPTATION SEVERITY TIERS
//
//   0 (none)     — no triggers active → plan unchanged
//   1 (mild)     — one mild signal → VO2 → threshold only
//   2 (moderate) — one moderate signal or two milds → hard sessions → easy
//   3 (severe)   — any severe signal or two moderates → hard → recovery/rest;
//                  long run → easy; recovery runs → rest
//
// SESSION PRIORITY (what's protected longest):
//   long_run > threshold > vo2 > strides > easy_run > recovery_run
//
// LONG RUN RULE:
//   Mild  → always protected (long run is too important to cut on mild signals)
//   Moderate + peak phase → protected (peak-phase long runs build race fitness)
//   Moderate + base/build → converted to easy_run
//   Severe → converted to easy_run (never full rest — aerobic base must be maintained)
//
// TAPER INTEGRITY:
//   During taper, all sessions are protected at severity < 3. The taper week's
//   reduced volume already accounts for accumulated fatigue.
//
// MISSED WORKOUT HANDLING:
//   A session is "missed" if it's uncompleted AND a later-indexed session WAS completed.
//   Missed sessions are NOT rescheduled — compressing missed work into remaining days
//   increases acute load and compounds recovery debt (the "make-up run" fallacy).
//   They are flagged in the summary card for athlete awareness.

import type {
  AdaptationContext,
  AdaptationResult,
  AdaptationTrigger,
  AdaptationEntry,
  AdaptationChangeType,
  AdaptationTriggerType,
} from '../../types/adaptation';
import type { GeneratableWorkoutType, TrainingPhase } from '../../types/training';

// ─── Workout ID map ───────────────────────────────────────────────────────────
//
// Maps GeneratableWorkoutType to the workout.id used in completion keys.
// Exported so screens can reconstruct keys without duplicating this table.

export const WORKOUT_ID: Record<GeneratableWorkoutType, string> = {
  recovery_run: 'recovery_run',
  easy_run:     'easy_run',
  long_run:     'long_run',
  threshold:    'threshold',
  vo2:          'vo2_intervals',
  strides:      'strides',
  rest:         'rest_day',
};

// Reverse map: workout.id → GeneratableWorkoutType
// Used to derive originalTypes from a generated TrainingWeek's plannedWorkouts.
export const ID_TO_GENERATABLE: Record<string, GeneratableWorkoutType> = {
  recovery_run: 'recovery_run',
  easy_run:     'easy_run',
  long_run:     'long_run',
  threshold:    'threshold',
  vo2_intervals:'vo2',
  strides:      'strides',
  rest_day:     'rest',
};

// ─── Trigger detection ────────────────────────────────────────────────────────

function completionKeyFor(
  week: number,
  type: GeneratableWorkoutType,
  index: number,
): string {
  return `w${week}_${WORKOUT_ID[type]}_${index}`;
}

function countMissed(
  originalTypes:     GeneratableWorkoutType[],
  completedWorkouts: string[],
  currentWeek:       number,
): number {
  const completedIdxs = originalTypes
    .map((t, i) => completedWorkouts.includes(completionKeyFor(currentWeek, t, i)) ? i : -1)
    .filter(i => i >= 0);
  if (completedIdxs.length === 0) return 0;

  const maxDone = Math.max(...completedIdxs);
  return originalTypes.filter((t, i) =>
    t !== 'rest' &&
    !completedWorkouts.includes(completionKeyFor(currentWeek, t, i)) &&
    i < maxDone,
  ).length;
}

function detectTriggers(ctx: AdaptationContext): AdaptationTrigger[] {
  const {
    fatigueScore, recoveryScore, soreness, acwr,
    trainingPhase, weekHistory, originalTypes,
    completedWorkouts, currentWeek,
  } = ctx;
  const s = soreness ?? 5;
  const triggers: AdaptationTrigger[] = [];

  // High fatigue
  if (fatigueScore > 80)
    triggers.push({ type: 'high_fatigue', severity: 'severe',
      description: `Fatigue ${fatigueScore}/100 — overreach threshold exceeded` });
  else if (fatigueScore > 70)
    triggers.push({ type: 'high_fatigue', severity: 'moderate',
      description: `Elevated fatigue: ${fatigueScore}/100` });
  else if (fatigueScore > 60)
    triggers.push({ type: 'high_fatigue', severity: 'mild',
      description: `Moderate fatigue accumulation: ${fatigueScore}/100` });

  // Low recovery
  if (recoveryScore < 40)
    triggers.push({ type: 'low_recovery', severity: 'severe',
      description: `Recovery critically suppressed: ${recoveryScore}/100` });
  else if (recoveryScore < 50)
    triggers.push({ type: 'low_recovery', severity: 'moderate',
      description: `Below recovery threshold: ${recoveryScore}/100` });
  else if (recoveryScore < 60)
    triggers.push({ type: 'low_recovery', severity: 'mild',
      description: `Suboptimal recovery: ${recoveryScore}/100` });

  // High ACWR
  if (acwr > 1.5)
    triggers.push({ type: 'high_acwr', severity: 'severe',
      description: `ACWR ${acwr.toFixed(2)} — acute load spike above 1.5 ceiling` });
  else if (acwr > 1.3)
    triggers.push({ type: 'high_acwr', severity: 'moderate',
      description: `ACWR ${acwr.toFixed(2)} — approaching elevated risk zone` });
  else if (acwr > 1.1)
    triggers.push({ type: 'high_acwr', severity: 'mild',
      description: `ACWR ${acwr.toFixed(2)} — slight load elevation` });

  // High soreness
  if (s >= 9)
    triggers.push({ type: 'high_soreness', severity: 'severe',
      description: `Soreness ${s}/10 — severe musculoskeletal stress` });
  else if (s >= 7)
    triggers.push({ type: 'high_soreness', severity: 'moderate',
      description: `Soreness ${s}/10 — elevated` });
  else if (s >= 5)
    triggers.push({ type: 'high_soreness', severity: 'mild',
      description: `Soreness ${s}/10 — moderate` });

  // Missed workouts
  const missed = countMissed(originalTypes, completedWorkouts, currentWeek);
  if (missed >= 3)
    triggers.push({ type: 'missed_workouts', severity: 'severe',
      description: `${missed} sessions missed this week` });
  else if (missed >= 2)
    triggers.push({ type: 'missed_workouts', severity: 'moderate',
      description: `${missed} sessions missed this week` });
  else if (missed >= 1)
    triggers.push({ type: 'missed_workouts', severity: 'mild',
      description: '1 session missed this week' });

  // Overreaching pattern: week's cumulative fatigue delta
  // A positive sum means more fatigue was added than removed this week.
  const weekFatigueDelta = weekHistory.reduce((sum, r) => sum + r.fatigueDelta, 0);
  if (weekFatigueDelta > 35)
    triggers.push({ type: 'overreaching_pattern', severity: 'moderate',
      description: `+${Math.round(weekFatigueDelta)} fatigue accumulated this week` });
  else if (weekFatigueDelta > 20)
    triggers.push({ type: 'overreaching_pattern', severity: 'mild',
      description: `+${Math.round(weekFatigueDelta)} fatigue delta — above optimal rate` });

  // Plan-mandated deload
  if (trainingPhase === 'deload')
    triggers.push({ type: 'plan_deload', severity: 'mild',
      description: 'Scheduled deload week in periodization plan' });

  return triggers;
}

// ─── Severity computation ─────────────────────────────────────────────────────
//
// Two moderate triggers compound to severe — the combined signal is more
// significant than any single moderate in isolation.

function computeSeverity(triggers: AdaptationTrigger[]): 0 | 1 | 2 | 3 {
  const hasSevere     = triggers.some(t => t.severity === 'severe');
  const moderateCount = triggers.filter(t => t.severity === 'moderate').length;
  const hasMild       = triggers.some(t => t.severity === 'mild');

  if (hasSevere || moderateCount >= 2) return 3;
  if (moderateCount === 1)             return 2;
  if (hasMild)                         return 1;
  return 0;
}

// ─── Completion analysis ──────────────────────────────────────────────────────

function analyzeCompletions(
  originalTypes:     GeneratableWorkoutType[],
  completedWorkouts: string[],
  currentWeek:       number,
): { completedIdxs: number[]; missedIdxs: number[] } {
  const completedIdxs = originalTypes
    .map((t, i) => completedWorkouts.includes(completionKeyFor(currentWeek, t, i)) ? i : -1)
    .filter(i => i >= 0);

  const maxDone = completedIdxs.length > 0 ? Math.max(...completedIdxs) : -1;

  const missedIdxs = originalTypes
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) =>
      t !== 'rest' &&
      !completedWorkouts.includes(completionKeyFor(currentWeek, t, i)) &&
      i < maxDone,
    )
    .map(({ i }) => i);

  return { completedIdxs, missedIdxs };
}

// ─── Per-day transformation ───────────────────────────────────────────────────

type TransformResult = {
  newType: GeneratableWorkoutType;
  change:  AdaptationChangeType;
  reason:  string;
};

const KEEP = (original: GeneratableWorkoutType): TransformResult => ({
  newType: original,
  change:  'as_planned',
  reason:  '',
});

function transformDay(
  original:  GeneratableWorkoutType,
  severity:  0 | 1 | 2 | 3,
  phase:     TrainingPhase,
): TransformResult {
  // Rest days are never modified
  if (original === 'rest') return KEEP(original);

  // No active triggers → no change
  if (severity === 0) return KEEP(original);

  // ── Taper integrity ────────────────────────────────────────────────────────
  // Taper weeks are already volume-reduced. Only intervene for severe overreach.
  if (phase === 'taper' && severity < 3) {
    return {
      newType: original,
      change:  'quality_protected',
      reason:  'Taper phase — session preserved to maintain leg sharpness before race day.',
    };
  }

  // ── Long run ───────────────────────────────────────────────────────────────
  // Highest-priority aerobic session. Protected at mild severity and in peak phase.
  if (original === 'long_run') {
    if (severity >= 3) return {
      newType: 'easy_run',
      change:  'long_run_reduced',
      reason:  'Severe physiological stress — long run converted to easy effort. Aerobic base maintained without compounding musculoskeletal damage.',
    };
    if (severity === 2 && phase !== 'peak') return {
      newType: 'easy_run',
      change:  'long_run_reduced',
      reason:  'Moderate overreach — long run shortened. Race-specific endurance resumed once recovery stabilises.',
    };
    // Mild or peak phase: always protect
    return {
      newType: original,
      change:  'quality_protected',
      reason:  'Long run preserved — highest-priority aerobic stimulus. Mild signals do not justify disrupting the week\'s key session.',
    };
  }

  // ── VO2 max intervals ──────────────────────────────────────────────────────
  // Highest-intensity session. Absorbing VO2 adaptation requires a fresh system.
  if (original === 'vo2') {
    if (severity >= 3) return {
      newType: 'recovery_run',
      change:  'converted_to_recovery',
      reason:  'Severe overreach — VO2 intervals removed. No high-intensity adaptation is possible under this fatigue load.',
    };
    if (severity === 2) return {
      newType: 'easy_run',
      change:  'converted_to_easy',
      reason:  'Moderate fatigue — VO2 replaced with easy aerobic work. High-intensity training on a suppressed system compounds cortisol and cytokine response.',
    };
    // Mild: downgrade to threshold — maintains quality stimulus at lower cost
    return {
      newType: 'threshold',
      change:  'intensity_downgrade',
      reason:  'Mild overreach — VO2 intervals downgraded to threshold pace. Quality aerobic stimulus preserved at lower physiological cost.',
    };
  }

  // ── Threshold run ──────────────────────────────────────────────────────────
  // Key lactate-threshold session. Protected at mild severity.
  if (original === 'threshold') {
    if (severity >= 3) return {
      newType: 'recovery_run',
      change:  'converted_to_recovery',
      reason:  'Severe overreach — threshold session removed. Lactate adaptation requires a fresh system; hard effort on high fatigue produces injury risk, not fitness.',
    };
    if (severity === 2) return {
      newType: 'easy_run',
      change:  'converted_to_easy',
      reason:  'Moderate overreach — threshold replaced with easy run. Hard efforts on a suppressed system compound existing fatigue without producing adaptation.',
    };
    // Mild: keep — threshold is too important to sacrifice on mild signals
    return KEEP(original);
  }

  // ── Strides ────────────────────────────────────────────────────────────────
  // Neuromuscular work. Short sessions but high CNS demand.
  if (original === 'strides') {
    if (severity >= 3) return {
      newType: 'recovery_run',
      change:  'converted_to_recovery',
      reason:  'Severe stress — strides removed. Neuromuscular recruitment under high fatigue increases injury risk with no adaptation benefit.',
    };
    if (severity === 2) return {
      newType: 'easy_run',
      change:  'converted_to_easy',
      reason:  'Moderate overreach — strides replaced with easy run. Speed work deferred until musculoskeletal stress resolves.',
    };
    return KEEP(original);
  }

  // ── Easy run ───────────────────────────────────────────────────────────────
  if (original === 'easy_run') {
    if (severity >= 3) return {
      newType: 'recovery_run',
      change:  'converted_to_recovery',
      reason:  'Severe overreach — easy run softened to recovery pace. Zone 2 aerobic blood flow preserved at minimal physiological cost.',
    };
    return KEEP(original);
  }

  // ── Recovery run ───────────────────────────────────────────────────────────
  if (original === 'recovery_run') {
    if (severity >= 3) return {
      newType: 'rest',
      change:  'inserted_rest',
      reason:  'Severe accumulated stress — recovery run replaced with full rest. Complete recovery is the training priority at this load.',
    };
    return KEEP(original);
  }

  return KEEP(original);
}

// ─── Summary builder ──────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<AdaptationTriggerType, string> = {
  high_fatigue:         'High Fatigue',
  low_recovery:         'Low Recovery',
  missed_workouts:      'Missed Sessions',
  high_acwr:            'Load Spike',
  high_soreness:        'High Soreness',
  overreaching_pattern: 'Overreaching',
  plan_deload:          'Scheduled Deload',
};

function buildSummary(
  appliedCount: number,
  triggers:     AdaptationTrigger[],
): string {
  if (appliedCount === 0) return 'Week is on track — no session changes needed.';

  const sorted  = [...triggers].sort((a, b) => {
    const r = { severe: 3, moderate: 2, mild: 1 } as const;
    return r[b.severity] - r[a.severity];
  });
  const primary = sorted[0];
  const driver  = primary ? TRIGGER_LABEL[primary.type] : 'training load signals';

  return appliedCount === 1
    ? `1 session adjusted — ${driver}.`
    : `${appliedCount} sessions adjusted — primary driver: ${driver}.`;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function adaptWeek(ctx: AdaptationContext): AdaptationResult {
  const {
    originalTypes, completedWorkouts, currentWeek,
    trainingPhase,
  } = ctx;

  const triggers  = detectTriggers(ctx);
  const severity  = computeSeverity(triggers);
  const { completedIdxs, missedIdxs } = analyzeCompletions(
    originalTypes, completedWorkouts, currentWeek,
  );

  const dayTypes: GeneratableWorkoutType[] = [];
  const entries:  AdaptationEntry[]        = [];

  for (let i = 0; i < originalTypes.length; i++) {
    const original    = originalTypes[i]!;
    const isCompleted = completedIdxs.includes(i);
    const isMissed    = missedIdxs.includes(i);

    if (isCompleted) {
      // Already done — never modify completed sessions
      dayTypes.push(original);
      entries.push({
        dayIndex: i, originalType: original, adaptedType: original,
        change: 'as_planned', reason: '',
      });
      continue;
    }

    if (isMissed) {
      // Past session that was skipped — flag but do not reschedule.
      // "Making up" missed hard sessions compresses load into fewer days,
      // raising acute-to-chronic ratio and injury risk.
      dayTypes.push(original);
      entries.push({
        dayIndex: i, originalType: original, adaptedType: original,
        change: 'as_planned',
        reason: 'Session missed — not rescheduled. Compressing missed work raises acute load without adequate recovery time.',
      });
      continue;
    }

    // Remaining (future) session: apply adaptive transformation
    const { newType, change, reason } = transformDay(original, severity, trainingPhase);
    dayTypes.push(newType);
    entries.push({ dayIndex: i, originalType: original, adaptedType: newType, change, reason });
  }

  const appliedCount = entries.filter(
    e => e.originalType !== e.adaptedType,
  ).length;

  return {
    dayTypes,
    originalTypes,
    entries,
    triggers,
    summary:     buildSummary(appliedCount, triggers),
    appliedCount,
    missedCount: missedIdxs.length,
  };
}
