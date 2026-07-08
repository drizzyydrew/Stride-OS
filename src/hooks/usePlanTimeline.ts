// ─── usePlanTimeline Hook ────────────────────────────────────────────────────
//
// Thin wrapper around trainingPlanStore + macroPlanner for screens that need
// to look up the macro plan for ANY date (not just the current week, which
// useWeekPlan already covers). The calendar screen is the primary consumer —
// it needs phase/focus/race info for past and future weeks to render month
// and week views without regenerating a full rich week per day.

import { useMemo } from 'react';

import { useTrainingPlanStore } from '../store/trainingPlanStore';
import { useOnboardingStore }   from '../store/onboardingStore';
import { useAthleteStore }      from '../store/athleteStore';
import { buildMacroPlan, macroWeekForDate } from '../utils/plan/macroPlanner';
import type { MacroPlan, MacroWeek, Race, TrainingGoalType } from '../types/plan';

export type PlanTimeline = {
  goalType:         TrainingGoalType;
  programStartDate: string | null;
  races:            Race[];
  macroPlan:        MacroPlan | null;
  weekForDate:      (date: Date) => MacroWeek | null;
};

export function usePlanTimeline(): PlanTimeline {
  const goalType         = useTrainingPlanStore(s => s.goalType);
  const programStartDate = useTrainingPlanStore(s => s.programStartDate);
  const races            = useTrainingPlanStore(s => s.races);
  const progressionLevel = useAthleteStore(s => s.progressionLevel);
  const onboardingData   = useOnboardingStore(s => s.data);

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

  const weekForDate = useMemo(() => {
    return (date: Date) => macroPlan ? macroWeekForDate(macroPlan, date) : null;
  }, [macroPlan]);

  return { goalType, programStartDate, races, macroPlan, weekForDate };
}
