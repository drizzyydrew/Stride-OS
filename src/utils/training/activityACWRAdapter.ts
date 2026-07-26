// Projects the normalized Activity store onto the minimal shape calculateACWR
// needs, so ACWR (and anything derived from it) reads from one source of
// truth instead of the legacy workout-store history. Does not change ACWR's
// math — only where its input load records come from.
import type { Activity } from '../../types/activity';
import type { ACWRLoadRecord } from './calculateACWR';

// Legacy-imported activities and activities written by the same completion
// through a fresh write path share the same deterministic id (see
// activityMigration.ts), so activityStore's array already has at most one
// entry per physical completion in the common case. This dedupes on
// legacyWorkoutId as a second guard so a legacy-imported record and a
// same-session canonical-id record (kept side by side per the v1→v2
// migration's "never drop data" rule) can never both count toward load.
export function activitiesToACWRRecords(activities: readonly Activity[]): ACWRLoadRecord[] {
  const seen = new Set<string>();
  const records: ACWRLoadRecord[] = [];
  for (const activity of activities) {
    if (activity.status === 'skipped') continue;
    const dedupeKey = activity.legacyWorkoutId ?? activity.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    records.push({
      timestamp: activity.startTime,
      estimatedLoad: activity.trainingLoad?.wholeBody ?? 0,
    });
  }
  return records;
}
