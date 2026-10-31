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
import { useGoalArchiveStore } from '../store/goalArchiveStore';
import { toYMD } from '../utils/calendarEngine';
import { calendarRacesForPlan } from '../utils/goalLifecycle';
import { buildMacroPlan, macroWeekForDate } from '../utils/plan/macroPlanner';
import type { MacroPlan, MacroWeek, Race, TrainingGoalType } from '../types/plan';

export type PlanTimeline = {
  goalType:         TrainingGoalType;
  programStartDate: string | null;
  races:            Race[];
  macroPlan:        MacroPlan | null;
  trainingMode: 'structured' | 'open';
  weekForDate:      (date: Date) => MacroWeek | null;
};

export function usePlanTimeline(): PlanTimeline {
  const goalType         = useTrainingPlanStore(s => s.goalType);
  const programStartDate = useTrainingPlanStore(s => s.programStartDate);
  const races            = useTrainingPlanStore(s => s.races);
  const goalRaceId       = useTrainingPlanStore(s => s.goalRaceId);
  const trainingMode = useTrainingPlanStore(s => s.trainingMode);
  const archives = useGoalArchiveStore(s => s.archives);
  const progressionLevel = useAthleteStore(s => s.progressionLevel);
  const onboardingData   = useOnboardingStore(s => s.data);
  const calendarRaces = useMemo(() => calendarRacesForPlan({ trainingMode, goalType, goalRaceId, programStartDate }, races, archives),
    [trainingMode, goalType, goalRaceId, programStartDate, races, archives]);
  const activeRaces = useMemo(() => calendarRaces.filter(race => !goalRaceId || race.id === goalRaceId), [calendarRaces, goalRaceId]);

  const macroPlan = useMemo(() => {
    if (!programStartDate) return null;
    return buildMacroPlan({
      goalType,
      startDate:     programStartDate,
      races: activeRaces,
      progressionLevel,
      yearsRunning:  onboardingData.yearsRunning,
      weeklyMileage: onboardingData.weeklyMileage,
    });
  }, [
    goalType, programStartDate, activeRaces, progressionLevel,
    onboardingData.yearsRunning, onboardingData.weeklyMileage,
  ]);

  const weekForDate = useMemo(() => {
    return (date: Date) => {
      const day = toYMD(date);
      if (trainingMode === 'structured' && programStartDate && day >= programStartDate && macroPlan) {
        return macroWeekForDate(macroPlan, date);
      }
      const archived = archives.find(archive => archive.startDate <= day && archive.endDate >= day && archive.macroPlan);
      if (archived?.macroPlan) return macroWeekForDate(archived.macroPlan, date);
      if (trainingMode === 'open') return null;
      return macroPlan ? macroWeekForDate(macroPlan, date) : null;
    };
  }, [macroPlan, trainingMode, archives, programStartDate]);

  return { goalType, programStartDate, races: calendarRaces, macroPlan, trainingMode, weekForDate };
}
