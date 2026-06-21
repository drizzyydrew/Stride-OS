import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StravaTokens } from '../lib/strava';
import { clearStravaTokens } from '../lib/strava';

type IntegrationsStore = {
  healthKitEnabled:   boolean;
  stravaConnected:    boolean;
  stravaAccessToken:  string | null;
  stravaRefreshToken: string | null;
  stravaTokenExpiry:  number | null;

  setHealthKit: (enabled: boolean)           => void;
  setStrava:    (tokens: StravaTokens | null) => void;
};

export const useIntegrationsStore = create<IntegrationsStore>()(
  persist(
    (set) => ({
      healthKitEnabled:   false,
      stravaConnected:    false,
      stravaAccessToken:  null,
      stravaRefreshToken: null,
      stravaTokenExpiry:  null,

      setHealthKit: (enabled) => set({ healthKitEnabled: enabled }),

      setStrava: (tokens) => {
        if (!tokens) {
          clearStravaTokens().catch(console.warn);
          set({
            stravaConnected:    false,
            stravaAccessToken:  null,
            stravaRefreshToken: null,
            stravaTokenExpiry:  null,
          });
        } else {
          set({
            stravaConnected:    true,
            stravaAccessToken:  tokens.access_token,
            stravaRefreshToken: tokens.refresh_token,
            stravaTokenExpiry:  tokens.expires_at,
          });
        }
      },
    }),
    {
      name:    'integrations-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        healthKitEnabled:   state.healthKitEnabled,
        stravaConnected:    state.stravaConnected,
        stravaAccessToken:  state.stravaAccessToken,
        stravaRefreshToken: state.stravaRefreshToken,
        stravaTokenExpiry:  state.stravaTokenExpiry,
      }),
    },
  ),
);
