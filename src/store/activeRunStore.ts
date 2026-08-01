// ─── Active Run Store ─────────────────────────────────────────────────────────
//
// Manages a live in-progress GPS run. Location updates arrive from the
// background task (see gpsTracking.ts) which calls addLocationUpdate().
// The UI polls elapsedSeconds via a separate timer; this store tracks
// GPS-derived metrics only.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import type { LocationObject } from 'expo-location';
import type { RichWorkout } from '../types/workout';
import type { DistanceSource } from '../types/activity';
import { elapsedSecondsExcludingPause } from '../utils/activeTime';
import { buildWorkoutInstanceId, synthesizeWorkoutInstanceId } from '../utils/workoutInstance';
import { closeOpenSegment, confirmSpeedChange, openSegment, sanitizeSpeedMph, type TreadmillSegment } from '../utils/treadmill';
import type { TreadmillPhonePlacement } from '../utils/treadmillPlacement';

export type Coordinate = {
  lat:       number;
  lng:       number;
  timestamp: number;
  altitudeM?: number;
};

// Run modes: how the athlete wants this run framed. 'quick' is plain GPS
// tracking; the goal fields only apply to their matching mode.
export type RunMode = 'quick' | 'time' | 'distance' | 'workout' | 'race';

// Whether this run is tracked via GPS outdoors or via confirmed treadmill
// speed indoors. Indoor runs never request location permission, start GPS
// tasks, or record coordinates.
export type RunEnvironment = 'outdoor' | 'indoor';

export type RunModeConfig = {
  mode:                   RunMode;
  goalMinutes?:           number;  // time mode
  goalMiles?:             number;  // distance + race modes
  targetPaceSecPerMile?:  number;  // race mode
  scheduledSessionId?:    string;
  environment?:           RunEnvironment;
  treadmillPhonePlacement?: TreadmillPhonePlacement;
};

// Rolling window for pace calculation (seconds of data to average)
const PACE_WINDOW_SEC = 30;
const MAX_ALLOWED_ACCURACY_METERS = 65;
const MAX_REASONABLE_RUNNING_SPEED_MPS = 8.5; // ~5:02/mi, lets fast intervals through while rejecting GPS jumps.
const MIN_DISTANCE_DELTA_METERS = 2.5;
// GPS altitude is noisy (±3-10 m); only count climb once the smoothed gain
// between accepted points exceeds this, so flat runs don't accumulate fake feet.
const MIN_ELEVATION_CLIMB_METERS = 2;

function haversineMiles(a: Coordinate, b: Coordinate): number {
  const R   = 3958.8;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const chord  = sinLat * sinLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

export type ActiveRunStore = {
  isActive:               boolean;
  isPaused:               boolean;
  startTime:              number | null;
  pausedAt:               number | null;
  pausedDurationMs:       number;
  distanceMiles:          number;
  currentPaceSecPerMile:  number;
  averagePaceSecPerMile:  number;
  elevationGainFt:        number;
  elevationRefM:          number | null;
  coordinates:            Coordinate[];
  lastRunCoordinates:     Coordinate[];
  currentIntervalIndex:   number;
  plannedWorkout:         RichWorkout | null;
  scheduledSessionId:     string | null;
  runMode:                RunMode;
  goalMinutes:            number | null;
  goalMiles:              number | null;
  targetPaceSecPerMile:   number | null;
  completionRequestedAt:  number | null;

  // Live workout instance identity — see src/utils/workoutInstance.ts. Every
  // startRun() call gets a fresh id; mount guards key off this, not isActive.
  workoutInstanceId:      string | null;

  // Indoor/treadmill support.
  environment:            RunEnvironment;
  treadmillSegments:      TreadmillSegment[];
  currentSpeedMph:        number | null;
  manualDistanceMiles:    number | null;
  distanceSource:         DistanceSource | null;
  treadmillPhonePlacement: TreadmillPhonePlacement;
  // Last outdoor/indoor choice the athlete made on the run-setup screen,
  // persisted so the toggle defaults to it next time (not tied to any one
  // active session — survives finishRun/cancelRun).
  lastEnvironmentPreference: RunEnvironment;

  startRun:          (plannedWorkout: RichWorkout | null, config?: RunModeConfig) => void;
  pauseRun:          () => void;
  resumeRun:         () => void;
  addLocationUpdate: (loc: LocationObject) => void;
  advanceInterval:   () => void;
  finishRun:         () => void;
  cancelRun:         () => void;
  requestCompletion: () => void;
  clearCompletionRequest: () => void;
  confirmTreadmillSpeed:  (speedMph: number) => void;
  setManualLiveDistance:  (miles: number) => void;
  setLastEnvironmentPreference: (environment: RunEnvironment) => void;
};

export function activeRunElapsedSeconds(
  state: Pick<ActiveRunStore, 'startTime' | 'isPaused' | 'pausedAt' | 'pausedDurationMs'>,
  now = Date.now(),
): number {
  return elapsedSecondsExcludingPause({
    startedAt: state.startTime,
    isPaused: state.isPaused,
    pausedAt: state.pausedAt,
    pausedDurationMs: state.pausedDurationMs,
  }, now);
}

export const useActiveRunStore = create<ActiveRunStore>()(persist((set, get) => ({
  isActive:               false,
  isPaused:               false,
  startTime:              null,
  pausedAt:               null,
  pausedDurationMs:       0,
  distanceMiles:          0,
  currentPaceSecPerMile:  0,
  averagePaceSecPerMile:  0,
  elevationGainFt:        0,
  elevationRefM:          null,
  coordinates:            [],
  lastRunCoordinates:     [],
  currentIntervalIndex:   0,
  plannedWorkout:         null,
  scheduledSessionId:     null,
  runMode:                'quick',
  goalMinutes:            null,
  goalMiles:              null,
  targetPaceSecPerMile:   null,
  completionRequestedAt:  null,
  workoutInstanceId:      null,
  environment:            'outdoor',
  treadmillSegments:      [],
  currentSpeedMph:        null,
  manualDistanceMiles:    null,
      distanceSource:         null,
      treadmillPhonePlacement: 'on_body',
      lastEnvironmentPreference: 'outdoor',

  startRun: (plannedWorkout, config) => {
    const now = Date.now();
    set({
      isActive:               true,
      isPaused:               false,
      startTime:              now,
      pausedAt:               null,
      pausedDurationMs:       0,
      distanceMiles:          0,
      currentPaceSecPerMile:  0,
      averagePaceSecPerMile:  0,
      elevationGainFt:        0,
      elevationRefM:          null,
      coordinates:            [],
      currentIntervalIndex:   0,
      plannedWorkout,
      scheduledSessionId:     config?.scheduledSessionId ?? null,
      runMode:                config?.mode ?? (plannedWorkout ? 'workout' : 'quick'),
      goalMinutes:            config?.goalMinutes ?? null,
      goalMiles:              config?.goalMiles ?? null,
      targetPaceSecPerMile:   config?.targetPaceSecPerMile ?? null,
      completionRequestedAt:  null,
      workoutInstanceId:      buildWorkoutInstanceId(config?.scheduledSessionId ?? null, now),
      environment:            config?.environment ?? 'outdoor',
      treadmillSegments:      [],
      currentSpeedMph:        null,
      manualDistanceMiles:    null,
      distanceSource:         null,
      treadmillPhonePlacement: config?.treadmillPhonePlacement ?? get().treadmillPhonePlacement,
      lastEnvironmentPreference: config?.environment ?? get().lastEnvironmentPreference,
    });
  },

  setLastEnvironmentPreference: (environment) => set({ lastEnvironmentPreference: environment }),

  pauseRun: () => {
    const state = get();
    if (!state.isActive || state.isPaused) return;
    const now = Date.now();
    // Treadmill segments never span a pause: close the open one now, reopen
    // at the same confirmed speed on resume.
    const treadmillSegments = state.environment === 'indoor'
      ? closeOpenSegment(state.treadmillSegments, now)
      : state.treadmillSegments;
    set({ isPaused: true, pausedAt: now, treadmillSegments });
  },

  resumeRun: () => {
    const state = get();
    if (!state.isActive || !state.isPaused) return;
    const now = Date.now();
    const pausedFor = state.pausedAt ? now - state.pausedAt : 0;
    const treadmillSegments = state.environment === 'indoor' && state.currentSpeedMph != null
      ? [...state.treadmillSegments, openSegment(state.currentSpeedMph, now)]
      : state.treadmillSegments;
    set({
      isPaused: false,
      pausedAt: null,
      pausedDurationMs: state.pausedDurationMs + pausedFor,
      treadmillSegments,
    });
  },

  confirmTreadmillSpeed: (speedMph) => {
    const state = get();
    if (!state.isActive || state.isPaused) return;
    const now = Date.now();
    const speed = sanitizeSpeedMph(speedMph);
    set({
      treadmillSegments: confirmSpeedChange(state.treadmillSegments, speed, now),
      currentSpeedMph: speed,
      distanceSource: 'confirmed_speed_estimate',
    });
  },

  setManualLiveDistance: (miles) => {
    if (!Number.isFinite(miles) || miles < 0) return;
    set({ manualDistanceMiles: miles, distanceSource: 'manual_entry' });
  },

  addLocationUpdate: (loc) => {
    const state = get();
    if (!state.isActive || state.isPaused) return;
    if (typeof loc.coords.accuracy === 'number' && loc.coords.accuracy > MAX_ALLOWED_ACCURACY_METERS) return;

    const coord: Coordinate = {
      lat:       loc.coords.latitude,
      lng:       loc.coords.longitude,
      timestamp: loc.timestamp,
      altitudeM: typeof loc.coords.altitude === 'number' ? loc.coords.altitude : undefined,
    };

    const previousCoord = state.coordinates.at(-1);
    if (previousCoord && coord.timestamp <= previousCoord.timestamp) return;

    const coords  = [...state.coordinates, coord];
    let totalDist = state.distanceMiles;
    let elevationGainFt = state.elevationGainFt;

    if (previousCoord) {
      const deltaMiles = haversineMiles(previousCoord, coord);
      const deltaMeters = deltaMiles * 1609.344;
      const deltaSeconds = (coord.timestamp - previousCoord.timestamp) / 1000;
      const speedMps = deltaSeconds > 0 ? (deltaMiles * 1609.344) / deltaSeconds : 0;
      if (speedMps > MAX_REASONABLE_RUNNING_SPEED_MPS) return;
      if (deltaMeters >= MIN_DISTANCE_DELTA_METERS) {
        totalDist += deltaMiles;
      }
    }

    // Elevation gain vs a low-water reference: accumulate only when the climb
    // above the reference clears the noise threshold, then move the reference
    // up; descending moves the reference down without subtracting.
    let elevationRefM = state.elevationRefM;
    if (coord.altitudeM !== undefined) {
      if (elevationRefM === null) {
        elevationRefM = coord.altitudeM;
      } else if (coord.altitudeM >= elevationRefM + MIN_ELEVATION_CLIMB_METERS) {
        elevationGainFt += (coord.altitudeM - elevationRefM) * 3.28084;
        elevationRefM = coord.altitudeM;
      } else if (coord.altitudeM < elevationRefM) {
        elevationRefM = coord.altitudeM;
      }
    }

    // Rolling 30-second pace
    const windowStart = coord.timestamp - PACE_WINDOW_SEC * 1000;
    const windowCoords = coords.filter(c => c.timestamp >= windowStart);
    let windowDist = 0;
    for (let i = 1; i < windowCoords.length; i++) {
      windowDist += haversineMiles(windowCoords[i - 1], windowCoords[i]);
    }
    const windowSec = windowCoords.length > 1
      ? (windowCoords[windowCoords.length - 1].timestamp - windowCoords[0].timestamp) / 1000
      : 0;
    const pace = windowDist > 0 && windowSec > 0 ? windowSec / windowDist : state.currentPaceSecPerMile;
    const elapsedMovingSec = state.startTime
      ? Math.max(0, (coord.timestamp - state.startTime - state.pausedDurationMs) / 1000)
      : 0;
    const averagePace = totalDist > 0.005 && elapsedMovingSec > 0
      ? elapsedMovingSec / totalDist
      : state.averagePaceSecPerMile;

    set({
      coordinates: coords,
      distanceMiles: totalDist,
      currentPaceSecPerMile: pace,
      averagePaceSecPerMile: averagePace,
      elevationGainFt,
      elevationRefM,
    });
  },

  advanceInterval: () => {
    set(state => ({ currentIntervalIndex: state.currentIntervalIndex + 1 }));
  },

  finishRun: () => {
    const state = get();
    set({
      isActive:               false,
      isPaused:               false,
      startTime:              null,
      pausedAt:               null,
      pausedDurationMs:       0,
      distanceMiles:          0,
      currentPaceSecPerMile:  0,
      averagePaceSecPerMile:  0,
      elevationGainFt:        0,
      elevationRefM:          null,
      coordinates:            [],
      currentIntervalIndex:   0,
      plannedWorkout:         null,
      scheduledSessionId:     null,
      runMode:                'quick',
      goalMinutes:            null,
      goalMiles:              null,
      targetPaceSecPerMile:   null,
      completionRequestedAt:  null,
      lastRunCoordinates:     state.coordinates,
      workoutInstanceId:      null,
      environment:            'outdoor',
      treadmillSegments:      [],
      currentSpeedMph:        null,
      manualDistanceMiles:    null,
      distanceSource:         null,
      treadmillPhonePlacement: state.treadmillPhonePlacement,
    });
  },

  cancelRun: () => {
    const state = get();
    set({
      isActive:               false,
      isPaused:               false,
      startTime:              null,
      pausedAt:               null,
      pausedDurationMs:       0,
      distanceMiles:          0,
      currentPaceSecPerMile:  0,
      averagePaceSecPerMile:  0,
      elevationGainFt:        0,
      elevationRefM:          null,
      coordinates:            [],
      currentIntervalIndex:   0,
      plannedWorkout:         null,
      scheduledSessionId:     null,
      runMode:                'quick',
      goalMinutes:            null,
      goalMiles:              null,
      targetPaceSecPerMile:   null,
      completionRequestedAt:  null,
      workoutInstanceId:      null,
      environment:            'outdoor',
      treadmillSegments:      [],
      currentSpeedMph:        null,
      manualDistanceMiles:    null,
      distanceSource:         null,
      treadmillPhonePlacement: state.treadmillPhonePlacement,
    });
  },

  requestCompletion: () => set({ completionRequestedAt: Date.now() }),
  clearCompletionRequest: () => set({ completionRequestedAt: null }),
}), {
  name: 'active-run-store-v1',
  version: 1,
  storage: createAppJSONStorage(),
  partialize: state => state,
  // Old persisted sessions (pre-instance-identity) get a synthesized
  // workoutInstanceId and safe defaults for the new treadmill/environment
  // fields rather than being discarded on rehydrate.
  merge: (persisted, current) => {
    const merged = { ...current, ...(persisted as Partial<ActiveRunStore> | undefined) };
    if (merged.isActive) {
      merged.workoutInstanceId = synthesizeWorkoutInstanceId({
        workoutInstanceId: merged.workoutInstanceId,
        scheduledSessionId: merged.scheduledSessionId,
        startedAtMs: merged.startTime,
      });
    }
    if (!merged.environment) merged.environment = 'outdoor';
    if (!merged.treadmillSegments) merged.treadmillSegments = [];
    if (!merged.treadmillPhonePlacement) merged.treadmillPhonePlacement = 'on_body';
    return merged;
  },
}));
