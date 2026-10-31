import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { useAuthStore } from './authStore';
import { createAiConsent } from '../utils/aiConsent';

export const aiConsent = createAiConsent(AsyncStorage);
let owner: string | null | undefined;
function reconcile() {
  const auth = useAuthStore.getState();
  if (auth.loading) return;
  const next = auth.canAccessLocalData ? auth.user?.id ?? null : null;
  if (next === owner) return;
  owner = next;
  void aiConsent.setOwner(next);
}
useAuthStore.subscribe(reconcile);
reconcile();

export function useAiConsent() {
  return useSyncExternalStore(aiConsent.subscribe, aiConsent.getState, aiConsent.getState);
}
