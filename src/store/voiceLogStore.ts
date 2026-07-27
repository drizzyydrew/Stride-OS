import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createAppJSONStorage } from './persistStorage';
import type { VoiceCueCategory } from '../utils/voiceCoaching';
import type { VoiceDeliveryState } from '../utils/voiceCoachDelivery';
import { trimVoiceLogEntries, VOICE_LOG_CAP } from '../utils/voiceLog';

export type VoiceLogEntry = {
  cueId: string;
  category: VoiceCueCategory;
  text: string;
  state: VoiceDeliveryState;
  at: number;
  reason?: string;
};

type VoiceLogStore = {
  entries: VoiceLogEntry[];
  record: (entry: VoiceLogEntry) => void;
  clear: () => void;
};

export const useVoiceLogStore = create<VoiceLogStore>()(
  persist(
    (set) => ({
      entries: [],
      record: entry => set(state => ({
        entries: trimVoiceLogEntries([entry, ...state.entries]),
      })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: 'voice-log-store',
      version: 1,
      storage: createAppJSONStorage(),
      partialize: state => ({ entries: trimVoiceLogEntries(state.entries) }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<VoiceLogStore> | undefined;
        return {
          ...current,
          entries: Array.isArray(saved?.entries) ? trimVoiceLogEntries(saved.entries, VOICE_LOG_CAP) : [],
        };
      },
    },
  ),
);
