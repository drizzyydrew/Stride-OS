import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { getProAccess, proMembershipEnabled } from '../lib/pro-access';
import { billingIsConfigured } from '../lib/revenueCat';
import { captureOwnerLease } from '../lib/localDataOwner';

/** Focus-scoped refresh: no app startup gate and no automatic restore/purchase. */
export function useProAccess() {
  const owner = useAuthStore(state => state.user?.id ?? state.offlineOwnerId);
  const localAccess = useAuthStore(state => state.canAccessLocalData);
  const localStatus = useAuthStore(state => state.localAccessStatus);
  useSubscriptionStore(state => state.owner);
  useSubscriptionStore(state => state.isPro);
  useSubscriptionStore(state => state.isLoading);
  useSubscriptionStore(state => state.error);
  const retry = useCallback(() => {
    if (AppState.currentState === 'active' && proMembershipEnabled() && billingIsConfigured() && captureOwnerLease(true)) {
      void useSubscriptionStore.getState().refresh().catch(() => undefined);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    let previous = AppState.currentState;
    retry();
    const listener = AppState.addEventListener('change', state => {
      if (active && state === 'active' && previous !== 'active') retry();
      previous = state;
    });
    return () => { active = false; listener.remove(); };
  }, [owner, localAccess, localStatus, retry]));
  return { ...getProAccess(), retry };
}
