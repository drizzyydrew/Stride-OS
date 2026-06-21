import { create } from 'zustand';
import { checkEntitlements, type Entitlements } from '../lib/revenueCat';

type SubscriptionStore = {
  hasAnalysisCredits: boolean;
  isPro:              boolean;
  isLoading:          boolean;
  refresh:            () => Promise<void>;
};

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  hasAnalysisCredits: false,
  isPro:              false,
  isLoading:          false,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const entitlements: Entitlements = await checkEntitlements();
      set({ ...entitlements, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
