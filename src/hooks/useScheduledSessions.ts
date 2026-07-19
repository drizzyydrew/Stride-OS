import { useMemo } from 'react';

import { useBeginnerPlanStore } from '../store/beginnerPlanStore';
import { toYMD } from '../utils/calendarEngine';
import {
  primarySessionForDate,
  scheduledSessionsForDate,
  scheduledSessionsForWeek,
} from '../utils/scheduledSessions';
import type { ScheduledSession } from '../utils/scheduledSessions';
import type { WeekPlan } from '../utils/trainingEngine';

export function useScheduledSessions(weekPlan: WeekPlan, now = new Date()) {
  const activeBeginnerPlan = useBeginnerPlanStore(state => state.activePlan);
  const todayYMD = toYMD(now);

  const weekSessions = useMemo(
    () => scheduledSessionsForWeek(weekPlan, activeBeginnerPlan, weekPlan.weekStartDate, now),
    [activeBeginnerPlan, now, weekPlan],
  );
  const todaySessions = useMemo(
    () => scheduledSessionsForDate(weekPlan, activeBeginnerPlan, todayYMD, now),
    [activeBeginnerPlan, now, todayYMD, weekPlan],
  );
  const todayPrimary = useMemo<ScheduledSession | null>(
    () => primarySessionForDate(todaySessions),
    [todaySessions],
  );

  return {
    activeBeginnerPlan,
    todayYMD,
    weekSessions,
    todaySessions,
    todayPrimary,
    sessionsForDate: (dateYMD: string) => scheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now),
  };
}
