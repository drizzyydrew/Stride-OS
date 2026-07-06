// ─── Active Run Store ─────────────────────────────────────────────────────────
//
// Manages a live in-progress GPS run. Location updates arrive from the
// background task (see gpsTracking.ts) which calls addLocationUpdate().
// The UI polls elapsedSeconds via a separate timer; this store tracks
// GPS-derived metrics only.

import { create } from 'zustand';
import type { LocationObject } from 'expo-location';
import type { RichWorkout } from '../types/workout';

export type Coordinate = {
  lat:       number;
  lng:       number;
  timestamp: number;
  altitudeM?: number;
};

// Run modes: how the athlete wants this run framed. 'quick' is plain GPS
// tracking; the goal fields only apply to their matching mode.
export type RunMode = 'quick' | 'time' | 'distance' | 'workout' | 'race';

export type RunModeConfig = {
  mode:                   RunMode;
  goalMinutes?:           number;  // time mode
  goalMiles?:             number;  // distance + race modes
  targetPaceSecPerMile?:  number;  // race mode
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

type ActiveRunStore = {
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
  runMode:                RunMode;
  goalMinutes:            number | null;
  goalMiles:              number | null;
  targetPaceSecPerMile:   number | null;

  startRun:          (plannedWorkout: RichWorkout | null, config?: RunModeConfig) => void;
  pauseRun:          () => void;
  resumeRun:         () => void;
  addLocationUpdate: (loc: LocationObject) => void;
  advanceInterval:   () => void;
  finishRun:         () => void;
  cancelRun:         () => void;
};

export const useActiveRunStore = create<ActiveRunStore>((set, get) => ({
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
  runMode:                'quick',
  goalMinutes:            null,
  goalMiles:              null,
  targetPaceSecPerMile:   null,

  startRun: (plannedWorkout, config) => {
    set({
      isActive:               true,
      isPaused:               false,
      startTime:              Date.now(),
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
      runMode:                config?.mode ?? (plannedWorkout ? 'workout' : 'quick'),
      goalMinutes:            config?.goalMinutes ?? null,
      goalMiles:              config?.goalMiles ?? null,
      targetPaceSecPerMile:   config?.targetPaceSecPerMile ?? null,
    });
  },

  pauseRun: () => {
    const state = get();
    if (!state.isActive || state.isPaused) return;
    set({ isPaused: true, pausedAt: Date.now() });
  },

  resumeRun: () => {
    const state = get();
    if (!state.isActive || !state.isPaused) return;
    const pausedFor = state.pausedAt ? Date.now() - state.pausedAt : 0;
    set({
      isPaused: false,
      pausedAt: null,
      pausedDurationMs: state.pausedDurationMs + pausedFor,
    });
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
      runMode:                'quick',
      goalMinutes:            null,
      goalMiles:              null,
      targetPaceSecPerMile:   null,
      lastRunCoordinates:     state.coordinates,
    });
  },

  cancelRun: () => {
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
      runMode:                'quick',
      goalMinutes:            null,
      goalMiles:              null,
      targetPaceSecPerMile:   null,
    });
  },
}));
