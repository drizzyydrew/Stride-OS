import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createHydrationSafeStorage, type HydrationSafeStorage } from './hydrationSafeStorage';
import { accountStorageBarrier, CleanupFencedError } from '../lib/localAccountCleanup';
import { initializeAccountDeletionControl } from '../lib/accountDeletionControl';

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
  if (!appStorage) {
    void initializeAccountDeletionControl().catch(() => undefined);
    const hydrated = createHydrationSafeStorage(AsyncStorage);
    const guarded = accountStorageBarrier.wrap({
      getItem: async key => await hydrated.getItem(key),
      setItem: async (key, value) => { await hydrated.setItem(key, value); },
      removeItem: async key => { await hydrated.removeItem(key); },
    });
    const oneShot = accountStorageBarrier.wrap({
      getItem: key => hydrated.getItemOnce(key),
      setItem: async () => {}, removeItem: async () => {},
    });
    appStorage = { ...hydrated, ...guarded, getItemOnce: key => oneShot.getItem(key) };
  }
  return appStorage;
}

export function createAppJSONStorage() {
  const json = createJSONStorage(() => getAppStorage());
  return json && { ...json, setItem: async (key: string, value: Parameters<typeof json.setItem>[1]) => {
    try { await json.setItem(key, value); }
    catch (error) { if (!(error instanceof CleanupFencedError)) throw error; }
  } };
}
