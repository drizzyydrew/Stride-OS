import type { Activity } from '../types/activity';

/** Stable identity only: never retain deleted GPS, notes, metrics or video. */
export type WorkoutDeletion = { ownerUserId: string; activityId: string; deletedAt: number; keys: string[] };
export type HistoryTable = 'activity_logs' | 'workout_logs' | 'strength_logs' | 'custom_workout_logs' | 'mobility';

export function workoutIdentityKeys(table: HistoryTable, record: Record<string, any>): string[] {
  const keys: string[] = [];
  const add = (kind: string, id: unknown) => { if (typeof id === 'string' && id.trim()) keys.push(`${kind}:${id}`); };
  if (table === 'activity_logs') {
    add('activity', record.id);
    const kind = record.activityType === 'strength' ? 'strength' : record.activityType === 'mobility' ? 'mobility' : 'workout';
    add(kind, record.legacyWorkoutId);
    for (const [prefix, category] of [['activity_workout_', 'workout'], ['activity_strength_', 'strength'], ['activity_mobility_', 'mobility'], ['activity_custom_', 'custom']] as const) {
      if (record.id?.startsWith(prefix)) add(category, record.id.slice(prefix.length));
    }
  } else add(table === 'workout_logs' ? 'workout' : table === 'strength_logs' ? 'strength' : table === 'mobility' ? 'mobility' : 'custom', record.id);
  add('instance', record.workoutInstanceId);
  add('instance', record.healthKit?.workoutInstanceId);
  add('activity', record.healthKit?.strideOSActivityId);
  const healthKind = record.activityType === 'strength' ? 'strength' : record.activityType === 'mobility' ? 'mobility' : 'workout';
  add(healthKind, record.healthKit?.strideOSWorkoutId);
  add('health', record.healthKit?.workoutUuid);
  return [...new Set(keys)].sort();
}
export function deletionForActivity(activity: Activity, ownerUserId: string, now = Date.now()): WorkoutDeletion {
  return { ownerUserId, activityId: activity.id, deletedAt: now, keys: workoutIdentityKeys('activity_logs', activity) };
}
export function decodeWorkoutDeletions(value: unknown, owner: string): WorkoutDeletion[] {
  if (!Array.isArray(value)) throw new Error('Deleted workout history is unreadable; restore stopped');
  return value.map(row => {
    if (!row || row.ownerUserId !== owner || typeof row.activityId !== 'string' || !row.activityId
      || !Number.isFinite(row.deletedAt) || row.deletedAt < 0 || !Array.isArray(row.keys) || !row.keys.length
      || row.keys.some((key: unknown) => typeof key !== 'string' || !/^(activity|workout|strength|mobility|custom|instance|health):.+/.test(key))) {
      throw new Error('Deleted workout history has an invalid owner or identity');
    }
    return { ownerUserId: owner, activityId: row.activityId, deletedAt: row.deletedAt, keys: [...new Set<string>(row.keys)].sort() };
  });
}
export function mergeWorkoutDeletions(a: readonly WorkoutDeletion[], b: readonly WorkoutDeletion[]): WorkoutDeletion[] {
  const map = new Map<string, WorkoutDeletion>();
  for (const row of [...a, ...b]) {
    const key = `${row.ownerUserId}:${row.activityId}`, old = map.get(key);
    map.set(key, old ? { ...old, deletedAt: Math.min(old.deletedAt, row.deletedAt), keys: [...new Set([...old.keys, ...row.keys])].sort() } : row);
  }
  return [...map.values()];
}
export function workoutWasDeleted(deletions: readonly WorkoutDeletion[], table: HistoryTable, record: Record<string, any>, owner?: string): boolean {
  const keys = workoutIdentityKeys(table, record);
  return deletions.some(row => (!owner || row.ownerUserId === owner) && row.keys.some(key => keys.includes(key)));
}

/** A schedule slot can be performed again; its old recording must stay deleted. */
export function newPerformanceIdentity(completionKey: string, kind: 'workout' | 'strength', deletions: readonly WorkoutDeletion[]) {
  return deletions.some(row => row.keys.includes(`${kind}:${completionKey}`))
    ? { id: `${completionKey}_performance_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, completionKey }
    : { id: completionKey };
}
export function completionKeyFor(record: { id: string; completionKey?: string }) { return record.completionKey ?? record.id; }
