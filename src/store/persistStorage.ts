import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createHydrationSafeStorage, type HydrationSafeStorage } from './hydrationSafeStorage';

const serverStorage: StateStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export { createHydrationSafeStorage, type HydrationSafeStorage } from './hydrationSafeStorage';

let appStorage: HydrationSafeStorage | null = null;

export function getAppStorage(): StateStorage {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return serverStorage;
  }
  if (!appStorage) appStorage = createHydrationSafeStorage(AsyncStorage);
  return appStorage;
}

export function createAppJSONStorage() {
  return createJSONStorage(() => getAppStorage());
}
