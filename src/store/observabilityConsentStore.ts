import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { createObservabilityConsent } from '../utils/observabilityConsent';

export const observabilityConsent = createObservabilityConsent(AsyncStorage);

export function useObservabilityConsent() {
  return useSyncExternalStore(observabilityConsent.subscribe, observabilityConsent.getState, observabilityConsent.getState);
}
