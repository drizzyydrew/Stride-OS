import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createHydrationSafeStorage, type HydrationSafeStorage } from './hydrationSafeStorage';

type AppStorage = StateStorage & Pick<HydrationSafeStorage, 'getItemOnce'>;

const serverStorage: AppStorage = {
  getItem: async () => null,
  getItemOnce: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export { createHydrationSafeStorage, type HydrationSafeStorage } from './hydrationSafeStorage';

let appStorage: HydrationSafeStorage | null = null;

export function getAppStorage(): AppStorage {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return serverStorage;
  }
  if (!appStorage) appStorage = createHydrationSafeStorage(AsyncStorage);
  return appStorage;
}

export function createAppJSONStorage() {
  return createJSONStorage(() => getAppStorage());
}
