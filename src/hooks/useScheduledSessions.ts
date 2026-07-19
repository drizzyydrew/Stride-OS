import { useMemo } from 'react';

import { useBeginnerPlanStore } from '../store/beginnerPlanStore';
import { useScheduledSessionSelectionStore } from '../store/scheduledSessionSelectionStore';
import { toYMD } from '../utils/calendarEngine';
import {
  activeScheduledSessionsForDate,
  getPrimarySessionForDate,
  getScheduledRunForDate,
  getScheduledSessionsForDate,
  getScheduledStrengthForDate,
  primarySessionForDate,
  scheduledSessionsForDate,
  scheduledSessionsForWeek,
  getSessionById,
  getSupportingSessionsForDate,
} from '../utils/scheduledSessions';
import type { ScheduledSession } from '../utils/scheduledSessions';
import type { WeekPlan } from '../utils/trainingEngine';

export function useScheduledSessions(weekPlan: WeekPlan, now = new Date()) {
  const activeBeginnerPlan = useBeginnerPlanStore(state => state.activePlan);
  const selectedByDate = useScheduledSessionSelectionStore(state => state.selectedByDate);
  const removedFromToday = useScheduledSessionSelectionStore(state => state.removedFromToday);
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
  const activeTodaySessions = useMemo(
    () => activeScheduledSessionsForDate(
      todaySessions,
      weekSessions,
      todayYMD,
      selectedByDate[todayYMD],
      Object.keys(removedFromToday)
        .filter(key => key.startsWith(`${todayYMD}:`))
        .map(key => key.slice(todayYMD.length + 1)),
    ),
    [removedFromToday, selectedByDate, todaySessions, todayYMD, weekSessions],
  );
  const activeTodayPrimary = useMemo<ScheduledSession | null>(
    () => primarySessionForDate(activeTodaySessions),
    [activeTodaySessions],
  );

  return {
    activeBeginnerPlan,
    todayYMD,
    weekSessions,
    todaySessions,
    todayPrimary,
    activeTodaySessions,
    activeTodayPrimary,
    todayRun: getScheduledRunForDate(todaySessions),
    activeTodayRun: getScheduledRunForDate(activeTodaySessions),
    todayStrength: getScheduledStrengthForDate(todaySessions),
    activeTodayStrength: getScheduledStrengthForDate(activeTodaySessions),
    todaySupporting: getSupportingSessionsForDate(todaySessions),
    sessionsForDate: (dateYMD: string) => scheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now),
    getScheduledSessionsForDate: (dateYMD: string) => getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now),
    getPrimarySessionForDate: (dateYMD: string) => getPrimarySessionForDate(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now)),
    getSupportingSessionsForDate: (dateYMD: string) => getSupportingSessionsForDate(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now)),
    getScheduledRunForDate: (dateYMD: string) => getScheduledRunForDate(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now)),
    getScheduledStrengthForDate: (dateYMD: string) => getScheduledStrengthForDate(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now)),
    getSessionById: (scheduledSessionId: string) => getSessionById(weekSessions, scheduledSessionId),
  };
}
