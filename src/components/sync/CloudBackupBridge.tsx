import { useEffect } from 'react';

import { backupRecords, deleteActivityLog, upsertActivityLogs } from '../../lib/syncService';
import { useActivityStore } from '../../store/activityStore';
import { useAuthStore } from '../../store/authStore';
import { useCustomWorkoutStore } from '../../store/customWorkoutStore';
import { useStrengthStore } from '../../store/strengthStore';
import { useWorkoutStore } from '../../store/workoutStore';
import type { Activity } from '../../types/activity';
import { activityChangesToSync, MAX_PROPAGATED_DELETES } from '../../utils/cloudBackupDiff';

const DEBOUNCE_MS = 5_000;

type PersistApi = { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } };

function whenHydrated(store: PersistApi): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise(resolve => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

/**
 * Keeps the Supabase cloud backup current while signed in:
 * - once per launch (after every store has loaded its real data), upserts all
 *   local history so older records reach the cloud too;
 * - then pushes Activity changes a few seconds after they happen.
 * Bulk disappearances are never propagated as cloud deletes: only small,
 * deliberate deletions are (see MAX_PROPAGATED_DELETES).
 */
export default function CloudBackupBridge() {
  const userId = useAuthStore(state => state.user?.id ?? null);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    let synced: readonly Activity[] = [];

    (async () => {
      await Promise.all([
        whenHydrated(useActivityStore as unknown as PersistApi),
        whenHydrated(useWorkoutStore as unknown as PersistApi),
        whenHydrated(useStrengthStore as unknown as PersistApi),
        whenHydrated(useCustomWorkoutStore as unknown as PersistApi),
      ]);
      if (cancelled) return;

      synced = useActivityStore.getState().activities;
      await Promise.all([
        upsertActivityLogs(synced),
        backupRecords('workout_logs', useWorkoutStore.getState().history),
        backupRecords('strength_logs', useStrengthStore.getState().history),
        backupRecords('custom_workout_logs', useCustomWorkoutStore.getState().logs),
      ]).catch(() => undefined);
      if (cancelled) return;

      unsubscribe = useActivityStore.subscribe(state => {
        if (timer) clearTimeout(timer);
        const next = state.activities;
        timer = setTimeout(() => {
          const { upserts, deletes } = activityChangesToSync(synced, next);
          synced = next;
          if (upserts.length) void upsertActivityLogs(upserts).catch(() => undefined);
          if (deletes.length <= MAX_PROPAGATED_DELETES) {
            deletes.forEach(id => void deleteActivityLog(id).catch(() => undefined));
          }
        }, DEBOUNCE_MS);
      });
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
    };
  }, [userId]);

  return null;
}
