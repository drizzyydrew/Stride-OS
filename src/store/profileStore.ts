// ─── Profile Store ─────────────────────────────────────────────────────────────
//
// MULTI-ATHLETE ARCHITECTURE
//   All profiles are stored in a Record<athleteId, AthleteProfile>.
//   `activeAthleteId` is the currently selected profile.
//   Every UI selector goes through `getActiveProfile()` — if/when StrideOS adds
//   team/coach accounts, only this store changes. Zero callers need to be updated.
//
//   To add a second athlete: createProfile(newProfile) → setActiveAthlete(newId)
//   The `profiles` map holds them all indefinitely (local-first, AsyncStorage).
//
// CALIBRATION SYNC
//   `recalibrate()` recomputes CalibrationOutput from current profile data +
//   fresh workout history signals passed in as arguments. Call it after:
//     - Any profile field edit (PR, threshold pace, HR data)
//     - Weekly workout review (pass updated recentWorkoutCount)
//     - App foreground (stale check; skip if < 24h since last calibration)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  AthleteProfile, AthleteProfileMap, RacePR, InjuryRecord, TrainingDay,
  CalibrationInput, CalibrationOutput, ThresholdTestData, MAFTestRecord, ZoneMethod,
} from '../types/athlete';
import type { RaceDistance, TrainingPhase } from '../types/training';
import { runCalibration, createDefaultProfile } from '../utils/calibrationEngine';

// ─── Store shape ───────────────────────────────────────────────────────────────

type ProfileStore = {
  profiles:        AthleteProfileMap;
  activeAthleteId: string;

  // ── Selectors (stable across renders via Zustand's equality check) ───────────
  getActiveProfile: () => AthleteProfile | undefined;
  getProfile:       (id: string) => AthleteProfile | undefined;

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  initDefaultProfile: (name: string, vo2Estimate: number) => void;
  createProfile:      (profile: AthleteProfile) => void;
  setActiveAthlete:   (id: string) => void;

  // ── Generic profile patch (escapes the need for N individual setters) ────────
  updateProfile: (id: string, patch: Partial<AthleteProfile>) => void;
  updateActive:  (patch: Partial<AthleteProfile>) => void;

  // ── PR management ────────────────────────────────────────────────────────────
  addRacePR:    (id: string, pr: RacePR) => void;
  removeRacePR: (id: string, prId: string) => void;

  // ── Injury management ─────────────────────────────────────────────────────────
  addInjury:    (id: string, injury: InjuryRecord) => void;
  updateInjury: (id: string, injuryId: string, patch: Partial<InjuryRecord>) => void;

  // ── Threshold test ────────────────────────────────────────────────────────────
  setThresholdTest: (id: string, test: ThresholdTestData) => void;
  clearThresholdTest: (id: string) => void;

  // ── MAF tests ─────────────────────────────────────────────────────────────────
  addMAFTest:    (id: string, test: MAFTestRecord) => void;
  removeMAFTest: (id: string, testId: string) => void;

  // ── Zone method ───────────────────────────────────────────────────────────────
  setZoneMethod: (id: string, method: ZoneMethod) => void;

  // ── Calibration ───────────────────────────────────────────────────────────────
  recalibrate: (calInput: Omit<CalibrationInput, 'profile'>) => CalibrationOutput | null;
};

// ─── Default athlete ID ────────────────────────────────────────────────────────

const DEFAULT_ID = 'athlete_default';

// ─── Store implementation ──────────────────────────────────────────────────────

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles:        {},
      activeAthleteId: DEFAULT_ID,

      // ── Selectors ──────────────────────────────────────────────────────────────
      getActiveProfile: () => get().profiles[get().activeAthleteId],
      getProfile:       (id) => get().profiles[id],

      // ── Lifecycle ──────────────────────────────────────────────────────────────

      initDefaultProfile: (name, vo2Estimate) => {
        const existing = get().profiles[DEFAULT_ID];
        if (existing) return;   // already seeded — never overwrite real data

        const profile = createDefaultProfile({
          athleteId:   DEFAULT_ID,
          name,
          vo2Estimate,
        });

        set(state => ({
          profiles:        { ...state.profiles, [DEFAULT_ID]: profile },
          activeAthleteId: DEFAULT_ID,
        }));
      },

      createProfile: (profile) =>
        set(state => ({
          profiles: { ...state.profiles, [profile.athleteId]: profile },
        })),

      setActiveAthlete: (id) => set({ activeAthleteId: id }),

      // ── Updates ────────────────────────────────────────────────────────────────

      updateProfile: (id, patch) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: { ...prev, ...patch, updatedAt: Date.now() },
            },
          };
        }),

      updateActive: (patch) => {
        const id = get().activeAthleteId;
        get().updateProfile(id, patch);
      },

      // ── PR management ──────────────────────────────────────────────────────────

      addRacePR: (id, pr) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: {
                ...prev,
                racePRs:   [...prev.racePRs, pr],
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeRacePR: (id, prId) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: {
                ...prev,
                racePRs:   prev.racePRs.filter(p => p.id !== prId),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      // ── Threshold test ──────────────────────────────────────────────────────────

      setThresholdTest: (id, test) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: { ...prev, thresholdTest: test, hrThreshold: test.avgHRLastTwentyMin, thresholdPaceSecPerMi: test.avgPaceSecPerMiLastTwenty, updatedAt: Date.now() },
            },
          };
        }),

      clearThresholdTest: (id) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: { ...prev, thresholdTest: null, updatedAt: Date.now() },
            },
          };
        }),

      // ── MAF tests ───────────────────────────────────────────────────────────────

      addMAFTest: (id, test) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: { ...prev, mafTests: [...prev.mafTests, test], updatedAt: Date.now() },
            },
          };
        }),

      removeMAFTest: (id, testId) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: { ...prev, mafTests: prev.mafTests.filter(t => t.id !== testId), updatedAt: Date.now() },
            },
          };
        }),

      // ── Zone method ─────────────────────────────────────────────────────────────

      setZoneMethod: (id, method) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: { ...prev, activeZoneMethod: method, updatedAt: Date.now() },
            },
          };
        }),

      // ── Injury management ───────────────────────────────────────────────────────

      addInjury: (id, injury) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: {
                ...prev,
                injuryHistory: [...prev.injuryHistory, injury],
                updatedAt:     Date.now(),
              },
            },
          };
        }),

      updateInjury: (id, injuryId, patch) =>
        set(state => {
          const prev = state.profiles[id];
          if (!prev) return state;
          return {
            profiles: {
              ...state.profiles,
              [id]: {
                ...prev,
                injuryHistory: prev.injuryHistory.map(inj =>
                  inj.id === injuryId ? { ...inj, ...patch } : inj,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      // ── Calibration ────────────────────────────────────────────────────────────

      recalibrate: (calInput) => {
        const id      = get().activeAthleteId;
        const profile = get().profiles[id];
        if (!profile) return null;

        const output = runCalibration({ ...calInput, profile });

        set(state => ({
          profiles: {
            ...state.profiles,
            [id]: {
              ...profile,
              calibration: output,
              vdot:        output.vdot,
              updatedAt:   Date.now(),
            },
          },
        }));

        return output;
      },
    }),
    {
      name:    'profile-store',
      storage: createAppJSONStorage(),
      partialize: (state) => ({
        profiles:        state.profiles,
        activeAthleteId: state.activeAthleteId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Migrate existing profiles to include fields added after initial schema.
        const migrated: AthleteProfileMap = {};
        for (const [id, profile] of Object.entries(state.profiles)) {
          migrated[id] = {
            ...profile,
            hrMaxManual:      profile.hrMaxManual      ?? false,
            thresholdTest:    profile.thresholdTest    ?? null,
            mafTests:         profile.mafTests         ?? [],
            activeZoneMethod: profile.activeZoneMethod ?? 'vdot',
            runDays:          profile.runDays          ?? profile.availableDays,
            liftDays:         profile.liftDays         ?? [],
          };
        }
        state.profiles = migrated;
      },
    },
  ),
);

// ─── Convenience selectors (stable hooks) ─────────────────────────────────────
//
// These are the canonical access points. When multi-athlete is added, only
// these signatures need to gain an optional `athleteId` parameter.

export function useActiveProfile(): AthleteProfile | undefined {
  return useProfileStore(s => s.profiles[s.activeAthleteId]);
}

export function useCalibration(): CalibrationOutput | null {
  return useProfileStore(s => {
    const p = s.profiles[s.activeAthleteId];
    return p?.calibration ?? null;
  });
}

export function useReadinessThresholds() {
  const cal = useCalibration();
  return {
    highFatigue:      cal ? Math.round(75 / cal.fatigueMultiplier)  : 75,
    criticalFatigue:  cal ? Math.round(85 / cal.fatigueMultiplier)  : 85,
    poorRecovery:     cal ? Math.round(50 / cal.recoveryMultiplier) : 50,
    criticalRecovery: cal ? Math.round(35 / cal.recoveryMultiplier) : 35,
  };
}
