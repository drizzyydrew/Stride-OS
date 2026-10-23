import { useEffect, useSyncExternalStore } from 'react';
import type { Activity } from '../../../src/types/activity';

let records: Activity[] = [];
let mode: 'dark' | 'light' = 'dark';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => listeners.forEach(listener => listener());
const state = {
  get activities() { return records; },
  updateActivity: (id: string, patch: Partial<Activity>) => {
    records = records.map(item => item.id === id ? { ...item, ...patch } : item); notify();
  },
};
export const useActivityStore = Object.assign(<T,>(selector: (value: typeof state) => T) => useSyncExternalStore(subscribe, () => selector(state)), { getState: () => state });
export function setFixtures(next: Activity[]) { records = next; notify(); }
export function useThemeMode() { return useSyncExternalStore(subscribe, () => mode); }
export function setFixtureTheme(next: 'dark' | 'light') { mode = next; notify(); }
export function useThemeStore<T>(selector: (value: { mode: 'dark' | 'light' }) => T): T {
  return selector({ mode: useThemeMode() });
}
const profile = { athleteId: 'synthetic-review', weightKg: 70, weightProvenance: { source: 'user_entered' as const, weightKg: 70, savedAt: 1 } };
export function useActiveProfile() { return profile; }
export function useFocusEffect(callback: () => void | (() => void)) { useEffect(callback, [callback]); }
export function usePathname() { return '/activity/synthetic-preview'; }
export function useRouter(): never { throw new Error('Navigation is not available in this synthetic component preview.'); }
