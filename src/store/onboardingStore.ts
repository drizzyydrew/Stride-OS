// ─── Onboarding Store ───────────────────────────────────────────────────────
//
// Tracks the multi-step onboarding flow. When onboardingComplete = true,
// the root layout routes to (tabs). When false, it routes to (onboarding).
//
// onboardingStore is intentionally lightweight — it stores only raw input.
// The profile + athlete stores receive the finalized data on completion.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage, getAppStorage } from './persistStorage';
import { ownerLeaseIsCurrent, type OwnerLease } from '../lib/localDataOwner';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Sex, TrainingDay, StandardDistance, WeightProvenance } from '../types/athlete';
import { useProfileStore } from './profileStore';
import { matchingWeightProvenance, migrateStoredWeight, preserveWeightProvenance, userEnteredWeightPatch } from '../utils/profilePower';
import type { ProgressionLevel, GoalType, StrengthLevel, TrainingStyle, RaceDistance } from '../types/training';
import { normalizeSupportingGoals } from '../utils/trainingGoals';
import type { TrainingGoalType, RacePriority } from '../types/plan';
import type { EquipmentOption } from '../types/strength';

// Re-export so existing consumers importing from onboardingStore don't break.
export type { GoalType, StrengthLevel, TrainingStyle };

// ─── Onboarding data shape ────────────────────────────────────────────────────

export type OnboardingData = {
  // Step 1: Name
  name:            string;
  firstName?: string;
  lastName?: string;
  username?: string;
  showName?: boolean;
  showUsername?: boolean;
  identityConfigured?: boolean;

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
  dateOfBirth?:    string | null;
  sex:             Sex;
  heightCm:        number;
  weightKg:        number;
  weightProvenance?: WeightProvenance | null;
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
  strengthSessionMinutes?: number;
  strengthEquipment?: EquipmentOption[];
  strengthExercisePreferences?: Record<string, string>;

  // Step 8: Injury
  hasCurrentInjury: boolean;
  injuryNotes:      string;

  // Step 9: Style
  trainingStyle:   TrainingStyle;

  // Profile
  profilePhotoUri: string | null;

  // Build 33 plan spine — Step 2 (goal.tsx)
  goalType:         TrainingGoalType;
  secondaryGoalTypes?: TrainingGoalType[];
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
  weightProvenance: null,
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
  secondaryGoalTypes: [],
  raceName:         '',
  raceDistance:     'half_marathon',
  raceDate:         '',
  racePriority:     'A',
  programStartDate: '',
};

// ─── Store shape ──────────────────────────────────────────────────────────────

export const ONBOARDING_TOTAL_STEPS = 12;  // Welcome + identity + 10 existing steps

type OnboardingStore = {
  onboardingComplete: boolean;
  currentStep:        number;
  data:               OnboardingData;

  setStep:       (step: number) => void;
  updateData:    (patch: Partial<OnboardingData>) => void;
  setUserWeight: (weightKg: number) => boolean;
  completeOnboarding: () => void;
  resetOnboarding:    () => void;
};

// ─── Implementation ───────────────────────────────────────────────────────────

let onboardingWrites: Promise<unknown> = Promise.resolve();
const onboardingJSONStorage = createAppJSONStorage();
const onboardingStorage: typeof onboardingJSONStorage = onboardingJSONStorage && {
  ...onboardingJSONStorage,
  setItem: (name, value) => {
    // Start at the existing account-storage boundary immediately; tracking
    // these writes must not defer an old owner's payload into a new epoch.
    const write = Promise.resolve(onboardingJSONStorage.setItem(name, value));
    onboardingWrites = Promise.all([onboardingWrites.catch(() => undefined), write]);
    void onboardingWrites.catch(() => undefined);
    return write;
  },
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      onboardingComplete: false,
      currentStep:        0,
      data:               DEFAULT_DATA,

      setStep: (step) => set({ currentStep: step }),

      updateData: (patch) =>
        set(state => {
          const scoped = { ...patch };
          // This legacy global weight belongs only to the original athlete.
          if (useProfileStore.getState().activeAthleteId !== 'athlete_default') {
            delete scoped.weightKg;
            delete scoped.weightProvenance;
          }
          return { data: { ...state.data, ...preserveWeightProvenance(state.data, scoped),
            secondaryGoalTypes: normalizeSupportingGoals(scoped.goalType ?? state.data.goalType, scoped.secondaryGoalTypes ?? state.data.secondaryGoalTypes) } };
        }),

      setUserWeight: (weightKg) => {
        const patch = userEnteredWeightPatch(weightKg);
        if (!patch) return false;
        const profiles = useProfileStore.getState();
        const athleteId = profiles.activeAthleteId;
        if (athleteId !== 'athlete_default') {
          if (!profiles.profiles[athleteId]) return false;
          profiles.updateProfile(athleteId, patch);
          return true;
        }
        get().updateData(patch);
        if (get().onboardingComplete) profiles.updateProfile(athleteId, patch);
        return true;
      },

      completeOnboarding: () =>
        set({ onboardingComplete: true, currentStep: ONBOARDING_TOTAL_STEPS }),

      resetOnboarding: () =>
        set({ onboardingComplete: false, currentStep: 0, data: DEFAULT_DATA }),
    }),
    {
      name:    'onboarding-store',
      storage: onboardingStorage,
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<OnboardingStore>;
        return { ...state, data: migrateStoredWeight(state.data ?? DEFAULT_DATA) };
      },
      onRehydrateStorage: () => (state, error) => {
        if (!state || error) return;
        if (useProfileStore.persist.hasHydrated()) syncLegacyOnboardingWeight(state);
        else {
          const unsubscribe = useProfileStore.persist.onFinishHydration(() => {
            unsubscribe();
            syncLegacyOnboardingWeight(useOnboardingStore.getState());
          });
        }
      },
      // Older persisted stores predate the Build 33 plan-spine fields on
      // `data` (goalType/raceName/raceDistance/raceDate/racePriority/
      // programStartDate) — merge onto DEFAULT_DATA so existing users get
      // sensible defaults instead of `undefined`.
      merge: (persisted, current) => {
        const state = persisted as Partial<OnboardingStore> | undefined;
        return {
          ...current,
          ...state,
          data: { ...DEFAULT_DATA, ...current.data, ...state?.data,
            secondaryGoalTypes: normalizeSupportingGoals(state?.data?.goalType ?? current.data.goalType, state?.data?.secondaryGoalTypes ?? current.data.secondaryGoalTypes) },
        };
      },
    },
  ),
);

/** Publish limited planning choices only after their same-owner bytes survive
 * readback. This does not change the legacy updateData contract. */
export async function saveStrengthPlanningPreferences(
  patch: Partial<Pick<OnboardingData, 'strengthLevel' | 'strengthSessionMinutes' | 'strengthEquipment'>>
    & { strengthExercisePreferences?: Record<string, string | null> },
  lease: OwnerLease,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ready = () => ownerLeaseIsCurrent(lease) && useOnboardingStore.persist.hasHydrated()
      && useProfileStore.getState().activeAthleteId === 'athlete_default';
    if (!ready()) throw new Error('Planning preferences are not ready for this athlete');
    await onboardingWrites.catch(() => undefined);
    if (!ready()) throw new Error('The account changed while saving');
    const previous = useOnboardingStore.getState();
    const preferences = { ...previous.data.strengthExercisePreferences };
    for (const [exerciseId, target] of Object.entries(patch.strengthExercisePreferences ?? {})) {
      if (target === null) delete preferences[exerciseId];
      else if (typeof target === 'string' && target) preferences[exerciseId] = target;
      else throw new Error('Invalid exercise preference');
    }
    const data: OnboardingData = { ...previous.data, ...patch,
      strengthExercisePreferences: patch.strengthExercisePreferences ? preferences : previous.data.strengthExercisePreferences };
    const encoded = JSON.stringify({ state: { onboardingComplete: previous.onboardingComplete, currentStep: previous.currentStep, data }, version: 1 });
    const storage = getAppStorage();
    await storage.setItem('onboarding-store', encoded);
    if (!ready()) throw new Error('The account changed while saving');
    if (await storage.getItemOnce('onboarding-store') !== encoded) throw new Error('Planning preferences could not be confirmed');
    if (!ready()) throw new Error('The account changed while saving');
    if (useOnboardingStore.getState() !== previous) continue;
    useOnboardingStore.setState({ data });
    await onboardingWrites;
    if (!ready()) throw new Error('The account changed while saving');
    if (useOnboardingStore.getState().data !== data) continue;
    if (await storage.getItemOnce('onboarding-store') !== encoded) throw new Error('Planning preferences could not be confirmed');
    if (!ready()) throw new Error('The account changed while saving');
    return;
  }
  throw new Error('Planning preferences changed while saving; retry your choice');
}

function syncLegacyOnboardingWeight(state: OnboardingStore) {
  if (!state.onboardingComplete) return;
  // The legacy global onboarding record belongs only to the original default athlete.
  const profiles = useProfileStore.getState();
  const original = profiles.profiles.athlete_default;
  const evidence = matchingWeightProvenance(state.data.weightKg, state.data.weightProvenance);
  if (!original) return;
  const existing = matchingWeightProvenance(original.weightKg, original.weightProvenance);
  if (!evidence) {
    if (existing?.source === 'legacy_nondefault' && original.weightKg !== state.data.weightKg) {
      profiles.updateProfile('athlete_default', { weightProvenance: null });
    }
    return;
  }
  if (existing?.source === 'user_entered' && (evidence.source !== 'user_entered' || existing.savedAt >= evidence.savedAt)) return;
  if (original.weightKg === state.data.weightKg && existing?.source === 'legacy_nondefault' && evidence.source === 'legacy_nondefault') return;
  profiles.updateProfile('athlete_default', { weightKg: state.data.weightKg, weightProvenance: evidence });
}
