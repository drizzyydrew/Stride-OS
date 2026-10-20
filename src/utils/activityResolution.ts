import type { Activity } from '../types/activity';
import { runCompletionKey } from './runCompletionIdentity';

export type ActivityResolution =
  | { status: 'resolved'; activity: Activity }
  | { status: 'loading' }
  | { status: 'unavailable' };

type ActivityHydrationStatus = 'loading' | 'ready' | 'error';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function candidateIds(id: string): string[] {
  const candidates = new Set([id]);
  const legacyPrefixes: [string, string][] = [
    ['run--', 'activity_workout_'],
    ['workout--', 'activity_workout_'],
    ['strength--', 'activity_strength_'],
    ['mobility--', 'activity_mobility_'],
  ];
  for (const [prefix, canonicalPrefix] of legacyPrefixes) {
    if (id.startsWith(prefix)) {
      candidates.add(`${canonicalPrefix}${id.slice(prefix.length)}`);
    }
  }
  return [...candidates];
}

export function lookupActivityBySupportedId(
  activities: Activity[],
  rawId: string | string[] | undefined,
): { status: 'resolved'; activity: Activity } | { status: 'missing' | 'ambiguous' } {
  const id = firstParam(rawId)?.trim();
  if (!id) return { status: 'missing' };
  const candidates = candidateIds(id);
  const exact = activities.find(activity => activity.id === id);
  if (exact) return { status: 'resolved', activity: exact };
  const matches = activities.filter(activity => {
    const aliases = new Set([activity.id]);
    const prefix = activity.activityType === 'strength' ? 'activity_strength_'
      : activity.activityType === 'mobility' ? 'activity_mobility_' : 'activity_workout_';
    for (const legacyId of [activity.legacyWorkoutId, activity.healthKit?.strideOSWorkoutId]) {
      if (legacyId) { aliases.add(legacyId); aliases.add(`${prefix}${legacyId}`); }
    }
    if (activity.healthKit?.strideOSActivityId) aliases.add(activity.healthKit.strideOSActivityId);
    for (const instance of [activity.workoutInstanceId, activity.healthKit?.workoutInstanceId]) {
      if (!instance) continue;
      aliases.add(instance);
      const completion = runCompletionKey(instance);
      aliases.add(completion);
      aliases.add(`activity_workout_${completion}`);
    }
    return candidates.some(candidate => aliases.has(candidate));
  });
  // An ambiguous alias must never open a different race based on date or proximity.
  return matches.length === 1 ? { status: 'resolved', activity: matches[0] }
    : { status: matches.length > 1 ? 'ambiguous' : 'missing' };
}

export function findActivityBySupportedId(activities: Activity[], rawId: string | string[] | undefined): Activity | undefined {
  const result = lookupActivityBySupportedId(activities, rawId);
  return result.status === 'resolved' ? result.activity : undefined;
}

export function resolveActivityDetail(
  activities: Activity[],
  rawId: string | string[] | undefined,
  hydrationStatus: ActivityHydrationStatus,
): ActivityResolution {
  const id = firstParam(rawId)?.trim();
  if (!id) return { status: 'unavailable' };
  const activity = findActivityBySupportedId(activities, id);
  if (activity) return { status: 'resolved', activity };
  if (hydrationStatus === 'loading') return { status: 'loading' };
  return { status: 'unavailable' };
}
