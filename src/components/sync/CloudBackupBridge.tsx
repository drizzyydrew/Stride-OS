import { useEffect } from 'react';
import { AppState } from 'react-native';

import { backupRecords, deleteActivityLog, upsertActivityLogs } from '../../lib/syncService';
import { useActivityStore } from '../../store/activityStore';
import { useAuthStore } from '../../store/authStore';
import { useCustomWorkoutStore } from '../../store/customWorkoutStore';
import { useStrengthStore } from '../../store/strengthStore';
import { useWorkoutStore } from '../../store/workoutStore';
import type { Activity } from '../../types/activity';
import { activityChangesToSync, MAX_PROPAGATED_DELETES } from '../../utils/cloudBackupDiff';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';

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
  const accessStatus = useAuthStore(state => state.localAccessStatus);

  useEffect(() => {
    if (!userId || accessStatus !== 'ready') return undefined;
    const lease = captureOwnerLease(true);
    if (!lease || lease.ownerUserId !== userId) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    let synced: readonly Activity[] = [];
    let initialBackupComplete = false;
    let busy = false;
    let dirty = false;
    const current = () => !cancelled && ownerLeaseIsCurrent(lease, true);

    const schedule = (delay = DEBOUNCE_MS) => {
      if (!current()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, delay);
    };

    const flush = async () => {
      if (!current()) return;
      if (busy) { dirty = true; return; }
      busy = true;
      let successful = false;
      try {
        const next = useActivityStore.getState().activities;
        if (!initialBackupComplete) {
          const results = await Promise.all([
            upsertActivityLogs(next),
            backupRecords('workout_logs', useWorkoutStore.getState().history),
            backupRecords('strength_logs', useStrengthStore.getState().history),
            backupRecords('custom_workout_logs', useCustomWorkoutStore.getState().logs),
          ]);
          if (!current() || results.some(result => !result)) return;
          initialBackupComplete = true;
        } else {
          const { upserts, deletes } = activityChangesToSync(synced, next);
          if (upserts.length && !await upsertActivityLogs(upserts)) return;
          if (!current()) return;
          if (deletes.length <= MAX_PROPAGATED_DELETES) {
            for (const id of deletes) {
              if (!current()) return;
              await deleteActivityLog(id);
            }
          }
        }
        if (!current()) return;
        synced = next;
        successful = true;
      } catch {
        // Keep the last acknowledged snapshot; a failed request is not a backup.
      } finally {
        busy = false;
        if (current() && (!successful || dirty)) schedule(successful ? DEBOUNCE_MS : 30_000);
        dirty = false;
      }
    };

    (async () => {
      await Promise.all([
        whenHydrated(useActivityStore as unknown as PersistApi),
        whenHydrated(useWorkoutStore as unknown as PersistApi),
        whenHydrated(useStrengthStore as unknown as PersistApi),
        whenHydrated(useCustomWorkoutStore as unknown as PersistApi),
      ]);
      if (!current()) return;
      unsubscribe = useActivityStore.subscribe(() => { dirty = true; schedule(); });
      await flush();
    })();
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') schedule(0);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
      appState.remove();
    };
  }, [userId, accessStatus]);

  return null;
}
