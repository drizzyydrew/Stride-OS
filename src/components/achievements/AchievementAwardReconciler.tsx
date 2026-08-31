import { useEffect, useMemo } from 'react';

import { useScheduledSessions } from '../../hooks/useScheduledSessions';
import { useWeekPlan } from '../../hooks/useWeekPlan';
import { useActivityStore } from '../../store/activityStore';
import { useAchievementStore } from '../../store/achievementStore';
import { evaluateAchievementAwards } from '../../utils/achievements';

export default function AchievementAwardReconciler() {
  const activities = useActivityStore(state => state.activities);
  const awarded = useAchievementStore(state => state.awarded);
  const recordAwards = useAchievementStore(state => state.recordAwards);
  const weekPlan = useWeekPlan();
  const { weekSessions } = useScheduledSessions(weekPlan);
  const earnedAwards = useMemo(
    () => evaluateAchievementAwards(activities, awarded.map(item => item.id), { scheduledSessions: weekSessions }),
    [activities, awarded, weekSessions],
  );

  useEffect(() => {
    recordAwards(earnedAwards);
  }, [earnedAwards, recordAwards]);

  return null;
}
