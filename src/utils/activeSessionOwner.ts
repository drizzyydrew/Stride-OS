export type ActiveSessionDomain = 'running' | 'outdoor' | 'strength';

export type ActiveSessionOwner = {
  domain: ActiveSessionDomain;
  name: string;
  route: '/(tabs)/training' | '/(tabs)/activity/start' | '/(tabs)/strength' | '/(tabs)/strength/preset-session';
};

export type ActiveSessionSnapshot = {
  runningActive: boolean;
  outdoorActive: boolean;
  outdoorName: string;
  strengthName: string | null;
  strengthSource: 'training_block' | 'preset' | null;
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
  if (snapshot.strengthName && snapshot.strengthSource) {
    return {
      domain: 'strength',
      name: snapshot.strengthName,
      route: snapshot.strengthSource === 'preset'
        ? '/(tabs)/strength/preset-session'
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
