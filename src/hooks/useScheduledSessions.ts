import { useMemo } from 'react';

import { useBeginnerPlanStore } from '../store/beginnerPlanStore';
import { useActivityStore } from '../store/activityStore';
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
import {
  getCompletedActivityForScheduledSession,
  overlayCompletionOnScheduledSessions,
  plannedVersusCompletedComparison,
} from '../utils/activityCompletion';
import type { ScheduledSession } from '../utils/scheduledSessions';
import type { WeekPlan } from '../utils/trainingEngine';

export function useScheduledSessions(weekPlan: WeekPlan, now = new Date()) {
  const activeBeginnerPlan = useBeginnerPlanStore(state => state.activePlan);
  const activities = useActivityStore(state => state.activities);
  const selectedByDate = useScheduledSessionSelectionStore(state => state.selectedByDate);
  const removedFromToday = useScheduledSessionSelectionStore(state => state.removedFromToday);
  const todayYMD = toYMD(now);

  const weekSessions = useMemo(
    () => overlayCompletionOnScheduledSessions(
      scheduledSessionsForWeek(weekPlan, activeBeginnerPlan, weekPlan.weekStartDate, now),
      activities,
    ),
    [activeBeginnerPlan, activities, now, weekPlan],
  );
  const todaySessions = useMemo(
    () => overlayCompletionOnScheduledSessions(
      scheduledSessionsForDate(weekPlan, activeBeginnerPlan, todayYMD, now),
      activities,
    ),
    [activeBeginnerPlan, activities, now, todayYMD, weekPlan],
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
    sessionsForDate: (dateYMD: string) => overlayCompletionOnScheduledSessions(scheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now), activities),
    getScheduledSessionsForDate: (dateYMD: string) => overlayCompletionOnScheduledSessions(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now), activities),
    getPrimarySessionForDate: (dateYMD: string) => getPrimarySessionForDate(overlayCompletionOnScheduledSessions(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now), activities)),
    getSupportingSessionsForDate: (dateYMD: string) => getSupportingSessionsForDate(overlayCompletionOnScheduledSessions(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now), activities)),
    getScheduledRunForDate: (dateYMD: string) => getScheduledRunForDate(overlayCompletionOnScheduledSessions(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now), activities)),
    getScheduledStrengthForDate: (dateYMD: string) => getScheduledStrengthForDate(overlayCompletionOnScheduledSessions(getScheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now), activities)),
    getSessionById: (scheduledSessionId: string) => getSessionById(weekSessions, scheduledSessionId),
    getCompletedActivityForScheduledSession: (scheduledSessionId: string) => getCompletedActivityForScheduledSession(activities, scheduledSessionId),
    getPlannedVersusCompletedComparison: (scheduledSessionId: string) => {
      const session = getSessionById(weekSessions, scheduledSessionId);
      if (!session) return [];
      return plannedVersusCompletedComparison(session, getCompletedActivityForScheduledSession(activities, scheduledSessionId));
    },
  };
}
