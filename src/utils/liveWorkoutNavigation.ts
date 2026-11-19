import { resolveActiveSessionOwner, type ActiveSessionOwner, type ActiveSessionSnapshot } from './activeSessionOwner';

function routePath(path: string): string {
  return path.replace(/\/\([^/]+\)/g, '').replace(/\/index$/, '').replace(/\/$/, '') || '/';
}

/** A same-section navigate can unwind a form that sits above the live screen.
 * Push there to retain that draft; cross-tab navigation keeps its stack intact. */
export function liveWorkoutNavigationMethod(path: string, owner: ActiveSessionOwner): 'push' | 'navigate' {
  return routePath(path).split('/')[1] === routePath(owner.route).split('/')[1] ? 'push' : 'navigate';
}

/** Navigation only: a retained session must never be restarted or resumed by
 * opening its controls. Conflicting/unrestored state has no safe shortcut. */
export function liveWorkoutDestination(
  snapshot: ActiveSessionSnapshot,
  path: string,
  access: { hydrated: boolean; canAccessLocalData: boolean },
): ActiveSessionOwner | null {
  if (!access.hydrated || !access.canAccessLocalData) return null;
  const current = routePath(path);
  if (current === '/auth' || current.startsWith('/auth/')
    || current === '/onboarding' || current.startsWith('/onboarding/')) return null;
  const count = [snapshot.runningActive, snapshot.outdoorActive, snapshot.indoorRideActive,
    Boolean(snapshot.strengthName && snapshot.strengthSource)].filter(Boolean).length;
  if (count !== 1) return null;
  const owner = resolveActiveSessionOwner(snapshot);
  return owner && current !== routePath(owner.route) ? owner : null;
}
