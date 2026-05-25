import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TrainingPhase, ProgressionLevel } from '../types/training';
import { calculateRecoveryScore } from '../utils/calculateRecoveryScore';
import { resolveProgressionLevel } from '../utils/progression';
import { buildPeriodizationPlan, resolveTrainingPhase } from '../utils/periodization';

const DECAY_PER_DAY = 0.90;
const DAY_MS        = 24 * 60 * 60 * 1000;

type AthleteState = {
  athleteName:    string;
  goalRace:       string;

  sleepHours:     number;
  restingHRDelta: number;

  weeklyMileage:  number;
  fatigueScore:   number;
  recoveryScore:  number;
  vo2Estimate:    number;

  // Rolling easy-load sum (7-day window, updated by workoutStore via callback)
  recentEasyLoad:    number;
  // Timestamp of last fatigue write — used for passive decay on idle days
  lastFatigueUpdate: number;

  currentWeek:      number;
  trainingPhase:    TrainingPhase;
  progressionLevel: ProgressionLevel;

  setAthleteName:    (name: string)  => void;
  setGoalRace:       (race: string)  => void;
  setWeeklyMileage:  (miles: number) => void;

  setSleepHours:      (hours: number) => void;
  setRestingHRDelta:  (delta: number) => void;
  setFatigueScore:    (score: number) => void;
  setRecentEasyLoad:  (load: number)  => void;

  setCurrentWeek:      (week: number)         => void;
  setTrainingPhase:    (phase: TrainingPhase)  => void;
  setProgressionLevel: (level: ProgressionLevel) => void;

  // Applies passive time-based fatigue decay for idle days, then recomputes
  // recoveryScore from the updated fatigue + current sleep/HR signals.
  // Called by every setter that affects readiness, and on store rehydration.
  recalculateRecovery: () => void;
};

export const useAthleteStore = create<AthleteState>()(
  persist(
    (set, get) => ({
      athleteName: 'Drew Moore',
      goalRace:    'Sub 5 Marathon',

      sleepHours:     7.5,
      restingHRDelta: 2,

      weeklyMileage: 42.6,
      fatigueScore:  38,
      recoveryScore: 72,
      vo2Estimate:   51.2,

      recentEasyLoad:    0,
      lastFatigueUpdate: Date.now(),

      currentWeek:      1,
      trainingPhase:    'base',
      progressionLevel: 'intermediate',

      setAthleteName: (name) => set({ athleteName: name }),

      setGoalRace: (race) => {
        const { weeklyMileage, currentWeek } = get();
        const plan     = buildPeriodizationPlan(race, weeklyMileage);
        const safeWeek = Math.min(currentWeek, plan.totalWeeks);
        const phase    = resolveTrainingPhase(safeWeek, plan);
        set({ goalRace: race, currentWeek: safeWeek, trainingPhase: phase });
      },

      setWeeklyMileage: (miles) => {
        set({ weeklyMileage: miles });
        get().recalculateRecovery();
      },

      setSleepHours: (hours) => {
        set({ sleepHours: hours });
        get().recalculateRecovery();
      },

      setRestingHRDelta: (delta) => {
        set({ restingHRDelta: delta });
        get().recalculateRecovery();
      },

      // Setting fatigue from outside (workoutStore callback): stamp lastFatigueUpdate
      // so the subsequent recalculateRecovery call sees ~0 idle days and doesn't
      // double-decay the value that calculateUpdatedFatigue already decayed.
      setFatigueScore: (score) => {
        set({ fatigueScore: score, lastFatigueUpdate: Date.now() });
        get().recalculateRecovery();
      },

      // Updated by workoutStore after each completion — stores the 7-day rolling
      // sum of easy + very_easy estimatedLoad so recalculateRecovery can use it.
      setRecentEasyLoad: (load) => {
        set({ recentEasyLoad: load });
        get().recalculateRecovery();
      },

      setCurrentWeek: (week) => {
        const { goalRace, weeklyMileage } = get();
        const plan  = buildPeriodizationPlan(goalRace, weeklyMileage);
        const phase = resolveTrainingPhase(week, plan);
        set({ currentWeek: week, trainingPhase: phase });
      },

      setTrainingPhase:    (phase) => set({ trainingPhase: phase }),
      setProgressionLevel: (level) => set({ progressionLevel: level }),

      recalculateRecovery: () => {
        const {
          sleepHours, restingHRDelta, fatigueScore,
          recentEasyLoad, weeklyMileage, lastFatigueUpdate,
        } = get();

        // Passive decay: if days have passed since the last fatigue write
        // (e.g. the user didn't log a workout), reduce stored fatigue now.
        const daysSinceUpdate = Math.max(0, (Date.now() - lastFatigueUpdate) / DAY_MS);
        const effectiveFatigue = Math.max(
          0,
          Math.round(fatigueScore * Math.pow(DECAY_PER_DAY, daysSinceUpdate)),
        );

        const updatedRecovery = calculateRecoveryScore({
          sleepHours,
          restingHRDelta,
          fatigueScore:   effectiveFatigue,
          recentEasyLoad,
        });

        set({
          fatigueScore:     effectiveFatigue,
          recoveryScore:    updatedRecovery,
          progressionLevel: resolveProgressionLevel(weeklyMileage),
          // Stamp the update time so the next recalculation starts from now.
          lastFatigueUpdate: Date.now(),
        });
      },
    }),
    {
      name:    'athlete-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        athleteName:       state.athleteName,
        goalRace:          state.goalRace,
        sleepHours:        state.sleepHours,
        restingHRDelta:    state.restingHRDelta,
        weeklyMileage:     state.weeklyMileage,
        fatigueScore:      state.fatigueScore,
        recoveryScore:     state.recoveryScore,
        vo2Estimate:       state.vo2Estimate,
        recentEasyLoad:    state.recentEasyLoad,
        lastFatigueUpdate: state.lastFatigueUpdate,
        currentWeek:       state.currentWeek,
        trainingPhase:     state.trainingPhase,
        progressionLevel:  state.progressionLevel,
      }),
      // Apply passive fatigue decay immediately after the store is rehydrated
      // from AsyncStorage (i.e. on every app launch).
      onRehydrateStorage: () => (state) => {
        state?.recalculateRecovery();
      },
    },
  ),
);
