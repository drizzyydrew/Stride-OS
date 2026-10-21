import { useEffect } from 'react';

import { getHealthKitWorkoutHistory, writeActivityToHealth } from '../../lib/healthKit';
import { overlapsExistingActivity } from '../../utils/healthKitImport';
import { useActivityStore } from '../../store/activityStore';
import { useIntegrationsStore } from '../../store/integrationsStore';
import { shouldWriteActivityToHealth, watchRecordedActivity } from '../../utils/healthActivityWrite';
import type { Activity } from '../../types/activity';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';

/**
 * Saves each newly completed activity to Apple Health once, with its GPS
 * route. Activities present when the log finished loading are never
 * re-written (they were written when they were recorded, or predate this),
 * and Health-imported activities are never written back.
 */
/** Writes one activity unless Health already holds this session (watch or Apple Workout). */
export async function writeUnlessAlreadyInHealth(activity: Activity): Promise<void> {
  const lease = captureOwnerLease();
  if (!ownerLeaseIsCurrent(lease) || !useIntegrationsStore.getState().healthKitEnabled) return;
  if (watchRecordedActivity(activity)) return;
  // A failed read cannot establish absence; defer rather than write a duplicate.
  const recent = await getHealthKitWorkoutHistory({ days: 2, limit: 30 });
  if (!ownerLeaseIsCurrent(lease) || !useIntegrationsStore.getState().healthKitEnabled) return;
  if (recent.some(candidate => overlapsExistingActivity(candidate, [activity]))) return;
  await writeActivityToHealth(activity);
}

export default function HealthActivityWriter() {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const known = new Set<string>();

    const start = () => {
      useActivityStore.getState().activities.forEach(activity => known.add(activity.id));
      // A missing Health-only row may have been deliberately deleted. Recovery
      // uses the explicit Health restore action, not an automatic startup import.
      unsubscribe = useActivityStore.subscribe(state => {
        for (const activity of state.activities) {
          if (known.has(activity.id)) continue;
          known.add(activity.id);
          if (!useIntegrationsStore.getState().healthKitEnabled) continue;
          if (!shouldWriteActivityToHealth(activity)) continue;
          void writeUnlessAlreadyInHealth(activity).catch(() => undefined);
        }
      });
    };

    const persistApi = (useActivityStore as unknown as { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } }).persist;
    let stopWaiting: (() => void) | null = null;
    if (persistApi.hasHydrated()) start();
    else stopWaiting = persistApi.onFinishHydration(() => { stopWaiting?.(); start(); });

    return () => {
      stopWaiting?.();
      unsubscribe?.();
    };
  }, []);

  return null;
}
