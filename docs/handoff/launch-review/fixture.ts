import { useSyncExternalStore } from 'react';
import { createAiConsent } from '../../../src/utils/aiConsent';
let raw: string | null = null;
let fail = false;
export const aiConsent = createAiConsent({ getItem: async () => raw, setItem: async (_key, value) => { if (fail) throw new Error('Synthetic disk failure'); raw = value; }, removeItem: async () => { raw = null; } });
void aiConsent.setOwner('synthetic-launch-review');
export function useAiConsent() { return useSyncExternalStore(aiConsent.subscribe, aiConsent.getState); }
export function setAiFailure(value: boolean) { fail = value; }
const auth = { user: { id: 'synthetic-launch-review' }, canAccessLocalData: true, loading: false };
export const useAuthStore = Object.assign((selector: (state: typeof auth) => unknown) => selector(auth), { getState: () => auth });
export const useActiveRunStore = { getState: () => ({ isActive: false }) };
export const useActiveActivityStore = useActiveRunStore;
export const useActiveIndoorRideStore = useActiveRunStore;
export const billingIsConfigured = () => false;
export const router = { push() {}, back() {} };
export const usePathname = () => '/dashboard';
export const useIsFocused = () => true;
export const accountDeletionRequest = async () => null;
export const useFeatureTourStore = Object.assign((selector: (value: any) => unknown) => selector({ tourStatus: {}, replayRequests: {}, markCompleted() {}, markSkipped() {}, consumeReplay() {} }), {
  persist: { hasHydrated: () => true, onFinishHydration: () => () => {} },
});
