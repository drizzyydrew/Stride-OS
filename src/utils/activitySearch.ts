import type { Activity, ActivityStatus, ActivityType, CompletionClassification } from '../types/activity';

export type ActivitySearchFilters = {
  query?: string;
  type?: ActivityType | 'all';
  dateFrom?: number;
  dateTo?: number;
  minDistanceMiles?: number;
  maxDistanceMiles?: number;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;
  shoeId?: string;
  routeId?: string;
  treadmill?: boolean;
  indoor?: boolean;
  status?: ActivityStatus;
  completionClassification?: CompletionClassification;
  rpe?: number;
};

function distanceMiles(activity: Activity): number {
  return (activity.metrics.distanceMeters ?? 0) / 1609.344;
}

function durationMinutes(activity: Activity): number {
  return (activity.metrics.durationSeconds ?? activity.metrics.elapsedTimeSeconds ?? 0) / 60;
}

function queryText(activity: Activity): string {
  return [
    activity.activityType,
    activity.subtype,
    activity.notes,
    activity.completionClassification,
    activity.metrics.routeId,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function matchesActivitySearch(activity: Activity, filters: ActivitySearchFilters): boolean {
  if (filters.query?.trim()) {
    const needle = filters.query.trim().toLowerCase();
    if (!queryText(activity).includes(needle)) return false;
  }
  if (filters.type && filters.type !== 'all' && activity.activityType !== filters.type) return false;
  if (filters.dateFrom && activity.startTime < filters.dateFrom) return false;
  if (filters.dateTo && activity.startTime > filters.dateTo) return false;
  if (filters.minDistanceMiles !== undefined && distanceMiles(activity) < filters.minDistanceMiles) return false;
  if (filters.maxDistanceMiles !== undefined && distanceMiles(activity) > filters.maxDistanceMiles) return false;
  if (filters.minDurationMinutes !== undefined && durationMinutes(activity) < filters.minDurationMinutes) return false;
  if (filters.maxDurationMinutes !== undefined && durationMinutes(activity) > filters.maxDurationMinutes) return false;
  if (filters.shoeId && activity.shoeId !== filters.shoeId) return false;
  if (filters.routeId && activity.metrics.routeId !== filters.routeId) return false;
  if (filters.treadmill !== undefined && (activity.subtype === 'treadmill') !== filters.treadmill) return false;
  if (filters.indoor !== undefined && activity.indoor !== filters.indoor) return false;
  if (filters.status && activity.status !== filters.status) return false;
  if (filters.completionClassification && activity.completionClassification !== filters.completionClassification) return false;
  if (filters.rpe !== undefined && activity.rpe !== filters.rpe) return false;
  return true;
}

export function filterActivities(activities: readonly Activity[], filters: ActivitySearchFilters): Activity[] {
  return activities.filter(activity => matchesActivitySearch(activity, filters));
}
