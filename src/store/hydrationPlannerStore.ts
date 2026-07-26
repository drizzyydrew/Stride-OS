import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';

import type {
  CrampingFrequency,
  FluidComfort,
  GiTolerance,
  HydrationGoal,
  Saltiness,
  Sweatiness,
} from '../utils/hydrationEngine';

export type HydrationPlannerInputs = {
  distanceMi: number;
  durationMin: number | null;
  tempF: number;
  humidityPct: number;
  weatherSource: 'current_location' | 'manual';
  effort: number;
  sweatiness: Sweatiness;
  saltiness: Saltiness;
  cramping: CrampingFrequency;
  fluidComfort: FluidComfort;
  goal: HydrationGoal;
  giTolerance: GiTolerance | 'unsure';
  sweatRateMode: 'estimate' | 'known';
  sweatRateLh: number;
  sweatSodiumMgL: number | null;
  sweatTestPreWeightKg: number | null;
  sweatTestPostWeightKg: number | null;
  sweatTestFluidConsumedL: number;
  sweatTestUrineOutputL: number;
  sweatTestDurationMin: number;
  carbToleranceMode: 'known' | 'category' | 'unknown';
  knownCarbToleranceGh: number | null;
  carbProgressionTargetGh: number | null;
  hydrationReminderEnabled: boolean;
  hydrationReminderIntervalMin: number;
  hydrationReminderRecommendedMin: number;
  hydrationReminderSelection: 'recommended' | 'override';
  fuelReminderEnabled: boolean;
  fuelReminderIntervalMin: number;
  fuelReminderRecommendedMin: number;
  fuelReminderSelection: 'recommended' | 'override';
  migratedLegacyFuelInterval: boolean;
};

type HydrationPlannerStore = HydrationPlannerInputs & {
  updateInputs: (inputs: Partial<HydrationPlannerInputs>) => void;
  resetInputs: (inputs: HydrationPlannerInputs) => void;
};

export const HYDRATION_PLANNER_DEFAULTS: HydrationPlannerInputs = {
  distanceMi: 6,
  durationMin: null,
  tempF: 65,
  humidityPct: 50,
  weatherSource: 'current_location',
  effort: 5,
  sweatiness: 'average',
  saltiness: 'moderate',
  cramping: 'rarely',
  fluidComfort: 'moderate',
  goal: 'strong',
  giTolerance: 'unsure',
  sweatRateMode: 'estimate',
  sweatRateLh: 0.8,
  sweatSodiumMgL: null,
  sweatTestPreWeightKg: null,
  sweatTestPostWeightKg: null,
  sweatTestFluidConsumedL: 0,
  sweatTestUrineOutputL: 0,
  sweatTestDurationMin: 60,
  carbToleranceMode: 'unknown',
  knownCarbToleranceGh: null,
  carbProgressionTargetGh: null,
  hydrationReminderEnabled: true,
  hydrationReminderIntervalMin: 15,
  hydrationReminderRecommendedMin: 15,
  hydrationReminderSelection: 'recommended',
  fuelReminderEnabled: true,
  fuelReminderIntervalMin: 20,
  fuelReminderRecommendedMin: 20,
  fuelReminderSelection: 'recommended',
  migratedLegacyFuelInterval: false,
};

export const useHydrationPlannerStore = create<HydrationPlannerStore>()(
  persist(
    set => ({
      ...HYDRATION_PLANNER_DEFAULTS,
      updateInputs: inputs => set(inputs),
      resetInputs: inputs => set(inputs),
    }),
    {
      name: 'hydration-planner-inputs',
      storage: createAppJSONStorage(),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<HydrationPlannerStore> | undefined),
        hydrationReminderIntervalMin: Math.max(5, Math.min(60,
          (persisted as Partial<HydrationPlannerStore> | undefined)?.hydrationReminderIntervalMin
          ?? current.hydrationReminderIntervalMin)),
        fuelReminderIntervalMin: Math.max(5, Math.min(60,
          (persisted as Partial<HydrationPlannerStore> | undefined)?.fuelReminderIntervalMin
          ?? current.fuelReminderIntervalMin)),
      }),
      partialize: state => ({
        distanceMi: state.distanceMi,
        durationMin: state.durationMin,
        tempF: state.tempF,
        humidityPct: state.humidityPct,
        weatherSource: state.weatherSource,
        effort: state.effort,
        sweatiness: state.sweatiness,
        saltiness: state.saltiness,
        cramping: state.cramping,
        fluidComfort: state.fluidComfort,
        goal: state.goal,
        giTolerance: state.giTolerance,
        sweatRateMode: state.sweatRateMode,
        sweatRateLh: state.sweatRateLh,
        sweatSodiumMgL: state.sweatSodiumMgL,
        sweatTestPreWeightKg: state.sweatTestPreWeightKg,
        sweatTestPostWeightKg: state.sweatTestPostWeightKg,
        sweatTestFluidConsumedL: state.sweatTestFluidConsumedL,
        sweatTestUrineOutputL: state.sweatTestUrineOutputL,
        sweatTestDurationMin: state.sweatTestDurationMin,
        carbToleranceMode: state.carbToleranceMode,
        knownCarbToleranceGh: state.knownCarbToleranceGh,
        carbProgressionTargetGh: state.carbProgressionTargetGh,
        hydrationReminderEnabled: state.hydrationReminderEnabled,
        hydrationReminderIntervalMin: state.hydrationReminderIntervalMin,
        hydrationReminderRecommendedMin: state.hydrationReminderRecommendedMin,
        hydrationReminderSelection: state.hydrationReminderSelection,
        fuelReminderEnabled: state.fuelReminderEnabled,
        fuelReminderIntervalMin: state.fuelReminderIntervalMin,
        fuelReminderRecommendedMin: state.fuelReminderRecommendedMin,
        fuelReminderSelection: state.fuelReminderSelection,
        migratedLegacyFuelInterval: state.migratedLegacyFuelInterval,
      }),
    },
  ),
);
