import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createAppJSONStorage } from './persistStorage';
import type { AchievementId } from '../utils/achievements';

export type AwardedAchievement = {
  id: AchievementId;
  awardedAt: number;
};

type AchievementStore = {
  awarded: AwardedAchievement[];
  recordAwards: (ids: AchievementId[], awardedAt?: number) => void;
};

export const useAchievementStore = create<AchievementStore>()(
  persist(
    set => ({
      awarded: [],
      recordAwards: (ids, awardedAt = Date.now()) => set(state => {
        const existing = new Set(state.awarded.map(item => item.id));
        const next = ids
          .filter(id => !existing.has(id))
          .map(id => ({ id, awardedAt }));
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
