import type { Activity } from '../types/activity';
import { summarizeActivityLoad } from './activityLoad';

export type ActivityDeletionResult = {
  activities: Activity[];
  removed: Activity | null;
  wholeBodyLoad: number;
  linkedScheduledSessionId: string | null;
  exclusiveRouteId: string | null;
};

export function deleteActivityAndRecalculate(activities: Activity[], activityId: string): ActivityDeletionResult {
  const removed = activities.find(activity => activity.id === activityId) ?? null;
  const next = activities.filter(activity => activity.id !== activityId);
  const routeId = removed?.metrics.routeId ?? null;
  const routeStillUsed = routeId
    ? next.some(activity => activity.metrics.routeId === routeId)
    : false;
  return {
    activities: next,
    removed,
    wholeBodyLoad: summarizeActivityLoad(next).wholeBody,
    linkedScheduledSessionId: removed?.scheduledSessionId ?? null,
    exclusiveRouteId: routeId && !routeStillUsed ? routeId : null,
  };
}
