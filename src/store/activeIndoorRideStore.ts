// ─── Active Indoor Ride Store ─────────────────────────────────────────────
//
// Manages a live indoor cycling session (free ride or scheduled). No GPS, no
// map, no route — everything here is manual/HealthKit entry. Distance is
// never derived from HR/power/duration; see src/utils/indoorRide.ts for the
// honesty rule and every pure computation this store delegates to.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import type { RichWorkout } from '../types/workout';
import { elapsedSecondsExcludingPause } from '../utils/activeTime';
import { synthesizeWorkoutInstanceId } from '../utils/workoutInstance';
import {
  advanceRideIntervalIndex,
  buildFreshIndoorRideState,
  rideIntervalStepCountForWorkout,
  type EquipmentDistanceEntry,
  type IndoorRideStartConfig,
} from '../utils/indoorRide';
import { appendIndoorHeartRateSample, type IndoorHeartRateSample } from '../utils/indoorHeartRate';

export type { EquipmentDistanceEntry, IndoorRideStartConfig } from '../utils/indoorRide';

export type ActiveIndoorRideStore = {
  workoutInstanceId:     string | null;
  isActive:              boolean;
  isPaused:              boolean;
  startedAt:             number | null;
  pausedAt:              number | null;
  pausedDurationMs:      number;
  scheduledSessionId:    string | null;
  plannedWorkout:        RichWorkout | null;
  currentIntervalIndex:  number;
  // Transient — HealthKit-polled, never entered manually. Reset on rehydrate
  // since a stale bpm reading from before the app closed is not "live".
  heartRateBpm:          number | null;
  heartRateSamples:      IndoorHeartRateSample[];
  cadenceRpm:            number | null;
  powerWatts:            number | null;
  resistanceLevel:       string | null;
  rpe:                   number | null;
  equipmentDistance:     EquipmentDistanceEntry | null;
  completionRequestedAt: number | null;

  startRide:            (config?: IndoorRideStartConfig) => void;
  pause:                () => void;
  resume:               () => void;
  advanceInterval:      () => void;
  skipInterval:         () => void;
  setHeartRateBpm:      (bpm: number | null, sampledAt?: number) => void;
  setCadenceRpm:        (rpm: number | null) => void;
  setPowerWatts:        (watts: number | null) => void;
  setResistanceLevel:   (level: string | null) => void;
  setEquipmentDistance: (entry: EquipmentDistanceEntry | null) => void;
  setRpe:               (rpe: number | null) => void;
  requestCompletion:    () => void;
  clearCompletionRequest: () => void;
  finishRide:           () => void;
  cancelRide:           () => void;
};

const IDLE_STATE: Pick<
  ActiveIndoorRideStore,
  | 'workoutInstanceId' | 'isActive' | 'isPaused' | 'startedAt' | 'pausedAt' | 'pausedDurationMs'
  | 'scheduledSessionId' | 'plannedWorkout' | 'currentIntervalIndex' | 'heartRateBpm' | 'heartRateSamples' | 'cadenceRpm'
  | 'powerWatts' | 'resistanceLevel' | 'rpe' | 'equipmentDistance' | 'completionRequestedAt'
> = {
  workoutInstanceId:     null,
  isActive:              false,
  isPaused:              false,
  startedAt:             null,
  pausedAt:              null,
  pausedDurationMs:      0,
  scheduledSessionId:    null,
  plannedWorkout:        null,
  currentIntervalIndex:  0,
  heartRateBpm:          null,
  heartRateSamples:      [],
  cadenceRpm:            null,
  powerWatts:            null,
  resistanceLevel:       null,
  rpe:                   null,
  equipmentDistance:     null,
  completionRequestedAt: null,
};

export function activeIndoorRideElapsedSeconds(
  state: Pick<ActiveIndoorRideStore, 'startedAt' | 'isPaused' | 'pausedAt' | 'pausedDurationMs'>,
  now = Date.now(),
): number {
  return elapsedSecondsExcludingPause({
    startedAt: state.startedAt,
    isPaused: state.isPaused,
    pausedAt: state.pausedAt,
    pausedDurationMs: state.pausedDurationMs,
  }, now);
}

export const useActiveIndoorRideStore = create<ActiveIndoorRideStore>()(persist((set, get) => ({
  ...IDLE_STATE,

  // Always a fresh instance id + full transient reset — never derived from
  // whatever the previous ride left behind. See buildFreshIndoorRideState.
  startRide: (config) => {
    set(buildFreshIndoorRideState({
      scheduledSessionId: config?.scheduledSessionId ?? null,
      plannedWorkout: config?.plannedWorkout ?? null,
    }));
  },

  pause: () => {
    const state = get();
    if (!state.isActive || state.isPaused) return;
    set({ isPaused: true, pausedAt: Date.now() });
  },

  resume: () => {
    const state = get();
    if (!state.isActive || !state.isPaused) return;
    const now = Date.now();
    const pausedFor = state.pausedAt ? now - state.pausedAt : 0;
    set({
      isPaused: false,
      pausedAt: null,
      pausedDurationMs: state.pausedDurationMs + pausedFor,
    });
  },

  advanceInterval: () => set(state => ({
    currentIntervalIndex: advanceRideIntervalIndex(
      state.currentIntervalIndex,
      rideIntervalStepCountForWorkout(state.plannedWorkout),
    ),
  })),

  // Skip and advance share the same bound today — both move to the next
  // step and never overrun the workout. Kept as separate actions so the
  // screen/store can diverge later (e.g. skip logging a distinct event)
  // without a breaking rename.
  skipInterval: () => set(state => ({
    currentIntervalIndex: advanceRideIntervalIndex(
      state.currentIntervalIndex,
      rideIntervalStepCountForWorkout(state.plannedWorkout),
    ),
  })),

  setHeartRateBpm:      (bpm, sampledAt = Date.now()) => set(state => ({
    heartRateBpm: bpm,
    heartRateSamples: bpm == null
      ? state.heartRateSamples
      : appendIndoorHeartRateSample(state.heartRateSamples, { timestamp: sampledAt, bpm, source: 'healthkit' }),
  })),
  setCadenceRpm:        rpm    => set({ cadenceRpm: rpm }),
  setPowerWatts:        watts  => set({ powerWatts: watts }),
  setResistanceLevel:   level  => set({ resistanceLevel: level }),
  setEquipmentDistance: entry  => set({ equipmentDistance: entry }),
  setRpe:               rpe    => set({ rpe }),

  requestCompletion:      () => set({ completionRequestedAt: Date.now() }),
  clearCompletionRequest: () => set({ completionRequestedAt: null }),

  finishRide:  () => set({ ...IDLE_STATE }),
  cancelRide:  () => set({ ...IDLE_STATE }),
}), {
  name: 'active-indoor-ride-store-v1',
  version: 1,
  storage: createAppJSONStorage(),
  partialize: state => state,
  // Old persisted sessions (pre-instance-identity, or from before this
  // store existed) get a synthesized workoutInstanceId rather than being
  // discarded on rehydrate. heartRateBpm is always cleared on rehydrate —
  // it's a live HealthKit poll, never a value worth resuming.
  merge: (persisted, current) => {
    const merged = { ...current, ...(persisted as Partial<ActiveIndoorRideStore> | undefined) };
    if (merged.isActive) {
      merged.workoutInstanceId = synthesizeWorkoutInstanceId({
        workoutInstanceId: merged.workoutInstanceId,
        scheduledSessionId: merged.scheduledSessionId,
        startedAtMs: merged.startedAt,
      });
    }
    merged.heartRateBpm = null;
    // The bounded samples are historical observations captured during this
    // active ride, unlike the transient live reading. Preserve only valid
    // bounded data when restoring a draft.
    merged.heartRateSamples = (merged.heartRateSamples ?? []).slice(-720);
    return merged;
  },
}));
