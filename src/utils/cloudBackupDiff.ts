import type { Activity } from '../types/activity';

/** More disappearances than this at once looks like data loss, not a user delete. */
export const MAX_PROPAGATED_DELETES = 2;

export function activityChangesToSync(
  previous: readonly Activity[],
  next: readonly Activity[],
): { upserts: Activity[]; deletes: string[] } {
  const before = new Map(previous.map(activity => [activity.id, activity]));
  const upserts = next.filter(activity => {
    const old = before.get(activity.id);
    return !old || old !== activity || (old.updatedAt ?? 0) !== (activity.updatedAt ?? 0);
  });
  const nextIds = new Set(next.map(activity => activity.id));
  const deletes = previous.filter(activity => !nextIds.has(activity.id)).map(activity => activity.id);
  return { upserts, deletes };
}
