import { useSyncExternalStore } from 'react';
import { createObservabilityConsent } from '../../../src/utils/observabilityConsent';
let failure = false;
let raw: string | null = null;
export const observabilityConsent = createObservabilityConsent({
  getItem: async () => raw,
  setItem: async (_key, value) => { if (failure) throw new Error('Synthetic storage failure'); raw = value; },
  removeItem: async () => { raw = null; },
});
void observabilityConsent.setOwner('synthetic-preview');
export function useObservabilityConsent() { return useSyncExternalStore(observabilityConsent.subscribe, observabilityConsent.getState); }
export function setFailure(value: boolean) { failure = value; }
export const observability = { track() {} };
