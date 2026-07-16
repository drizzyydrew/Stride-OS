// ─── Adaptive Modifier ────────────────────────────────────────────────────────
//
// Adjusts the 7-day type template based on real-time athlete state signals.
// Called by workoutEngine.generateRichWeek() before building workouts.
//
// Priority order (highest wins): critical fatigue → critical recovery →
// high fatigue → poor recovery → workload spike → soreness → conservative adjustment →
// motivation → adherence → taper protection.
//
// AI REPLACEMENT HOOK: A future Claude layer can receive WorkoutEngineInput
// and return the same RichWorkoutType[] with contextual modifications —
// same contract, richer personalisation, zero downstream changes.

import type { RichWorkoutType, WorkoutEngineInput } from '../types/workout';

const HARD_TYPES: ReadonlySet<RichWorkoutType> = new Set([
  'threshold', 'tempo', 'vo2', 'hill_repeats', 'progression_run', 'fartlek',
]);

const MODERATE_TYPES: ReadonlySet<RichWorkoutType> = new Set([
  'marathon_pace', 'long_run', 'strides',
]);

// ─── Scenario handlers ────────────────────────────────────────────────────────

// 1. Critical fatigue: all hard → recovery_run, long_run → easy_run
function applyCriticalFatigue(types: RichWorkoutType[]): RichWorkoutType[] {
  return types.map(t => {
    if (HARD_TYPES.has(t))  return 'recovery_run';
    if (t === 'long_run')   return 'easy_run';
    return t;
  });
}

// 2. High fatigue: hard sessions → easy_run
function applyHighFatigue(types: RichWorkoutType[]): RichWorkoutType[] {
  return types.map(t => HARD_TYPES.has(t) ? 'easy_run' : t);
}

// 3. Critical recovery: vo2/threshold/tempo → easy_run, first easy → recovery_run
function applyCriticalRecovery(types: RichWorkoutType[]): RichWorkoutType[] {
  let result = types.map(t => {
    if (t === 'vo2' || t === 'threshold' || t === 'tempo') return 'easy_run';
    if (t === 'long_run') return 'easy_run';
    return t;
  });
  const firstEasy = result.findIndex(t => t === 'easy_run');
  if (firstEasy !== -1) result[firstEasy] = 'recovery_run';
  return result;
}

// 4. Poor recovery: downgrade the first hard session
function applyPoorRecovery(types: RichWorkoutType[]): RichWorkoutType[] {
  const result = [...types];
  const idx = result.findIndex(t => HARD_TYPES.has(t));
  if (idx !== -1) result[idx] = 'easy_run';
  return result;
}

// 5. ACWR spike (>1.5): remove hardest session; (>1.3): soften a moderate session
function applyAcwrSpike(types: RichWorkoutType[], acwr: number): RichWorkoutType[] {
  const result = [...types];
  if (acwr > 1.5) {
    const priority: RichWorkoutType[] = ['vo2', 'hill_repeats', 'threshold', 'tempo', 'progression_run', 'fartlek'];
    for (const target of priority) {
      const idx = result.indexOf(target);
      if (idx !== -1) { result[idx] = 'easy_run'; break; }
    }
  } else {
    const idx = result.findIndex(t => MODERATE_TYPES.has(t) && t !== 'long_run');
    if (idx !== -1) result[idx] = 'easy_run';
  }
  return result;
}

// 6. High soreness: high-impact sessions → recovery_run, other hard → easy_run
function applyHighSoreness(types: RichWorkoutType[]): RichWorkoutType[] {
  return types.map(t => {
    if (t === 'hill_repeats' || t === 'vo2' || t === 'strides') return 'recovery_run';
    if (HARD_TYPES.has(t)) return 'easy_run';
    return t;
  });
}

// 7. High training stress: hill_repeats → cross_training, vo2/strides → easy_run
function applyInjuryRisk(types: RichWorkoutType[]): RichWorkoutType[] {
  return types.map(t => {
    if (t === 'hill_repeats') return 'cross_training';
    if (t === 'vo2' || t === 'strides') return 'easy_run';
    return t;
  });
}

// 8. Low motivation + compromised recovery: hard → deload_session
function applyLowMotivation(types: RichWorkoutType[]): RichWorkoutType[] {
  return types.map(t => HARD_TYPES.has(t) ? 'deload_session' : t);
}

// 9. Too many recent hard sessions (3+): protect by dropping the next hard slot
function applyHardSessionCap(types: RichWorkoutType[]): RichWorkoutType[] {
  const result = [...types];
  const idx = result.findIndex(t => HARD_TYPES.has(t));
  if (idx !== -1) result[idx] = 'easy_run';
  return result;
}

// 10. Low adherence: simplify complex sessions so athlete can consistently execute
function applyLowAdherence(types: RichWorkoutType[]): RichWorkoutType[] {
  return types.map(t => {
    if (t === 'vo2' || t === 'progression_run') return 'fartlek';
    if (t === 'hill_repeats') return 'strides';
    return t;
  });
}

// 11. Taper protection: ensure no hard sessions leaked in via other modifiers
function applyTaperProtection(types: RichWorkoutType[]): RichWorkoutType[] {
  return types.map(t => {
    if (t === 'vo2' || t === 'threshold' || t === 'tempo' || t === 'progression_run') return 'taper_session';
    return t;
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function applyAdaptiveModifiers(
  template: RichWorkoutType[],
  input:    WorkoutEngineInput,
  _weekInBlock: number,
): RichWorkoutType[] {
  let types = [...template];

  const {
    fatigueScore, recoveryScore, soreness, motivation,
    acwr, injuryRisk, trainingPhase, progressionLevel,
    adherenceRate, recentHardSessions,
  } = input;

  // Fatigue gates (mutually exclusive — only the highest applies)
  if (fatigueScore > 85) {
    types = applyCriticalFatigue(types);
  } else if (fatigueScore > 75) {
    types = applyHighFatigue(types);
  }

  // Recovery gates (mutually exclusive)
  if (recoveryScore < 35) {
    types = applyCriticalRecovery(types);
  } else if (recoveryScore < 50) {
    types = applyPoorRecovery(types);
  }

  // ACWR load spike
  if (acwr > 1.3) {
    types = applyAcwrSpike(types, acwr);
  }

  // Soreness protection (independent of fatigue/recovery gates)
  if (soreness !== null && soreness >= 8) {
    types = applyHighSoreness(types);
  }

  // High training stress
  if (injuryRisk) {
    types = applyInjuryRisk(types);
  }

  // Motivational state (only when state is also compromised — avoids penalising
  // athletes who are simply feeling low but are physiologically ready)
  if (motivation !== null && motivation <= 3 && recoveryScore < 55) {
    types = applyLowMotivation(types);
  }

  // Hard-session cap from recent history
  if (recentHardSessions >= 3) {
    types = applyHardSessionCap(types);
  }

  // Low adherence: simplify for beginners and intermediates to build consistency
  if (adherenceRate < 0.4 && progressionLevel !== 'advanced') {
    types = applyLowAdherence(types);
  }

  // Taper protection (always applied last — ensures taper integrity survives above rules)
  if (trainingPhase === 'taper') {
    types = applyTaperProtection(types);
  }

  return types;
}
