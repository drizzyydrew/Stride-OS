import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';

import type { ActivitySubtype, ActivityType, RunWalkInterval } from '../types/activity';
import {
  appendTrackingPoint,
  evaluateRunWalkCue,
  type TrackingAggregate,
} from '../utils/activityTracking';
import { elapsedSecondsExcludingPause } from '../utils/activeTime';
import { buildWorkoutInstanceId, synthesizeWorkoutInstanceId } from '../utils/workoutInstance';
import { enqueueVoiceCue } from '../lib/voiceCue';
import { initialAutoPauseState, reduceAutoPause, type AutoPauseState } from '../utils/autoPause';
import { useSettingsStore } from './settingsStore';

export type ActiveOutdoorType =
  | 'running'
  | 'walking'
  | 'cycling'
  | 'hiking'
  | 'downhill_skiing'
  | 'cross_country_skiing'
  | 'snowboarding';

const EMPTY_AGGREGATE: TrackingAggregate = {
  points: [],
  distanceMeters: 0,
  elevationGainMeters: 0,
  elevationLossMeters: 0,
  currentMetersPerSecond: 0,
  averageMetersPerSecond: 0,
  maximumMetersPerSecond: 0,
};

type ActiveActivityStore = {
  activityId: string | null;
  activityType: ActiveOutdoorType;
  subtype: ActivitySubtype;
  name: string;
  scheduledSessionId: string | null;
  associatedTrainingBlockId: string | null;
  associatedGoalId: string | null;
  isActive: boolean;
  isPaused: boolean;
  startedAt: number | null;
  pausedAt: number | null;
  pausedDurationMs: number;
  aggregate: TrackingAggregate;
  runWalkIntervals: RunWalkInterval[];
  paceCoachingEnabled: boolean;
  heartRateCoachingEnabled: boolean;
  intervalPromptsEnabled: boolean;
  hydrationPromptsEnabled: boolean;
  fuelPromptsEnabled: boolean;
  navigationPromptsEnabled: boolean;
  routeId: string | null;
  navigationMode: 'off' | 'walking' | 'cycling';
  nextInstruction: string | null;
  lastRunWalkCueElapsedSeconds: number;
  completionRequestedAt: number | null;
  // Live workout instance identity — see src/utils/workoutInstance.ts.
  workoutInstanceId: string | null;
  autoPauseState: AutoPauseState | null;
  start: (input: {
    activityType: ActiveOutdoorType;
    subtype?: ActivitySubtype;
    name?: string;
    runWalkIntervals?: RunWalkInterval[];
    routeId?: string;
    navigationMode?: 'off' | 'walking' | 'cycling';
    scheduledSessionId?: string;
    associatedTrainingBlockId?: string;
    associatedGoalId?: string;
  }) => void;
  pause: (source?: 'manual' | 'auto') => void;
  resume: (source?: 'manual' | 'auto') => void;
  addLocation: (location: LocationObject, activeSeconds: number) => void;
  setNextInstruction: (instruction: string | null) => void;
  setPaceCoachingEnabled: (enabled: boolean) => void;
  setHeartRateCoachingEnabled: (enabled: boolean) => void;
  setIntervalPromptsEnabled: (enabled: boolean) => void;
  setHydrationPromptsEnabled: (enabled: boolean) => void;
  setFuelPromptsEnabled: (enabled: boolean) => void;
  setNavigationPromptsEnabled: (enabled: boolean) => void;
  requestCompletion: () => void;
  clearCompletionRequest: () => void;
  finish: () => void;
  discard: () => void;
};

export function activeOutdoorElapsedSeconds(
  state: Pick<ActiveActivityStore, 'startedAt' | 'isPaused' | 'pausedAt' | 'pausedDurationMs'>,
  now = Date.now(),
): number {
  return elapsedSecondsExcludingPause(state, now);
}

function labelFor(type: ActiveOutdoorType): string {
  if (type === 'walking') return 'Walk';
  if (type === 'cycling') return 'Ride';
  if (type === 'hiking') return 'Hike';
  if (type === 'downhill_skiing') return 'Downhill Ski';
  if (type === 'cross_country_skiing') return 'Cross-Country Ski';
  if (type === 'snowboarding') return 'Snowboard';
  return 'Run';
}

export const useActiveActivityStore = create<ActiveActivityStore>()(
  persist(
    (set, get) => ({
      activityId: null,
      activityType: 'walking',
      subtype: 'outdoor',
      name: 'Walk',
      scheduledSessionId: null,
      associatedTrainingBlockId: null,
      associatedGoalId: null,
      isActive: false,
      isPaused: false,
      startedAt: null,
      pausedAt: null,
      pausedDurationMs: 0,
      aggregate: EMPTY_AGGREGATE,
      runWalkIntervals: [],
      paceCoachingEnabled: true,
      heartRateCoachingEnabled: true,
      intervalPromptsEnabled: true,
      hydrationPromptsEnabled: true,
      fuelPromptsEnabled: true,
      navigationPromptsEnabled: true,
      routeId: null,
      navigationMode: 'off',
      nextInstruction: null,
      lastRunWalkCueElapsedSeconds: 0,
      completionRequestedAt: null,
      workoutInstanceId: null,
      autoPauseState: null,

      start: input => {
        const now = Date.now();
        const autoPauseActivity = input.activityType === 'running' || input.activityType === 'cycling'
          ? input.activityType
          : null;
        set({
          activityId: `active_${now}`,
          activityType: input.activityType,
          subtype: input.subtype ?? 'outdoor',
          name: input.name ?? labelFor(input.activityType),
          scheduledSessionId: input.scheduledSessionId ?? null,
          associatedTrainingBlockId: input.associatedTrainingBlockId ?? null,
          associatedGoalId: input.associatedGoalId ?? null,
          isActive: true,
          isPaused: false,
          startedAt: now,
          pausedAt: null,
          pausedDurationMs: 0,
          aggregate: EMPTY_AGGREGATE,
          runWalkIntervals: input.runWalkIntervals ?? [],
          routeId: input.routeId ?? null,
          navigationMode: input.navigationMode ?? 'off',
          nextInstruction: null,
          lastRunWalkCueElapsedSeconds: 0,
          completionRequestedAt: null,
          workoutInstanceId: buildWorkoutInstanceId(input.scheduledSessionId ?? null, now),
          autoPauseState: autoPauseActivity
            ? initialAutoPauseState(autoPauseActivity, useSettingsStore.getState().autoPauseMode)
            : null,
        });
      },

      pause: (source = 'manual') => {
        const state = get();
        if (!state.isActive || state.isPaused) return;
        set({
          isPaused: true,
          pausedAt: Date.now(),
          autoPauseState: state.autoPauseState
            ? { ...state.autoPauseState, paused: true, manualPaused: source === 'manual' }
            : null,
        });
      },

      resume: (_source = 'manual') => {
        const state = get();
        if (!state.isActive || !state.isPaused) return;
        set({
          isPaused: false,
          pausedDurationMs: state.pausedDurationMs + (state.pausedAt ? Date.now() - state.pausedAt : 0),
          pausedAt: null,
          autoPauseState: state.autoPauseState
            ? { ...state.autoPauseState, paused: false, manualPaused: false }
            : null,
        });
      },

      addLocation: (location, activeSeconds) => {
        const state = get();
        if (!state.isActive) return;
        const point = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
          altitudeMeters: location.coords.altitude ?? undefined,
          accuracyMeters: location.coords.accuracy ?? undefined,
        };
        if (state.autoPauseState && (state.activityType === 'running' || state.activityType === 'cycling')) {
          const previous = state.aggregate.points.at(-1);
          if (previous && point.timestamp > previous.timestamp) {
            const deltaSeconds = Math.max(0, (point.timestamp - previous.timestamp) / 1000);
            const displacementMeters = distanceBetween(previous.latitude, previous.longitude, point.latitude, point.longitude);
            const gpsSpeedMps = typeof location.coords.speed === 'number' && location.coords.speed >= 0
              ? location.coords.speed
              : deltaSeconds > 0 ? displacementMeters / deltaSeconds : 0;
            const decision = reduceAutoPause(state.autoPauseState, {
              atMs: point.timestamp,
              speedMps: gpsSpeedMps,
              displacementMeters,
              horizontalAccuracyMeters: location.coords.accuracy,
              motion: 'unknown',
            });
            if (decision.action === 'auto_pause') {
              set({ isPaused: true, pausedAt: point.timestamp, autoPauseState: decision.state });
              if (useSettingsStore.getState().announceAutoPause) enqueueVoiceCue('Pausing workout.', 'interval');
              return;
            }
            if (state.isPaused) {
              if (decision.action === 'auto_resume') {
                const pausedFor = state.pausedAt ? point.timestamp - state.pausedAt : 0;
                set({
                  isPaused: false,
                  pausedAt: null,
                  pausedDurationMs: state.pausedDurationMs + Math.max(0, pausedFor),
                  aggregate: { ...state.aggregate, points: [...state.aggregate.points, point] },
                  autoPauseState: decision.state,
                });
                if (useSettingsStore.getState().announceAutoResume) enqueueVoiceCue('Resuming workout.', 'interval');
              } else {
                set({ autoPauseState: decision.state });
              }
              return;
            }
            if (decision.state !== state.autoPauseState) {
              set({ autoPauseState: decision.state });
            }
          }
        }
        if (state.isPaused) return;
        let nextRunWalkCueElapsedSeconds = state.lastRunWalkCueElapsedSeconds;
        if (state.intervalPromptsEnabled && state.runWalkIntervals.length > 0) {
          const cue = evaluateRunWalkCue({
            intervals: state.runWalkIntervals,
            previousElapsedSeconds: state.lastRunWalkCueElapsedSeconds,
            elapsedSeconds: activeSeconds,
          });
          nextRunWalkCueElapsedSeconds = activeSeconds;
          if (cue) enqueueVoiceCue(cue.text, 'runWalk');
        }
        set({
          aggregate: appendTrackingPoint(state.aggregate, {
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp,
            altitudeMeters: point.altitudeMeters,
            accuracyMeters: point.accuracyMeters,
          }, state.activityType as ActivityType, activeSeconds),
          lastRunWalkCueElapsedSeconds: nextRunWalkCueElapsedSeconds,
        });
      },

      setNextInstruction: nextInstruction => set({ nextInstruction }),
      setPaceCoachingEnabled: paceCoachingEnabled => set({ paceCoachingEnabled }),
      setHeartRateCoachingEnabled: heartRateCoachingEnabled => set({ heartRateCoachingEnabled }),
      setIntervalPromptsEnabled: intervalPromptsEnabled => set({ intervalPromptsEnabled }),
      setHydrationPromptsEnabled: hydrationPromptsEnabled => set({ hydrationPromptsEnabled }),
      setFuelPromptsEnabled: fuelPromptsEnabled => set({ fuelPromptsEnabled }),
      setNavigationPromptsEnabled: navigationPromptsEnabled => set({ navigationPromptsEnabled }),
      requestCompletion: () => set({ completionRequestedAt: Date.now() }),
      clearCompletionRequest: () => set({ completionRequestedAt: null }),

      finish: () => set({
        isActive: false,
        isPaused: false,
        pausedAt: null,
        nextInstruction: null,
        lastRunWalkCueElapsedSeconds: 0,
        completionRequestedAt: null,
        autoPauseState: null,
      }),

      discard: () => set({
        activityId: null,
        scheduledSessionId: null,
        associatedTrainingBlockId: null,
        associatedGoalId: null,
        isActive: false,
        isPaused: false,
        startedAt: null,
        pausedAt: null,
        pausedDurationMs: 0,
        aggregate: EMPTY_AGGREGATE,
        runWalkIntervals: [],
        routeId: null,
        navigationMode: 'off',
        nextInstruction: null,
        lastRunWalkCueElapsedSeconds: 0,
        completionRequestedAt: null,
        workoutInstanceId: null,
        autoPauseState: null,
      }),
    }),
    {
      name: 'active-activity-store',
      version: 1,
      storage: createAppJSONStorage(),
      partialize: state => state,
      merge: (persisted, current) => {
        const p = persisted as Partial<ActiveActivityStore> | undefined;
        const merged: ActiveActivityStore = {
          ...current,
          ...p,
          aggregate: {
            ...EMPTY_AGGREGATE,
            ...p?.aggregate,
          },
        };
        if (merged.isActive) {
          merged.workoutInstanceId = synthesizeWorkoutInstanceId({
            workoutInstanceId: merged.workoutInstanceId,
            scheduledSessionId: merged.scheduledSessionId,
            startedAtMs: merged.startedAt,
          });
        }
        if (!Number.isFinite(merged.lastRunWalkCueElapsedSeconds)) {
          merged.lastRunWalkCueElapsedSeconds = 0;
        }
        if (merged.activityType !== 'running' && merged.activityType !== 'cycling') {
          merged.autoPauseState = null;
        }
        if (merged.isActive && (merged.activityType === 'running' || merged.activityType === 'cycling') && !merged.autoPauseState) {
          merged.autoPauseState = initialAutoPauseState(merged.activityType, useSettingsStore.getState().autoPauseMode);
        }
        return merged;
      },
    },
  ),
);

function distanceBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radius = 6_371_000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
