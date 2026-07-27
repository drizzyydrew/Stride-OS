import { useMemo } from 'react';

import { useBeginnerPlanStore } from '../store/beginnerPlanStore';
import { useActivityStore } from '../store/activityStore';
import { useScheduledSessionSelectionStore } from '../store/scheduledSessionSelectionStore';
import { useAdaptationStore } from '../store/adaptationStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { addDays, toYMD } from '../utils/calendarEngine';
import { adaptationWeekKey, applyAdaptationOverlays, validateAdaptationSchedule } from '../utils/adaptationWorkflow';
import { legacyOverridesToMoveLedger, projectMoveLedgerForWeek } from '../utils/scheduleMoveLedger';
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
  const dateOverrides = useScheduledSessionSelectionStore(state => state.dateOverrides);
  const moveLedger = useScheduledSessionSelectionStore(state => state.moveLedger);
  const availableDays = useOnboardingStore(state => state.data.availableDays);
  const adaptationKey = adaptationWeekKey(toYMD(weekPlan.weekStartDate));
  const confirmedAdaptation = useAdaptationStore(state => state.confirmed[adaptationKey]);
  const todayYMD = toYMD(now);

  const canonicalWeekSessions = useMemo(() =>
    overlayCompletionOnScheduledSessions(
      scheduledSessionsForWeek(weekPlan, activeBeginnerPlan, weekPlan.weekStartDate, now),
      activities,
    ), [activeBeginnerPlan, activities, now, weekPlan]);
  const weekSessionsRaw = useMemo(() => applyAdaptationOverlays(
    canonicalWeekSessions,
    confirmedAdaptation?.overlays,
  ), [canonicalWeekSessions, confirmedAdaptation?.overlays]);
  // Reschedule ("move date") is applied per-day against the whole known week
  // so a session moved off one day and onto another shows up exactly once,
  // on its new day, everywhere this hook is consumed.
  const weekSessions = useMemo(() => {
    const effectiveLedger = {
      ...legacyOverridesToMoveLedger(dateOverrides),
      ...moveLedger,
    };
    if (Object.keys(effectiveLedger).length === 0) return weekSessionsRaw;
    const planStartDate = toYMD(weekPlan.weekStartDate);
    const planEndDate = toYMD(addDays(weekPlan.weekStartDate, 6));
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    const lockedDates = Array.from({ length: 7 }, (_, index) => addDays(weekPlan.weekStartDate, index))
      .filter(date => !availableDays.includes(dayLabels[date.getDay()]))
      .map(toYMD);
    const candidate = projectMoveLedgerForWeek(weekSessionsRaw, effectiveLedger, { planStartDate, planEndDate, lockedDates });
    return validateAdaptationSchedule(candidate, { planStartDate, planEndDate, lockedDates }).length > 0
      ? weekSessionsRaw
      : candidate;
  }, [availableDays, dateOverrides, moveLedger, weekPlan.weekStartDate, weekSessionsRaw]);
  const todaySessions = useMemo(
    () => weekSessions.filter(session => session.date === todayYMD),
    [todayYMD, weekSessions],
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
    canonicalWeekSessions,
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
    sessionsForDate: (dateYMD: string) => weekSessions.filter(session => session.date === dateYMD),
    getScheduledSessionsForDate: (dateYMD: string) => weekSessions.filter(session => session.date === dateYMD),
    getPrimarySessionForDate: (dateYMD: string) => getPrimarySessionForDate(weekSessions.filter(session => session.date === dateYMD)),
    getSupportingSessionsForDate: (dateYMD: string) => getSupportingSessionsForDate(weekSessions.filter(session => session.date === dateYMD)),
    getScheduledRunForDate: (dateYMD: string) => getScheduledRunForDate(weekSessions.filter(session => session.date === dateYMD)),
    getScheduledStrengthForDate: (dateYMD: string) => getScheduledStrengthForDate(weekSessions.filter(session => session.date === dateYMD)),
    getSessionById: (scheduledSessionId: string) => getSessionById(weekSessions, scheduledSessionId),
    getCompletedActivityForScheduledSession: (scheduledSessionId: string) => getCompletedActivityForScheduledSession(activities, scheduledSessionId),
    getPlannedVersusCompletedComparison: (scheduledSessionId: string) => {
      const session = getSessionById(weekSessions, scheduledSessionId);
      if (!session) return [];
      return plannedVersusCompletedComparison(session, getCompletedActivityForScheduledSession(activities, scheduledSessionId));
    },
  };
}
