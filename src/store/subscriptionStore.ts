import { create } from 'zustand';
import { checkEntitlements, type Entitlements } from '../lib/revenueCat';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../lib/localDataOwner';
import { useAuthStore } from './authStore';

type SubscriptionStore = {
  hasAnalysisCredits: boolean;
  isPro:              boolean;
  isLoading:          boolean;
  owner:              string | null;
  error:              string | null;
  refresh:            () => Promise<void>;
};

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  hasAnalysisCredits: false,
  isPro:              false,
  isLoading:          false,
  owner:              null,
  error:              null,

  refresh: async () => {
    const lease = captureOwnerLease(true);
    if (!lease) { set({ owner: null, isPro: false, hasAnalysisCredits: false, isLoading: false }); return; }
    set({ isLoading: true, owner: lease.ownerUserId, isPro: false, hasAnalysisCredits: false, error: null });
    try {
      const entitlements: Entitlements = await checkEntitlements();
      if (ownerLeaseIsCurrent(lease, true)) set({ ...entitlements, owner: lease.ownerUserId, isLoading: false });
    } catch {
      if (ownerLeaseIsCurrent(lease, true)) set({ isLoading: false, isPro: false, hasAnalysisCredits: false, error: 'Membership could not be verified. Please retry online.' });
    }
  },
}));

useAuthStore.subscribe((next, previous) => {
  if (next.user?.id !== previous.user?.id || !next.canAccessLocalData) {
    useSubscriptionStore.setState({ owner: null, isPro: false, hasAnalysisCredits: false, isLoading: false, error: null });
  }
});
