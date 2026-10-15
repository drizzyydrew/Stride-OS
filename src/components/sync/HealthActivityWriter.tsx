import { useEffect } from 'react';

import { getHealthKitWorkoutHistory, writeActivityToHealth } from '../../lib/healthKit';
import { buildHealthKitActivityDraft, isDuplicateHealthKitWorkout, overlapsExistingActivity } from '../../utils/healthKitImport';
import { useActivityStore } from '../../store/activityStore';
import { useIntegrationsStore } from '../../store/integrationsStore';
import { shouldWriteActivityToHealth, watchRecordedActivity } from '../../utils/healthActivityWrite';
import type { Activity } from '../../types/activity';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from '../../lib/localDataOwner';

/**
 * Saves each newly completed activity to Apple Health once, with its GPS
 * route. Activities present when the log finished loading are never
 * re-written (they were written when they were recorded, or predate this),
 * and Health-imported activities are never written back.
 */
const WATCH_BUNDLE_PREFIX = 'com.mooremovement.strideos';
const WATCH_IMPORT_DAYS = 7;

/**
 * Workouts the StrideOS watch app saved to Apple Health that the phone never
 * logged (e.g. the phone died mid-run while the watch kept recording) are
 * added to the Activity log automatically, with the watch's GPS route.
 */
async function importRecentWatchWorkouts(known: Set<string>, lease: OwnerLease | null): Promise<void> {
  if (!ownerLeaseIsCurrent(lease) || !useIntegrationsStore.getState().healthKitEnabled) return;
  const candidates = await getHealthKitWorkoutHistory({ days: WATCH_IMPORT_DAYS, limit: 50, includeRoutes: true }).catch(() => []);
  if (!ownerLeaseIsCurrent(lease)) return;
  for (const candidate of candidates) {
    if (candidate.sourceBundleIdentifier !== `${WATCH_BUNDLE_PREFIX}.watch`
      && !candidate.sourceBundleIdentifier.startsWith(`${WATCH_BUNDLE_PREFIX}.watch.`)) continue;
    if (candidate.durationSeconds < 60) continue;
    if (isDuplicateHealthKitWorkout(candidate, useActivityStore.getState().activities)) continue;
    const draft = buildHealthKitActivityDraft({ candidate });
    if (draft.id) known.add(draft.id);
    useActivityStore.getState().addActivity(draft);
  }
}

/** Writes one activity unless Health already holds this session (watch or Apple Workout). */
async function writeUnlessAlreadyInHealth(activity: Activity): Promise<void> {
  const lease = captureOwnerLease();
  if (!ownerLeaseIsCurrent(lease)) return;
  if (watchRecordedActivity(activity)) return;
  const recent = await getHealthKitWorkoutHistory({ days: 2, limit: 30 }).catch(() => []);
  if (!ownerLeaseIsCurrent(lease)) return;
  if (recent.some(candidate => overlapsExistingActivity(candidate, [activity]))) return;
  await writeActivityToHealth(activity);
}

export default function HealthActivityWriter() {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const known = new Set<string>();

    const start = () => {
      useActivityStore.getState().activities.forEach(activity => known.add(activity.id));
      void importRecentWatchWorkouts(known, captureOwnerLease());
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
