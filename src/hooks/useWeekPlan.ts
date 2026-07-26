// ─── useWeekPlan Hook ────────────────────────────────────────────────────────
//
// Single hook that collects all store state, computes derived signals, and
// calls buildWeekPlan() to produce the canonical WeekPlan for the current week.
//
// All UI screens (training, calendar, dashboard) read from this hook so they
// share a consistent plan without duplicating engine calls.
//
// Build 33: the plan is now date-anchored via trainingPlanStore + macroPlanner.
// `currentWeek`/`trainingPhase` no longer come from athleteStore — they're
// derived from the macro plan's current MacroWeek for today's date.
//
// STABILITY RULES — must obey to avoid infinite render loops:
//   1. Every useStore() call must use a selector that returns a STABLE reference
//      (primitive, or the exact same object/array reference from the store).
//      Never return a new object literal `{ a, b }` from a selector — that
//      always fails Object.is() and causes useSyncExternalStore to loop.
//   2. Do NOT write to any Zustand store from this hook or from effects that
//      depend on this hook's return value.
//   3. All derived objects must be wrapped in useMemo with stable dep arrays.

import { useMemo } from 'react';

import { useAthleteStore }      from '../store/athleteStore';
import { useOnboardingStore }   from '../store/onboardingStore';
import { useWorkoutStore }      from '../store/workoutStore';
import { useCheckInStore }      from '../store/checkInStore';
import { useStrengthStore }     from '../store/strengthStore';
import { useProfileStore }      from '../store/profileStore';
import { useTrainingPlanStore } from '../store/trainingPlanStore';
import { useBeginnerPlanStore } from '../store/beginnerPlanStore';
import { useActivityStore }     from '../store/activityStore';

import { calculateACWR, activitiesToACWRRecords } from '../utils/training';
import { getWeeklyMileage }                  from '../utils/historyUtils';
import { computeConsistency }                from '../utils/analyticsEngine';
import { buildMacroPlan, macroWeekForDate }  from '../utils/plan/macroPlanner';

import { buildWeekPlan }   from '../utils/trainingEngine';
import type { WeekPlan }   from '../utils/trainingEngine';
import { todayDateKey }    from '../types/checkin';

export function useWeekPlan(): WeekPlan {
  // ── Store reads — each selector returns a primitive or the store's own
  //    object/array reference, never a freshly-created object literal ──────
  const goalRace        = useAthleteStore(s => s.goalRace);
  const weeklyMileage   = useAthleteStore(s => s.weeklyMileage);
  const fatigueScore    = useAthleteStore(s => s.fatigueScore);
  const recoveryScore   = useAthleteStore(s => s.recoveryScore);
  const currentWeek     = useAthleteStore(s => s.currentWeek);
  const trainingPhase   = useAthleteStore(s => s.trainingPhase);
  const progressionLevel = useAthleteStore(s => s.progressionLevel);

  const onboardingData = useOnboardingStore(s => s.data);

  // ── Plan spine ────────────────────────────────────────────────────────────
  const goalType         = useTrainingPlanStore(s => s.goalType);
  const programStartDate = useTrainingPlanStore(s => s.programStartDate);
  const races            = useTrainingPlanStore(s => s.races);
  const activeBeginnerPlan = useBeginnerPlanStore(s => s.activePlan);

  // CRITICAL: separate selectors, never `s => ({ a: s.a, b: s.b })`.
  // That pattern creates a new object on every evaluation and causes
  // useSyncExternalStore's consistency check to loop infinitely.
  const completedWorkouts = useWorkoutStore(s => s.completedWorkouts);
  const history           = useWorkoutStore(s => s.history);

  const todayCheckIn = useCheckInStore(s => s.todayCheckIn);
  const checkedIn    = todayCheckIn?.date === todayDateKey();

  const strengthHistory     = useStrengthStore(s => s.history);
  const completedStrength   = useStrengthStore(s => s.completedSessions);

  const profile     = useProfileStore(s => s.getActiveProfile());
  const calibration = profile?.calibration ?? null;

  // ACWR is unified onto the normalized activity store (single source of
  // truth across all completion writers) rather than the legacy workout-store
  // history, which only ever saw running/strength completions logged through
  // that specific store.
  const activities = useActivityStore(s => s.activities);

  // ── Derived history signals (memoized on history) ─────────────────────
  const acwrResult = useMemo(
    () => calculateACWR(activitiesToACWRRecords(activities)),
    [activities],
  );

  const recentIntensityDist = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = history.filter(r => r.timestamp >= cutoff);
    let easy = 0, moderate = 0, hard = 0, total = 0;
    for (const r of recent) {
      total++;
      if (r.intensity === 'easy' || r.intensity === 'very_easy' || r.intensity === 'rest') easy++;
      else if (r.intensity === 'moderate') moderate++;
      else hard++;
    }
    if (total === 0) return { easy: 0.80, moderate: 0.10, hard: 0.10 };
    return { easy: easy / total, moderate: moderate / total, hard: hard / total };
  }, [history]);

  const recentHardSessions = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return history.filter(r =>
      r.timestamp >= cutoff && (r.intensity === 'hard' || r.intensity === 'max'),
    ).length;
  }, [history]);

  const weeksWithLongRun = useMemo(
    () => new Set(history.filter(r => r.type === 'long_run').map(r => r.week)).size,
    [history],
  );

  const longRunConsistency = currentWeek > 0 ? weeksWithLongRun / currentWeek : 0;
  const adherenceRate      = Math.min(1, history.length / Math.max(1, currentWeek * 6));

  const weeklySummaries = useMemo(() => getWeeklyMileage(history), [history]);
  const consistencyScore = useMemo(
    () => computeConsistency(weeklySummaries.map(s => s.totalMiles)),
    [weeklySummaries],
  );

  // ── Macro plan — date-anchored phase/week derivation ────────────────────
  const todayKey = todayDateKey();

  const macroPlan = useMemo(() => {
    if (!programStartDate) return null;
    return buildMacroPlan({
      goalType,
      startDate:     programStartDate,
      races,
      progressionLevel,
      yearsRunning:  onboardingData.yearsRunning,
      weeklyMileage: onboardingData.weeklyMileage,
    });
  }, [
    goalType, programStartDate, races, progressionLevel,
    onboardingData.yearsRunning, onboardingData.weeklyMileage,
  ]);

  const macroWeek = useMemo(() => {
    if (!macroPlan) return null;
    return macroWeekForDate(macroPlan, new Date());
    // todayKey deliberately included so this recomputes once per day even
    // though `new Date()` itself isn't a stable dependency.
  }, [macroPlan, todayKey]);

  // Strictly before the chosen start DATE — not just the start week's Sunday.
  // A Wednesday start must show nothing on Sunday–Tuesday of that same week.
  const beforeStart = !programStartDate || todayKey < programStartDate || !macroWeek;

  // ── Stable engine input — only recalculated when a real value changes ──
  const engineInput = useMemo(() => ({
    // Athlete state
    goalRace,
    weeklyMileage,
    fatigueScore,
    recoveryScore,
    currentWeek,
    trainingPhase,
    progressionLevel,

    // Plan spine
    goalType,
    macroWeek,
    beforeStart,
    programStartDate,
    races,
    activeBeginnerPlan,

    // Physiological profile
    calibration,
    fatigueSensitivity:     profile?.fatigueSensitivity     ?? 1.0,
    recoveryResponsiveness: profile?.recoveryResponsiveness ?? 1.0,
    returningFromInjury:    profile?.returningFromInjury    ?? false,

    // Onboarding preferences
    availableDays:    onboardingData.availableDays,
    runDays:          onboardingData.runDays?.length ? onboardingData.runDays : profile?.runDays,
    liftDays:         onboardingData.liftDays?.length ? onboardingData.liftDays : profile?.liftDays,
    trainingStyle:    onboardingData.trainingStyle,
    primaryGoal:      onboardingData.primaryGoal,
    hasCurrentInjury: onboardingData.hasCurrentInjury,
    strengthLevel:    onboardingData.strengthLevel,

    // Daily readiness
    soreness:   checkedIn ? (todayCheckIn?.soreness   ?? null) : null,
    motivation: checkedIn ? (todayCheckIn?.motivation ?? null) : null,

    // History signals
    acwr:                acwrResult.acwr,
    recentIntensityDist,
    recentHardSessions,
    adherenceRate,
    consistencyScore,
    longRunConsistency,

    // Completion keys
    completedWorkoutKeys:  completedWorkouts,
    completedStrengthKeys: completedStrength,

    // Strength history
    strengthHistory,
  }), [
    goalRace, weeklyMileage, fatigueScore, recoveryScore,
    currentWeek, trainingPhase, progressionLevel,
    goalType, macroWeek, beforeStart, programStartDate, races, activeBeginnerPlan,
    calibration, profile,
    onboardingData,
    checkedIn, todayCheckIn,
    acwrResult.acwr,
    recentIntensityDist, recentHardSessions,
    adherenceRate, consistencyScore, longRunConsistency,
    completedWorkouts, strengthHistory, completedStrength,
  ]);

  // ── Build and return the plan — re-runs only when engineInput changes ──
  return useMemo(() => buildWeekPlan(engineInput), [engineInput]);
}
