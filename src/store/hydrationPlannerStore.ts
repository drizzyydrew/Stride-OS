import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<HydrationPlannerStore> | undefined),
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
      }),
    },
  ),
);
