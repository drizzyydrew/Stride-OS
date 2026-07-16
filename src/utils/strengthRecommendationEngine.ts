// ─── Strength Recommendation Engine ───────────────────────────────────────────
//
// Generates context-aware strength focus recommendations based on:
//   - Athlete readiness (fatigue, recovery)
//   - Training phase and goal
//   - Injury history and movement findings
//   - Assessment results
//   - Running phase and proximity to race
//
// All logic is deterministic. No side effects.
// AI REPLACEMENT HOOK: replace this function body with a Claude call for
//   personalised periodized strength programming.

import type { StrengthFocus } from '../types/customWorkout';
import type { TrainingPhase } from '../types/training';
import type { AssessmentResult } from '../types/assessment';
import type { GoalType } from '../store/onboardingStore';

// ─── Input / Output ────────────────────────────────────────────────────────────

export type StrengthRecommendationInput = {
  fatigueScore:    number;       // 0–100
  recoveryScore:   number;       // 0–100
  trainingPhase:   TrainingPhase;
  weeklyMileage:   number;
  weeksToRace:     number;
  primaryGoal:     GoalType;
  strengthLevel:   'none' | 'beginner' | 'intermediate' | 'advanced';
  injuryFlags:     string[];     // e.g. ["knee", "hip"]
  assessmentFlags: string[];     // assessment_* flags from assessmentEngine
  movementFlags:   string[];     // movement risk flags from movementStore
  currentWeekday:  number;       // 0=Mon … 6=Sun (for scheduling)
};

export type StrengthRecommendation = {
  primaryFocus:      StrengthFocus;
  alternateFocus:    StrengthFocus;
  intensityLevel:    'low' | 'moderate' | 'high';
  sessionDurationMin: number;
  rationale:         string;
  loadGuidance:      string;
  avoidPatterns:     string[];    // movement patterns to skip today
  keyExercises:      string[];    // suggested exercise names
  warning?:          string;      // shown if fatigue or training stress is high
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHighFatigue(fatigue: number): boolean   { return fatigue > 70; }
function isPoorRecovery(recovery: number): boolean  { return recovery < 45; }

function hasKneeInjury(flags: string[]): boolean {
  return flags.some(f => f.includes('knee'));
}
function hasHipInjury(flags: string[]): boolean {
  return flags.some(f => f.includes('hip') || f.includes('it_band'));
}
function hasLowerLimbInjury(flags: string[]): boolean {
  return flags.some(f =>
    ['knee', 'hip', 'ankle', 'foot', 'shin', 'calf', 'hamstring',
     'quad', 'achilles', 'it_band'].some(term => f.includes(term)),
  );
}

function hasWeakCalf(assessFlags: string[]): boolean {
  return assessFlags.some(f => f.includes('calf_raise') || f.includes('soleus'));
}
function hasWeakHip(assessFlags: string[]): boolean {
  return assessFlags.some(f => f.includes('hip_abduction') || f.includes('bridge'));
}
function hasWeakCore(assessFlags: string[]): boolean {
  return assessFlags.some(f => f.includes('plank') || f.includes('side_plank'));
}

// ─── Main function ────────────────────────────────────────────────────────────

export function recommendStrengthFocus(
  input: StrengthRecommendationInput,
): StrengthRecommendation {
  const {
    fatigueScore, recoveryScore, trainingPhase,
    weeklyMileage, weeksToRace, primaryGoal,
    strengthLevel, injuryFlags, assessmentFlags, movementFlags,
  } = input;

  const allFlags    = [...injuryFlags, ...movementFlags];
  const highFatigue = isHighFatigue(fatigueScore);
  const poorRecovery = isPoorRecovery(recoveryScore);
  const isBeginnerAth = strengthLevel === 'none' || strengthLevel === 'beginner';
  const nearRace    = weeksToRace <= 3;

  let primaryFocus:   StrengthFocus = 'lower';
  let alternateFocus: StrengthFocus = 'core';
  let intensity:      'low' | 'moderate' | 'high' = 'moderate';
  let duration = 45;
  let rationale    = '';
  let loadGuidance = '';
  let avoidPatterns: string[] = [];
  let keyExercises:  string[] = [];
  let warning:       string | undefined;

  // ── Fatigue / recovery overrides ────────────────────────────────────────────

  if (highFatigue || poorRecovery) {
    primaryFocus   = 'mobility_prehab';
    alternateFocus = 'core';
    intensity      = 'low';
    duration       = 25;
    avoidPatterns  = ['heavy_lower', 'max_effort', 'plyometric'];
    warning        = 'High fatigue or poor recovery — keep loads light and focus on quality movement.';
    keyExercises   = ['Dead bug', 'Bird dog', 'Hip 90/90 stretch', 'Calf stretch', 'Foam rolling'];
    rationale      = 'Current readiness is low. Heavy loading during high fatigue may be harder to recover from. Mobility and lower-load work can maintain movement quality without adding as much systemic stress.';
    loadGuidance   = 'Bodyweight only. Focus on control, not effort. RPE should not exceed 5/10.';
    return { primaryFocus, alternateFocus, intensityLevel: intensity, sessionDurationMin: duration, rationale, loadGuidance, avoidPatterns, keyExercises, warning };
  }

  // ── Near-race taper ─────────────────────────────────────────────────────────

  if (nearRace || trainingPhase === 'taper') {
    primaryFocus   = 'mobility_prehab';
    alternateFocus = 'core';
    intensity      = 'low';
    duration       = 20;
    avoidPatterns  = ['heavy_lower', 'max_effort', 'plyometric', 'new_exercise'];
    keyExercises   = ['Band clamshells', 'Hip flexor stretch', 'Calf raises (light)', 'Dead bug'];
    rationale      = 'Taper phase: preserve fitness, avoid fatigue. Maintenance-only prehab keeps movement quality while allowing full supercompensation.';
    loadGuidance   = 'No new movements. Light bands and bodyweight only. Stop before any soreness.';
    return { primaryFocus, alternateFocus, intensityLevel: intensity, sessionDurationMin: duration, rationale, loadGuidance, avoidPatterns, keyExercises };
  }

  // ── Injury modifications ─────────────────────────────────────────────────────

  if (hasLowerLimbInjury(allFlags)) {
    const hasKnee = hasKneeInjury(allFlags);
    const hasHip  = hasHipInjury(allFlags);

    if (hasKnee) avoidPatterns.push('deep_squat', 'knee_dominant');
    if (hasHip)  avoidPatterns.push('high_load_hip', 'lateral_plyometric');

    primaryFocus   = 'upper';
    alternateFocus = 'core';
    intensity      = 'moderate';
    duration       = 40;
    keyExercises   = ['Push-up', 'Band pull-apart', 'Row', 'Dead bug', 'Side plank'];
    warning        = 'Lower limb injury flagged — upper body and core focus today. Consult physio before loading affected area.';
    rationale      = 'Lower limb injury present. Upper body and core work maintains strength and neuromuscular activation while protecting the injured area.';
    loadGuidance   = 'Moderate loads acceptable for upper body. Listen to body — stop if referred pain occurs.';
    return { primaryFocus, alternateFocus, intensityLevel: intensity, sessionDurationMin: duration, rationale, loadGuidance, avoidPatterns, keyExercises, warning };
  }

  // ── Assessment deficit targeting ──────────────────────────────────────────────

  const weakCalf = hasWeakCalf(assessmentFlags);
  const weakHip  = hasWeakHip(assessmentFlags);
  const weakCore = hasWeakCore(assessmentFlags);

  if (weakCalf) {
    keyExercises.push('Calf raise (loaded)', 'Soleus raise', 'Tibialis anterior raise');
    rationale = 'Assessment flagged lower calf/soleus capacity. Prioritize progressive loaded calf work and monitor symptoms and recovery.';
  }
  if (weakHip) {
    keyExercises.push('Side-lying hip abduction', 'Hip thrust', 'Copenhagen plank');
    if (!rationale) rationale = 'Assessment flagged hip weakness — common driver of knee pain and gait compensation in runners.';
  }
  if (weakCore) {
    primaryFocus = 'core';
    keyExercises.push('Dead bug', 'Pallof press', 'Side plank', 'Bird dog');
    if (!rationale) rationale = 'Assessment flagged core endurance deficit. Core stability supports running economy and spinal load management.';
  }

  // ── Phase-based defaults ──────────────────────────────────────────────────────

  switch (trainingPhase) {
    case 'base': {
      primaryFocus   = 'lower';
      alternateFocus = 'full_body';
      intensity      = isBeginnerAth ? 'low' : 'moderate';
      duration       = isBeginnerAth ? 35 : 50;
      if (!keyExercises.length) keyExercises = ['Bulgarian split squat', 'Romanian deadlift', 'Nordic curl', 'Step-up', 'Calf raise'];
      if (!rationale) rationale = 'Base phase: build foundational strength and connective tissue capacity. Full range, controlled tempo.';
      loadGuidance = 'RPE 6–8. Prioritize form over load. Eccentric emphasis (3-4 second lowering).';
      break;
    }
    case 'build': {
      primaryFocus   = 'lower';
      alternateFocus = 'power';
      intensity      = 'high';
      duration       = 50;
      if (!keyExercises.length) keyExercises = ['Barbell squat', 'Deadlift', 'Hip thrust', 'Nordic curl', 'Plyometric box jump'];
      if (!rationale) rationale = 'Build phase: translate base strength into power and running-specific force production.';
      loadGuidance = 'RPE 7–9. Progressive overload. Include explosive work if recovered.';
      break;
    }
    case 'peak': {
      primaryFocus   = 'lower';
      alternateFocus = 'tendon_capacity';
      intensity      = 'moderate';
      duration       = 40;
      avoidPatterns  = ['new_exercise', 'max_effort'];
      if (!keyExercises.length) keyExercises = ['Calf raise (heavy)', 'Split squat', 'Glute bridge', 'Core circuit'];
      if (!rationale) rationale = 'Peak phase: maintenance strength. Avoid soreness that disrupts quality running sessions.';
      loadGuidance = 'RPE 6–7. Maintain volume, reduce frequency if needed. Prioritize recovery.';
      break;
    }
    case 'deload': {
      primaryFocus   = 'mobility_prehab';
      alternateFocus = 'core';
      intensity      = 'low';
      duration       = 25;
      if (!keyExercises.length) keyExercises = ['Hip mobility', 'Foam roll', 'Band work', 'Light core'];
      if (!rationale) rationale = 'Deload week: active recovery only. Let soft tissue adapt before next loading block.';
      loadGuidance = 'RPE max 5. Bodyweight or bands only.';
      break;
    }
    default: {
      if (!keyExercises.length) keyExercises = ['Squat', 'Hip hinge', 'Core', 'Calf work'];
      if (!rationale) rationale = 'General strength maintenance for running health and economy.';
      loadGuidance = 'Moderate effort (RPE 6–8). Listen to your body.';
    }
  }

  // ── Goal modifiers ────────────────────────────────────────────────────────────

  if (primaryGoal === 'marathon' || primaryGoal === 'half_marathon') {
    if (!keyExercises.includes('Nordic curl')) keyExercises.push('Nordic curl');
    if (!keyExercises.includes('Single-leg calf raise')) keyExercises.push('Single-leg calf raise');
  } else if (primaryGoal === '5k' || primaryGoal === '10k') {
    if (!keyExercises.includes('Plyometric bound')) keyExercises.push('Plyometric bound');
    if (!keyExercises.includes('Hill sprint')) keyExercises.push('Hill sprint');
  }

  // ── Mileage load modifier ─────────────────────────────────────────────────────

  if (weeklyMileage > 50 && intensity === 'high') {
    intensity = 'moderate';  // reduce strength intensity at high mileage
    duration  = Math.min(duration, 45);
    warning   = 'High weekly mileage — strength intensity reduced to avoid excess systemic stress.';
  }

  return {
    primaryFocus,
    alternateFocus,
    intensityLevel:     intensity,
    sessionDurationMin: duration,
    rationale,
    loadGuidance,
    avoidPatterns,
    keyExercises:       keyExercises.slice(0, 6),
    warning,
  };
}
