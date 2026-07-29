import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createAppJSONStorage } from './persistStorage';
import type { AchievementId } from '../utils/achievements';

export type AwardedAchievement = {
  id: AchievementId;
  awardedAt: number;
  supportingActivityIds?: string[];
  supportingSessionIds?: string[];
};

type AchievementStore = {
  awarded: AwardedAchievement[];
  recordAwards: (ids: (AchievementId | Omit<AwardedAchievement, 'awardedAt'> | AwardedAchievement)[], awardedAt?: number) => void;
};

export const useAchievementStore = create<AchievementStore>()(
  persist(
    set => ({
      awarded: [],
      recordAwards: (ids, awardedAt = Date.now()) => set(state => {
        const existing = new Set(state.awarded.map(item => item.id));
        const next = ids
          .filter(item => !existing.has(typeof item === 'string' ? item : item.id))
          .map(item => {
            if (typeof item === 'string') return { id: item, awardedAt };
            return { ...item, awardedAt: 'awardedAt' in item ? item.awardedAt : awardedAt };
          });
        return next.length ? { awarded: [...state.awarded, ...next] } : state;
      }),
    }),
    {
      name: 'achievement-store',
      version: 1,
      storage: createAppJSONStorage(),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AchievementStore> | undefined;
        return { ...current, ...saved, awarded: saved?.awarded ?? [] };
      },
    },
  ),
);
