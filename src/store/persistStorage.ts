import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const serverStorage: StateStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export function getAppStorage(): StateStorage {
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return serverStorage;
  }
  return AsyncStorage;
}

export function createAppJSONStorage() {
  return createJSONStorage(() => getAppStorage());
}
