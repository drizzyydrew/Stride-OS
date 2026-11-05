import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createAppJSONStorage } from './persistStorage';
import type { AchievementId } from '../utils/achievements';
import type { RacePrNotification } from '../utils/racePrAwards';

export type AwardedAchievement = {
  id: AchievementId;
  awardedAt: number;
  supportingActivityIds?: string[];
  supportingSessionIds?: string[];
  racePR?: RacePrNotification;
};

type AchievementStore = {
  awarded: AwardedAchievement[];
  unlockQueue: AwardedAchievement[];
  recordAwards: (ids: (AchievementId | Omit<AwardedAchievement, 'awardedAt'> | AwardedAchievement)[], awardedAt?: number) => void;
  publishRacePrAwards: (owned: AwardedAchievement[], notifications: AwardedAchievement[], current: () => boolean) => Promise<void>;
  dismissNextUnlock: () => void;
  dismissRacePrUnlock: (eventKey: string) => void;
};

export const useAchievementStore = create<AchievementStore>()(
  persist(
    set => ({
      awarded: [],
      unlockQueue: [],
      recordAwards: (ids, awardedAt = Date.now()) => set(state => {
        const existing = new Set(state.awarded.map(item => item.id));
        const next = ids
          .filter(item => !existing.has(typeof item === 'string' ? item : item.id))
          .map(item => {
            if (typeof item === 'string') return { id: item, awardedAt };
            return { ...item, awardedAt: 'awardedAt' in item ? item.awardedAt : awardedAt };
          });
        return next.length ? { awarded: [...state.awarded, ...next], unlockQueue: [...state.unlockQueue, ...next] } : state;
      }),
      publishRacePrAwards: async (owned, notifications, current) => {
        if (!current()) return;
        // The owner-scoped PR ledger is already durable. Force this ownership
        // write even after a previous persist failure published in memory.
        await set(state => {
          if (!current()) return state;
          const ids = new Set(state.awarded.map(item => item.id));
          return { awarded: [...state.awarded, ...owned.filter(item => !ids.has(item.id))] };
        });
        if (!current()) return;
        await set(state => {
          if (!current()) return state;
          const queued = new Set(state.unlockQueue.map(item => item.racePR?.eventKey).filter(Boolean));
          return { unlockQueue: [...state.unlockQueue, ...notifications.filter(item => item.racePR && !queued.has(item.racePR.eventKey))] };
        });
      },
      dismissNextUnlock: () => set(state => (
        state.unlockQueue.length ? { unlockQueue: state.unlockQueue.slice(1) } : state
      )),
      dismissRacePrUnlock: eventKey => set(state => (
        state.unlockQueue[0]?.racePR?.eventKey === eventKey ? { unlockQueue: state.unlockQueue.slice(1) } : state
      )),
    }),
    {
      name: 'achievement-store',
      version: 1,
      storage: createAppJSONStorage(),
      partialize: state => ({ awarded: state.awarded }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AchievementStore> | undefined;
        return { ...current, ...saved, awarded: saved?.awarded ?? [], unlockQueue: [] };
      },
    },
  ),
);
