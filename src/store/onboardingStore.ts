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
import type { ProgressionLevel, GoalType, StrengthLevel, TrainingStyle } from '../types/training';

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
  targetSessions:   4,
  strengthLevel:    'beginner',
  hasCurrentInjury: false,
  injuryNotes:      '',
  trainingStyle:    'mixed',
  profilePhotoUri:  null,
};

// ─── Store shape ──────────────────────────────────────────────────────────────

export const ONBOARDING_TOTAL_STEPS = 10;  // Welcome + 9 data steps

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
    },
  ),
);
