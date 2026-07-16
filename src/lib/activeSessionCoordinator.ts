import { useActiveActivityStore } from '../store/activeActivityStore';
import { useActiveRunStore } from '../store/activeRunStore';
import { useActiveStrengthSessionStore } from '../store/activeStrengthSessionStore';
import {
  conflictingActiveSession,
  resolveActiveSessionOwner,
  type ActiveSessionDomain,
  type ActiveSessionOwner,
} from '../utils/activeSessionOwner';

export type { ActiveSessionDomain, ActiveSessionOwner } from '../utils/activeSessionOwner';

export function activeSessionStoresHydrated(): boolean {
  return useActiveRunStore.persist.hasHydrated()
    && useActiveActivityStore.persist.hasHydrated()
    && useActiveStrengthSessionStore.persist.hasHydrated();
}

export async function waitForActiveSessionStores(): Promise<void> {
  const stores = [
    useActiveRunStore,
    useActiveActivityStore,
    useActiveStrengthSessionStore,
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
  const strength = useActiveStrengthSessionStore.getState().session;
  return resolveActiveSessionOwner({
    runningActive: run.isActive,
    outdoorActive: outdoor.isActive,
    outdoorName: outdoor.name,
    strengthName: strength?.workoutName ?? null,
    strengthSource: strength?.source ?? null,
  });
}

export function getConflictingActiveSession(
  requestedDomain: ActiveSessionDomain,
): ActiveSessionOwner | null {
  return conflictingActiveSession(getActiveSessionOwner(), requestedDomain);
}
