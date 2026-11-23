import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { evaluateProAccess, type ProFeature } from '../utils/pro-access';
import { billingIsConfigured } from './revenueCat';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';

export function proMembershipEnabled(): boolean {
  return Platform.OS === 'ios' && process.env.EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED === 'true';
}

export function getProAccess(feature: ProFeature = 'personalized-plans') {
  const auth = useAuthStore.getState();
  const membership = useSubscriptionStore.getState();
  const owner = auth.user?.id ?? auth.offlineOwnerId;
  const localLease = captureOwnerLease();
  const onlineLease = captureOwnerLease(true);
  return evaluateProAccess({
    billingEnabled: proMembershipEnabled(), billingConfigured: billingIsConfigured(),
    owner, localAccess: auth.canAccessLocalData && !!localLease && localLease.ownerUserId === owner,
    online: !!onlineLease && onlineLease.ownerUserId === owner, membershipOwner: membership.owner,
    isPro: membership.isPro && (!membership.proExpiresAt || membership.proExpiresAt > Date.now()),
    isLoading: membership.isLoading, error: membership.error,
  }, feature);
}

export function assertProAccess(feature: ProFeature): void {
  const access = getProAccess(feature);
  if (!access.allowed) throw new Error(access.message);
}

export function hasProAccess(feature: ProFeature): boolean {
  try { assertProAccess(feature); return true; } catch { return false; }
}

/** Only called for a new paid action. Reading/completing existing training never calls this. */
export async function requireProAccess(feature: ProFeature): Promise<void> {
  if (!proMembershipEnabled()) return;
  const lease = captureOwnerLease(true);
  if (!lease || !billingIsConfigured()) { assertProAccess(feature); return; }
  await useSubscriptionStore.getState().refresh();
  if (!ownerLeaseIsCurrent(lease, true)) throw new Error('Your account changed. Your saved training was retained.');
  assertProAccess(feature);
}
