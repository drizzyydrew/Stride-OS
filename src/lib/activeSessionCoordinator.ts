import { useActiveActivityStore } from '../store/activeActivityStore';
import { useActiveRunStore } from '../store/activeRunStore';
import { useActiveStrengthSessionStore } from '../store/activeStrengthSessionStore';
import { useActiveIndoorRideStore } from '../store/activeIndoorRideStore';
import {
  conflictingActiveSession,
  isStaleActiveSession,
  resolveActiveSessionOwner,
  type ActiveSessionDomain,
  type ActiveSessionOwner,
} from '../utils/activeSessionOwner';
import { stopLocationTracking } from './gpsTracking';
import { stopActivityLocationTracking } from './activityGpsTracking';
import { endOutdoorLiveActivity, endRunLiveActivity } from './runLiveActivity';
import { endStrengthLiveActivity } from './strengthLiveActivity';

export type { ActiveSessionDomain, ActiveSessionOwner } from '../utils/activeSessionOwner';

export function activeSessionStoresHydrated(): boolean {
  return useActiveRunStore.persist.hasHydrated()
    && useActiveActivityStore.persist.hasHydrated()
    && useActiveStrengthSessionStore.persist.hasHydrated()
    && useActiveIndoorRideStore.persist.hasHydrated();
}

export async function waitForActiveSessionStores(): Promise<void> {
  const stores = [
    useActiveRunStore,
    useActiveActivityStore,
    useActiveStrengthSessionStore,
    useActiveIndoorRideStore,
  ];
  await Promise.all(stores.map(store => {
    if (store.persist.hasHydrated()) return Promise.resolve();
    return new Promise<void>(resolve => {
      const unsubscribe = store.persist.onFinishHydration(() => {
        unsubscribe();
        resolve();
      });
    });
  }));
}

export function getActiveSessionOwner(): ActiveSessionOwner | null {
  const run = useActiveRunStore.getState();
  const outdoor = useActiveActivityStore.getState();
  const indoorRide = useActiveIndoorRideStore.getState();
  const strength = useActiveStrengthSessionStore.getState().session;
  return resolveActiveSessionOwner({
    runningActive: run.isActive,
    outdoorActive: outdoor.isActive,
    outdoorName: outdoor.name,
    indoorRideActive: indoorRide.isActive,
    strengthName: strength?.workoutName ?? null,
    strengthSource: strength?.source ?? null,
  });
}

export function getConflictingActiveSession(
  requestedDomain: ActiveSessionDomain,
): ActiveSessionOwner | null {
  return conflictingActiveSession(getActiveSessionOwner(), requestedDomain);
}

// Whether the currently-active session (if any) started more than 24h ago —
// used by conflict prompts to soften the copy from "in progress" to
// "started a while ago, still open."
export function isActiveSessionStale(): boolean {
  const run = useActiveRunStore.getState();
  if (run.isActive) return isStaleActiveSession(run.startTime);
  const outdoor = useActiveActivityStore.getState();
  if (outdoor.isActive) return isStaleActiveSession(outdoor.startedAt);
  const indoorRide = useActiveIndoorRideStore.getState();
  if (indoorRide.isActive) return isStaleActiveSession(indoorRide.startedAt);
  const strength = useActiveStrengthSessionStore.getState().session;
  if (strength) return isStaleActiveSession(strength.startedAt);
  return false;
}

// Cleanly ends whichever session `owner` points at: stops GPS/location
// tracking, ends the platform Live Activity (best-effort), and clears the
// store. Used by "End previous session and start new" conflict-resolution
// actions so a stale/conflicting session is never a dead end.
export async function discardActiveSession(owner: ActiveSessionOwner): Promise<void> {
  if (owner.domain === 'running') {
    const run = useActiveRunStore.getState();
    await stopLocationTracking().catch(() => undefined);
    await endRunLiveActivity({
      sessionId: run.workoutInstanceId ?? (run.startTime ? `run:${run.startTime}` : ''),
      workoutInstanceId: run.workoutInstanceId ?? undefined,
      sessionSource: 'running',
      elapsedSeconds: run.startTime ? Math.max(0, Math.floor((Date.now() - run.startTime - run.pausedDurationMs) / 1000)) : 0,
      distanceMiles: run.distanceMiles,
      averagePace: '--:--',
      heartRateBpm: null,
      zoneLabel: 'Zone --',
      zoneStatus: 'unknown',
      isPaused: false,
    }).catch(() => undefined);
    useActiveRunStore.getState().cancelRun();
    return;
  }
  if (owner.domain === 'outdoor') {
    const outdoor = useActiveActivityStore.getState();
    await stopActivityLocationTracking().catch(() => undefined);
    await endOutdoorLiveActivity({
      sessionId: outdoor.workoutInstanceId ?? outdoor.activityId ?? '',
      workoutInstanceId: outdoor.workoutInstanceId ?? undefined,
      sessionSource: 'outdoor',
      activityName: outdoor.name || owner.name,
      activityType: outdoor.runWalkIntervals.length ? 'run_walk' : outdoor.activityType,
      elapsedSeconds: outdoor.startedAt ? Math.max(0, Math.floor((Date.now() - outdoor.startedAt - outdoor.pausedDurationMs) / 1000)) : 0,
      distanceMiles: outdoor.aggregate.distanceMeters / 1609.344,
      heartRateBpm: null,
      isPaused: false,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
    }).catch(() => undefined);
    useActiveActivityStore.getState().discard();
    return;
  }
  if (owner.domain === 'indoor_ride') {
    const ride = useActiveIndoorRideStore.getState();
    await endOutdoorLiveActivity({
      sessionId: ride.workoutInstanceId ?? '',
      workoutInstanceId: ride.workoutInstanceId ?? undefined,
      sessionSource: 'outdoor',
      activityName: 'Indoor Ride',
      activityType: 'indoor_cycling',
      elapsedSeconds: ride.startedAt ? Math.max(0, Math.floor((Date.now() - ride.startedAt - ride.pausedDurationMs) / 1000)) : 0,
      distanceMiles: ride.equipmentDistance
        ? (ride.equipmentDistance.unit === 'mi' ? ride.equipmentDistance.value : ride.equipmentDistance.value / 1.609344)
        : 0,
      averageSpeedMph: 0,
      heartRateBpm: ride.heartRateBpm,
      isPaused: false,
    }).catch(() => undefined);
    ride.cancelRide();
    return;
  }
  if (owner.domain === 'strength') {
    await endStrengthLiveActivity().catch(() => undefined);
    useActiveStrengthSessionStore.getState().clearSession();
  }
}
