import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StravaTokens } from '../lib/strava';
import { clearStravaTokens } from '../lib/strava';

type IntegrationsStore = {
  healthKitEnabled:   boolean;
  locationEnabled:    boolean;
  notificationsEnabled: boolean;
  notificationTime:   string;
  workoutNotifications: boolean;
  readinessNotifications: boolean;
  stravaConnected:    boolean;
  stravaAccessToken:  string | null;
  stravaRefreshToken: string | null;
  stravaTokenExpiry:  number | null;

  setHealthKit: (enabled: boolean)           => void;
  setLocation:  (enabled: boolean)           => void;
  setNotifications: (enabled: boolean)       => void;
  setNotificationTime: (time: string)        => void;
  setWorkoutNotifications: (enabled: boolean) => void;
  setReadinessNotifications: (enabled: boolean) => void;
  setStrava:    (tokens: StravaTokens | null) => void;
};

export const useIntegrationsStore = create<IntegrationsStore>()(
  persist(
    (set) => ({
      healthKitEnabled:   false,
      locationEnabled:    false,
      notificationsEnabled: true,
      notificationTime:   '07:00',
      workoutNotifications: true,
      readinessNotifications: true,
      stravaConnected:    false,
      stravaAccessToken:  null,
      stravaRefreshToken: null,
      stravaTokenExpiry:  null,

      setHealthKit: (enabled) => set({ healthKitEnabled: enabled }),
      setLocation: (enabled) => set({ locationEnabled: enabled }),
      setNotifications: (enabled) => set({ notificationsEnabled: enabled }),
      setNotificationTime: (time) => set({ notificationTime: time }),
      setWorkoutNotifications: (enabled) => set({ workoutNotifications: enabled }),
      setReadinessNotifications: (enabled) => set({ readinessNotifications: enabled }),

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
            stravaAccessToken:  null,
            stravaRefreshToken: null,
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
        locationEnabled:    state.locationEnabled,
        notificationsEnabled: state.notificationsEnabled,
        notificationTime:   state.notificationTime,
        workoutNotifications: state.workoutNotifications,
        readinessNotifications: state.readinessNotifications,
        stravaConnected:    state.stravaConnected,
        stravaTokenExpiry:  state.stravaTokenExpiry,
      }),
      merge: (persisted, current) => {
        const state = persisted as Partial<IntegrationsStore> | undefined;
        return {
          ...current,
          ...state,
          stravaAccessToken: null,
          stravaRefreshToken: null,
        };
      },
    },
  ),
);
