// ─── Onboarding Store ───────────────────────────────────────────────────────
//
// Tracks the multi-step onboarding flow. When onboardingComplete = true,
// the root layout routes to (tabs). When false, it routes to (onboarding).
//
// onboardingStore is intentionally lightweight — it stores only raw input.
// The profile + athlete stores receive the finalized data on completion.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Sex, TrainingDay, StandardDistance } from '../types/athlete';
import type { ProgressionLevel, GoalType, StrengthLevel, TrainingStyle, RaceDistance } from '../types/training';
import type { TrainingGoalType, RacePriority } from '../types/plan';

// Re-export so existing consumers importing from onboardingStore don't break.
export type { GoalType, StrengthLevel, TrainingStyle };

// ─── Onboarding data shape ────────────────────────────────────────────────────

export type OnboardingData = {
  // Step 1: Name
  name:            string;

  // Step 2: Goal
  primaryGoal:     GoalType;
  goalRaceLabel:   string;  // "Sub-4 Marathon", "5K PR", custom text

  // Step 3: Experience
  yearsRunning:    number;
  weeklyMileage:   number;

  // Step 4: Race PR (optional)
  hasPR:           boolean;
  prDistance:      StandardDistance | null;
  prTimeSeconds:   number;
  prDate:          string;

  // Step 5: Physiology
  age:             number;
  sex:             Sex;
  heightCm:        number;
  weightKg:        number;
  hrResting:       number | null;
  hrMax:           number | null;
  hrMaxManual:     boolean;

  // Step 6: Availability
  availableDays:   TrainingDay[];
  runDays:         TrainingDay[];
  liftDays:        TrainingDay[];
  targetSessions:  number;

  // Step 7: Strength
  strengthLevel:   StrengthLevel;

  // Step 8: Injury
  hasCurrentInjury: boolean;
  injuryNotes:      string;

  // Step 9: Style
  trainingStyle:   TrainingStyle;

  // Profile
  profilePhotoUri: string | null;

  // Build 33 plan spine — Step 2 (goal.tsx)
  goalType:         TrainingGoalType;
  raceName:         string;
  raceDistance:     RaceDistance;
  raceDate:         string;          // "YYYY-MM-DD", '' = unset
  racePriority:     RacePriority;
  programStartDate: string;          // "YYYY-MM-DD", '' = default to today at completion
};

const DEFAULT_DATA: OnboardingData = {
  name:             '',
  primaryGoal:      'general_fitness',
  goalRaceLabel:    '',
  yearsRunning:     0,
  weeklyMileage:    20,
  hasPR:            false,
  prDistance:       null,
  prTimeSeconds:    0,
  prDate:           '',
  age:              30,
  sex:              'prefer_not_to_say',
  heightCm:         175,
  weightKg:         70,
  hrResting:        null,
  hrMax:            null,
  hrMaxManual:      false,
  availableDays:    ['Mon', 'Wed', 'Fri', 'Sat'],
  runDays:          ['Mon', 'Wed', 'Fri', 'Sat'],
  liftDays:         ['Tue', 'Thu'],
  targetSessions:   4,
  strengthLevel:    'beginner',
  hasCurrentInjury: false,
  injuryNotes:      '',
  trainingStyle:    'mixed',
  profilePhotoUri:  null,

  goalType:         'general_running',
  raceName:         '',
  raceDistance:     'half_marathon',
  raceDate:         '',
  racePriority:     'A',
  programStartDate: '',
};

// ─── Store shape ──────────────────────────────────────────────────────────────

export const ONBOARDING_TOTAL_STEPS = 11;  // Welcome + 10 data steps

type OnboardingStore = {
  onboardingComplete: boolean;
  currentStep:        number;
  data:               OnboardingData;

  setStep:       (step: number) => void;
  updateData:    (patch: Partial<OnboardingData>) => void;
  completeOnboarding: () => void;
  resetOnboarding:    () => void;
};

// ─── Implementation ───────────────────────────────────────────────────────────

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      onboardingComplete: false,
      currentStep:        0,
      data:               DEFAULT_DATA,

      setStep: (step) => set({ currentStep: step }),

      updateData: (patch) =>
        set(state => ({ data: { ...state.data, ...patch } })),

      completeOnboarding: () =>
        set({ onboardingComplete: true, currentStep: ONBOARDING_TOTAL_STEPS }),

      resetOnboarding: () =>
        set({ onboardingComplete: false, currentStep: 0, data: DEFAULT_DATA }),
    }),
    {
      name:    'onboarding-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Older persisted stores predate the Build 33 plan-spine fields on
      // `data` (goalType/raceName/raceDistance/raceDate/racePriority/
      // programStartDate) — merge onto DEFAULT_DATA so existing users get
      // sensible defaults instead of `undefined`.
      merge: (persisted, current) => {
        const state = persisted as Partial<OnboardingStore> | undefined;
        return {
          ...current,
          ...state,
          data: { ...DEFAULT_DATA, ...current.data, ...state?.data },
        };
      },
    },
  ),
);
