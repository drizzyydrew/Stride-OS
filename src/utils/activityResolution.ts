import type { Activity } from '../types/activity';

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

export function findActivityBySupportedId(
  activities: Activity[],
  rawId: string | string[] | undefined,
): Activity | undefined {
  const id = firstParam(rawId)?.trim();
  if (!id) return undefined;
  const candidates = candidateIds(id);
  return activities.find(activity =>
    candidates.includes(activity.id)
    || activity.legacyWorkoutId === id,
  );
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
