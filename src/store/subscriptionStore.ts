import { create } from 'zustand';
import { checkEntitlements, type Entitlements } from '../lib/revenueCat';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from '../lib/localDataOwner';
import { useAuthStore } from './authStore';

type SubscriptionStore = {
  hasAnalysisCredits: boolean;
  isPro:              boolean;
  proExpiresAt?:       number | null;
  isLoading:          boolean;
  owner:              string | null;
  error:              string | null;
  refresh:            () => Promise<void>;
};

let requestVersion = 0;
let pending: { lease: OwnerLease; promise: Promise<void> } | null = null;

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  hasAnalysisCredits: false,
  isPro:              false,
  proExpiresAt:        null,
  isLoading:          false,
  owner:              null,
  error:              null,

  refresh: () => {
    const lease = captureOwnerLease(true);
    if (!lease) { ++requestVersion; pending = null; set({ owner: null, isPro: false, proExpiresAt: null, hasAnalysisCredits: false, isLoading: false, error: null }); return Promise.resolve(); }
    if (pending && pending.lease.ownerUserId === lease.ownerUserId && pending.lease.generation === lease.generation) return pending.promise;
    const version = ++requestVersion;
    const sameOwner = get().owner === lease.ownerUserId;
    // A read in progress must not briefly revoke this owner's known entitlement.
    // New premium actions still wait for the verification to finish.
    set({ isLoading: true, owner: lease.ownerUserId,
      isPro: sameOwner && get().isPro, proExpiresAt: sameOwner ? get().proExpiresAt : null, hasAnalysisCredits: sameOwner && get().hasAnalysisCredits, error: null });
    const promise = (async () => {
      try {
        const entitlements: Entitlements = await checkEntitlements();
        if (version === requestVersion && ownerLeaseIsCurrent(lease, true)) set({ ...entitlements, owner: lease.ownerUserId, isLoading: false });
      } catch {
        if (version === requestVersion && ownerLeaseIsCurrent(lease, true)) set({ isLoading: false, isPro: false, proExpiresAt: null, hasAnalysisCredits: false, error: 'Membership could not be verified. Please retry online.' });
      } finally {
        if (version === requestVersion) {
          pending = null;
          if (!ownerLeaseIsCurrent(lease, true)) set({ owner: lease.ownerUserId, isPro: false, proExpiresAt: null, hasAnalysisCredits: false,
            isLoading: false, error: 'Membership could not be verified. Please retry online.' });
        }
      }
    })();
    pending = { lease, promise };
    return promise;
  },
}));

useAuthStore.subscribe((next, previous) => {
  if (next.user?.id !== previous.user?.id || !next.canAccessLocalData) {
    ++requestVersion; pending = null;
    useSubscriptionStore.setState({ owner: null, isPro: false, proExpiresAt: null, hasAnalysisCredits: false, isLoading: false, error: null });
  }
});
