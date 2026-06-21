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
};

// Rolling window for pace calculation (seconds of data to average)
const PACE_WINDOW_SEC = 30;

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
  distanceMiles:          number;
  currentPaceSecPerMile:  number;
  coordinates:            Coordinate[];
  currentIntervalIndex:   number;
  plannedWorkout:         RichWorkout | null;

  startRun:          (plannedWorkout: RichWorkout | null) => void;
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
  distanceMiles:          0,
  currentPaceSecPerMile:  0,
  coordinates:            [],
  currentIntervalIndex:   0,
  plannedWorkout:         null,

  startRun: (plannedWorkout) => {
    set({
      isActive:               true,
      isPaused:               false,
      startTime:              Date.now(),
      distanceMiles:          0,
      currentPaceSecPerMile:  0,
      coordinates:            [],
      currentIntervalIndex:   0,
      plannedWorkout,
    });
  },

  pauseRun: () => set({ isPaused: true }),

  resumeRun: () => set({ isPaused: false }),

  addLocationUpdate: (loc) => {
    const state = get();
    if (!state.isActive || state.isPaused) return;

    const coord: Coordinate = {
      lat:       loc.coords.latitude,
      lng:       loc.coords.longitude,
      timestamp: loc.timestamp,
    };

    const coords  = [...state.coordinates, coord];
    let totalDist = state.distanceMiles;

    if (coords.length >= 2) {
      const prev = coords[coords.length - 2];
      totalDist += haversineMiles(prev, coord);
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

    set({ coordinates: coords, distanceMiles: totalDist, currentPaceSecPerMile: pace });
  },

  advanceInterval: () => {
    set(state => ({ currentIntervalIndex: state.currentIntervalIndex + 1 }));
  },

  finishRun: () => {
    set({ isActive: false, isPaused: false });
  },

  cancelRun: () => {
    set({
      isActive:               false,
      isPaused:               false,
      startTime:              null,
      distanceMiles:          0,
      currentPaceSecPerMile:  0,
      coordinates:            [],
      currentIntervalIndex:   0,
      plannedWorkout:         null,
    });
  },
}));
