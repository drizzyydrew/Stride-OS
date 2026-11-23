import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { getProAccess, proMembershipEnabled } from '../lib/pro-access';
import { billingIsConfigured } from '../lib/revenueCat';
import { captureOwnerLease } from '../lib/localDataOwner';
import type { ProFeature } from '../utils/pro-access';

/** Focus-scoped refresh: no app startup gate and no automatic restore/purchase. */
export function useProAccess(feature: ProFeature = 'personalized-plans') {
  const [expiryTick, updateExpiry] = useState(0);
  const owner = useAuthStore(state => state.user?.id ?? state.offlineOwnerId);
  const localAccess = useAuthStore(state => state.canAccessLocalData);
  const localStatus = useAuthStore(state => state.localAccessStatus);
  useSubscriptionStore(state => state.owner);
  useSubscriptionStore(state => state.isPro);
  useSubscriptionStore(state => state.isLoading);
  useSubscriptionStore(state => state.error);
  const expiresAt = useSubscriptionStore(state => state.proExpiresAt);
  const retry = useCallback(() => {
    if (AppState.currentState === 'active' && proMembershipEnabled() && billingIsConfigured() && captureOwnerLease(true)) {
      void useSubscriptionStore.getState().refresh().catch(() => undefined);
    }
  }, []);
  useEffect(() => {
    if (!expiresAt || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
    // Long-lived annual entitlements exceed setTimeout's signed 32-bit delay.
    // Re-evaluate periodically, then at the precise known expiry boundary.
    const timer = setTimeout(() => { updateExpiry(value => value + 1); if (expiresAt <= Date.now()) retry(); },
      Math.max(0, Math.min(expiresAt - Date.now(), 60_000)));
    return () => clearTimeout(timer);
  }, [expiresAt, retry, owner, expiryTick]);
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
  return { ...getProAccess(feature), retry };
}
