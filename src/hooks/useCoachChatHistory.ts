import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { getAppStorage } from '../store/persistStorage';
import { getLocalDataOwner } from '../lib/localDataOwner';
import { createCoachChatHistory } from '../utils/coachChatHistory';

export const coachChatHistory = createCoachChatHistory({
  getItem: async key => await getAppStorage().readItemOnce(key),
  setItem: async (key, value) => { await getAppStorage().setItem(key, value); },
});

let currentOwner: string | null | undefined;
function reconcile() {
  const auth = useAuthStore.getState();
  const owner = auth.canAccessLocalData ? auth.user?.id ?? null : null;
  if (owner === currentOwner) return;
  currentOwner = owner;
  void coachChatHistory.setOwner(owner);
}
useAuthStore.subscribe(reconcile);

export function useCoachChatHistory() {
  const state = useSyncExternalStore(coachChatHistory.subscribe, coachChatHistory.getState, coachChatHistory.getState);
  useEffect(() => {
    reconcile();
    const invalidation = getLocalDataOwner()?.onLeaseInvalidated(reason => {
      if (reason === 'revoke') { currentOwner = undefined; void coachChatHistory.setOwner(null); }
    });
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') { reconcile(); void coachChatHistory.prune(); } });
    const timer = setInterval(() => { void coachChatHistory.prune(); }, 1000);
    return () => { invalidation?.(); subscription.remove(); clearInterval(timer); };
  }, []);
  return { ...state, append: (message: Parameters<typeof coachChatHistory.append>[0]) => coachChatHistory.append(message, state.owner),
    markFailed: (id: string) => coachChatHistory.markFailed(id, state.owner),
    prune: async () => {
      if (coachChatHistory.getState().owner !== state.owner) throw new Error('Your account changed.');
      const messages = await coachChatHistory.prune();
      if (coachChatHistory.getState().owner !== state.owner) throw new Error('Your account changed.');
      return messages;
    },
    retry: async () => {
      reconcile();
      const owner=currentOwner??null;
      await coachChatHistory.setOwner(owner);
      const fresh=coachChatHistory.getState();
      return !!owner&&fresh.owner===owner&&fresh.ready;
    } };
}
