export type ActiveSessionDomain = 'running' | 'outdoor' | 'indoor_ride' | 'strength';

export type ActiveSessionOwner = {
  domain: ActiveSessionDomain;
  name: string;
  route: '/(tabs)/training' | '/(tabs)/activity/start' | '/(tabs)/activity/indoor-ride' | '/(tabs)/strength' | '/(tabs)/strength/preset-session' | '/(tabs)/strength/custom-session';
};

export type ActiveSessionSnapshot = {
  runningActive: boolean;
  outdoorActive: boolean;
  outdoorName: string;
  indoorRideActive: boolean;
  strengthName: string | null;
  strengthSource: 'training_block' | 'preset' | 'custom' | null;
};

export function resolveActiveSessionOwner(
  snapshot: ActiveSessionSnapshot,
): ActiveSessionOwner | null {
  if (snapshot.runningActive) {
    return { domain: 'running', name: 'Training Run', route: '/(tabs)/training' };
  }
  if (snapshot.outdoorActive) {
    return {
      domain: 'outdoor',
      name: snapshot.outdoorName,
      route: '/(tabs)/activity/start',
    };
  }
  if (snapshot.indoorRideActive) {
    return { domain: 'indoor_ride', name: 'Indoor Ride', route: '/(tabs)/activity/indoor-ride' };
  }
  if (snapshot.strengthName && snapshot.strengthSource) {
    return {
      domain: 'strength',
      name: snapshot.strengthName,
      route: snapshot.strengthSource === 'preset'
        ? '/(tabs)/strength/preset-session'
        : snapshot.strengthSource === 'custom'
          ? '/(tabs)/strength/custom-session'
          : '/(tabs)/strength',
    };
  }
  return null;
}

export function conflictingActiveSession(
  owner: ActiveSessionOwner | null,
  requestedDomain: ActiveSessionDomain,
): ActiveSessionOwner | null {
  return owner && owner.domain !== requestedDomain ? owner : null;
}

// A rehydrated (or long-running) active session older than this threshold is
// still valid data, but must never silently own the session lock — conflict
// prompts surface it as resumable/discardable instead of a dead-end.
export const STALE_ACTIVE_SESSION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function isStaleActiveSession(startedAtMs: number | null | undefined, nowMs = Date.now()): boolean {
  if (startedAtMs == null || !Number.isFinite(startedAtMs)) return false;
  return nowMs - startedAtMs > STALE_ACTIVE_SESSION_THRESHOLD_MS;
}
