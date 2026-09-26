import { useEffect } from 'react';
import { Platform } from 'react-native';

import {
  activateStrideWatchConnectivity,
  addStrideWatchErrorListener,
  addStrideWatchHeartRateListener,
  addStrideWatchStatusListener,
  addStrideWatchWorkoutStateListener,
  type StrideWatchWorkoutStateEvent,
} from '../../../modules/stride-watch-connectivity/src';
import { stopActivityLocationTracking } from '../../lib/activityGpsTracking';
import { stopLocationTracking } from '../../lib/gpsTracking';
import { endOutdoorLiveActivity, updateOutdoorLiveActivity } from '../../lib/runLiveActivity';
import { endStrengthLiveActivity, strengthLiveActivitySessionId, updateStrengthLiveActivity } from '../../lib/strengthLiveActivity';
import { enqueueVoiceCue } from '../../lib/voiceCue';
import { activeOutdoorElapsedSeconds, useActiveActivityStore, type ActiveOutdoorType } from '../../store/activeActivityStore';
import { activeRunElapsedSeconds, useActiveRunStore } from '../../store/activeRunStore';
import { activeStrengthElapsedSeconds, useActiveStrengthSessionStore } from '../../store/activeStrengthSessionStore';
import { useLiveSensorStore } from '../../store/liveSensorStore';

const APPLE_WATCH_DEVICE = {
  id: 'apple_watch',
  name: 'Apple Watch',
  serviceUUIDs: [],
  capabilities: ['heart_rate' as const],
  kind: 'other' as const,
};

const COMPLETED_WATCH_EVENT_TTL_MS = 15 * 60 * 1000;
const completedWatchWorkoutEvents = new Map<string, number>();

function rememberCompletedWatchWorkout(id: string, timestamp: number): boolean {
  const now = Date.now();
  for (const [key, completedAt] of completedWatchWorkoutEvents) {
    if (now - completedAt > COMPLETED_WATCH_EVENT_TTL_MS) {
      completedWatchWorkoutEvents.delete(key);
    }
  }
  if (completedWatchWorkoutEvents.has(id)) return false;
  completedWatchWorkoutEvents.set(id, Number.isFinite(timestamp) ? timestamp : now);
  return true;
}

function outdoorTypeFromWatch(kind: string | undefined): ActiveOutdoorType | null {
  if (kind === 'run') return 'running';
  if (kind === 'cycling') return 'cycling';
  return null;
}

function strengthKindFromWatch(kind: string | undefined): 'strength' | 'mobility' | null {
  if (kind === 'strength' || kind === 'mobility') return kind;
  return null;
}

function labelForWatchKind(kind: string | undefined): string {
  if (kind === 'cycling') return 'Ride';
  if (kind === 'strength') return 'Strength';
  if (kind === 'mobility') return 'Mobility';
  return 'Run';
}

function eventWorkoutId(event: StrideWatchWorkoutStateEvent): string {
  const providedId = event.workoutInstanceId?.trim();
  if (providedId) return providedId;

  if (event.workoutKind === 'run') {
    const activeRun = useActiveRunStore.getState();
    if (activeRun.isActive) {
      return activeRun.workoutInstanceId ?? `watch_run_${Math.round(event.timestamp)}`;
    }
  }

  const outdoorType = outdoorTypeFromWatch(event.workoutKind);
  if (outdoorType) {
    const active = useActiveActivityStore.getState();
    if (active.isActive && active.activityType === outdoorType) {
      return active.workoutInstanceId ?? active.activityId ?? `watch_${event.workoutKind ?? 'workout'}_${Math.round(event.timestamp)}`;
    }
  }

  const strengthKind = strengthKindFromWatch(event.workoutKind);
  if (strengthKind) {
    const session = useActiveStrengthSessionStore.getState().session;
    if (session && (session.status === 'active' || session.status === 'paused')) {
      return session.workoutInstanceId;
    }
  }

  return `watch_${event.workoutKind ?? 'workout'}_${Math.round(event.timestamp)}`;
}

function distanceMiles(event: Pick<StrideWatchWorkoutStateEvent, 'distanceMeters'>): number {
  return Math.max(0, event.distanceMeters ?? 0) / 1609.344;
}

function paceLabel(event: Pick<StrideWatchWorkoutStateEvent, 'elapsedSeconds' | 'distanceMeters'>): string {
  const miles = distanceMiles(event);
  const seconds = event.elapsedSeconds ?? 0;
  if (miles <= 0 || seconds <= 0) return '--:--';
  const secondsPerMile = Math.round(seconds / miles);
  return `${Math.floor(secondsPerMile / 60)}:${String(secondsPerMile % 60).padStart(2, '0')}`;
}

function syncOutdoorLiveActivity(event: StrideWatchWorkoutStateEvent, isPaused: boolean): void {
  const state = useActiveActivityStore.getState();
  if (!state.isActive) return;
  const elapsedSeconds = state.startedAt ? activeOutdoorElapsedSeconds(state) : event.elapsedSeconds ?? 0;
  const snapshot = {
    sessionId: state.workoutInstanceId ?? state.activityId ?? eventWorkoutId(event),
    workoutInstanceId: state.workoutInstanceId ?? eventWorkoutId(event),
    sessionSource: 'outdoor' as const,
    activityName: state.name,
    activityType: state.activityType,
    elapsedSeconds,
    distanceMiles: Math.max(state.aggregate.distanceMeters / 1609.344, distanceMiles(event)),
    averagePace: paceLabel(event),
    averageSpeedMph: state.aggregate.averageMetersPerSecond * 2.23694,
    heartRateBpm: event.heartRate ?? null,
    zoneLabel: event.heartRateZone,
    isPaused,
    elevationGainMeters: state.aggregate.elevationGainMeters,
    elevationLossMeters: state.aggregate.elevationLossMeters,
  };
  void updateOutdoorLiveActivity(snapshot).catch(() => undefined);
}

function syncStrengthLiveActivity(event: StrideWatchWorkoutStateEvent, isPaused: boolean): void {
  const state = useActiveStrengthSessionStore.getState();
  const session = state.session;
  if (!session) return;
  void updateStrengthLiveActivity({
    workoutName: session.workoutName,
    sessionId: strengthLiveActivitySessionId(session),
    sessionSource: session.source,
    workoutInstanceId: session.workoutInstanceId,
    elapsedSeconds: activeStrengthElapsedSeconds(session),
    currentExercise: isPaused ? 'Paused' : `${labelForWatchKind(event.workoutKind)} in progress`,
    nextExercise: '',
    setsCompleted: 0,
    totalSets: Math.max(1, session.exercises.length),
    progressLabel: isPaused ? 'Paused' : 'Apple Watch live',
  }).catch(() => undefined);
}

function handleWatchWorkoutState(event: StrideWatchWorkoutStateEvent): void {
  if (event.workoutKind === 'run') {
    const id = eventWorkoutId(event);
    if (completedWatchWorkoutEvents.has(id)) return;

    if (event.state === 'running') {
      const activeRun = useActiveRunStore.getState();
      if (!activeRun.isActive) return;
      if (activeRun.isPaused && (!activeRun.workoutInstanceId || activeRun.workoutInstanceId === id)) {
        useActiveRunStore.getState().resumeRun('manual');
        void updateOutdoorLiveActivity({
          sessionId: activeRun.workoutInstanceId ?? id,
          workoutInstanceId: activeRun.workoutInstanceId ?? id,
          sessionSource: 'running',
          activityName: 'Training Run',
          activityType: 'running',
          elapsedSeconds: activeRunElapsedSeconds(useActiveRunStore.getState()),
          distanceMiles: Math.max(activeRun.distanceMiles, distanceMiles(event)),
          averagePace: paceLabel(event),
          heartRateBpm: event.heartRate ?? null,
          zoneLabel: event.heartRateZone,
          isPaused: false,
        }).catch(() => undefined);
        enqueueVoiceCue('Resuming workout.', 'interval');
      }
      return;
    }

    if (event.state === 'paused') {
      const activeRun = useActiveRunStore.getState();
      if (!activeRun.isActive || activeRun.isPaused) return;
      if (activeRun.workoutInstanceId && event.workoutInstanceId && activeRun.workoutInstanceId !== event.workoutInstanceId) return;
      useActiveRunStore.getState().pauseRun('manual');
      void updateOutdoorLiveActivity({
        sessionId: activeRun.workoutInstanceId ?? id,
        workoutInstanceId: activeRun.workoutInstanceId ?? id,
        sessionSource: 'running',
        activityName: 'Training Run',
        activityType: 'running',
        elapsedSeconds: activeRunElapsedSeconds(useActiveRunStore.getState()),
        distanceMiles: Math.max(activeRun.distanceMiles, distanceMiles(event)),
        averagePace: paceLabel(event),
        heartRateBpm: event.heartRate ?? null,
        zoneLabel: event.heartRateZone,
        isPaused: true,
      }).catch(() => undefined);
      enqueueVoiceCue('Pausing workout.', 'interval');
      return;
    }

    if (event.state === 'ended') {
      const activeRun = useActiveRunStore.getState();
      if (!activeRun.isActive) return;
      if (activeRun.workoutInstanceId && event.workoutInstanceId && activeRun.workoutInstanceId !== event.workoutInstanceId) return;
      const completionId = activeRun.workoutInstanceId ?? id;
      if (!rememberCompletedWatchWorkout(completionId, event.timestamp)) return;
      void stopLocationTracking().catch(() => undefined);
      void endOutdoorLiveActivity({
        sessionId: activeRun.workoutInstanceId ?? completionId,
        workoutInstanceId: activeRun.workoutInstanceId ?? completionId,
        sessionSource: 'running',
        activityName: 'Training Run',
        activityType: 'running',
        elapsedSeconds: activeRunElapsedSeconds(activeRun),
        distanceMiles: Math.max(activeRun.distanceMiles, distanceMiles(event)),
        averagePace: paceLabel(event),
        heartRateBpm: event.heartRate ?? null,
        zoneLabel: event.heartRateZone,
        isPaused: false,
      }).catch(() => undefined);
      useActiveRunStore.getState().finishRun();
      enqueueVoiceCue('Workout ended.', 'motivation');
      return;
    }
  }

  const outdoorType = outdoorTypeFromWatch(event.workoutKind);
  const strengthKind = strengthKindFromWatch(event.workoutKind);
  if (!outdoorType && !strengthKind) return;

  if (event.state === 'running') {
    if (outdoorType) {
      const active = useActiveActivityStore.getState();
      const id = eventWorkoutId(event);
      if (completedWatchWorkoutEvents.has(id)) return;
      if (!active.isActive || active.activityType !== outdoorType) return;
      if (active.isPaused && (active.workoutInstanceId === id || active.activityType === outdoorType)) {
        useActiveActivityStore.getState().resume('manual');
        syncOutdoorLiveActivity(event, false);
        enqueueVoiceCue('Resuming workout.', 'interval');
      }
      return;
    }

    if (strengthKind) {
      const state = useActiveStrengthSessionStore.getState();
      const session = state.session;
      const id = eventWorkoutId(event);
      if (completedWatchWorkoutEvents.has(id)) return;
      if (!session) return;
      if (session.status === 'paused' && session.workoutInstanceId === id) {
        useActiveStrengthSessionStore.getState().resume();
        syncStrengthLiveActivity(event, false);
        enqueueVoiceCue('Resuming workout.', 'interval');
      }
      return;
    }
  }

  if (event.state === 'paused') {
    if (outdoorType) {
      const active = useActiveActivityStore.getState();
      if (!active.isActive || active.isPaused) return;
      if (active.workoutInstanceId && active.workoutInstanceId !== eventWorkoutId(event)) return;
      useActiveActivityStore.getState().pause('manual');
      syncOutdoorLiveActivity(event, true);
      enqueueVoiceCue('Pausing workout.', 'interval');
      return;
    }
    if (strengthKind) {
      const session = useActiveStrengthSessionStore.getState().session;
      if (!session || session.status !== 'active') return;
      if (session.workoutInstanceId !== eventWorkoutId(event)) return;
      useActiveStrengthSessionStore.getState().pause();
      syncStrengthLiveActivity(event, true);
      enqueueVoiceCue('Pausing workout.', 'interval');
    }
    return;
  }

  if (event.state === 'ended') {
    if (outdoorType) {
      const active = useActiveActivityStore.getState();
      const id = active.workoutInstanceId ?? eventWorkoutId(event);
      if (!active.isActive) return;
      if (active.workoutInstanceId && event.workoutInstanceId && active.workoutInstanceId !== event.workoutInstanceId) return;
      if (!rememberCompletedWatchWorkout(id, event.timestamp)) return;
      void stopActivityLocationTracking().catch(() => undefined);
      void endOutdoorLiveActivity({
        sessionId: active.workoutInstanceId ?? active.activityId ?? id,
        workoutInstanceId: active.workoutInstanceId ?? id,
        sessionSource: 'outdoor',
        activityName: active.name,
        activityType: active.activityType,
        elapsedSeconds: active.startedAt ? activeOutdoorElapsedSeconds(active) : event.elapsedSeconds ?? 0,
        distanceMiles: Math.max(active.aggregate.distanceMeters / 1609.344, distanceMiles(event)),
        averagePace: paceLabel(event),
        averageSpeedMph: active.aggregate.averageMetersPerSecond * 2.23694,
        heartRateBpm: event.heartRate ?? null,
        zoneLabel: event.heartRateZone,
        isPaused: false,
        elevationGainMeters: active.aggregate.elevationGainMeters,
        elevationLossMeters: active.aggregate.elevationLossMeters,
      }).catch(() => undefined);
      if (!active.completionRequestedAt) {
        useActiveActivityStore.getState().requestCompletion();
      }
      enqueueVoiceCue('Workout ended.', 'motivation');
      return;
    }
    if (strengthKind) {
      const session = useActiveStrengthSessionStore.getState().session;
      const id = session?.workoutInstanceId ?? eventWorkoutId(event);
      if (!session || session.workoutInstanceId !== id) return;
      if (!rememberCompletedWatchWorkout(id, event.timestamp)) return;
      void endStrengthLiveActivity({
        workoutInstanceId: session.workoutInstanceId,
        sessionId: strengthLiveActivitySessionId(session),
        sessionSource: session.source,
      }).catch(() => undefined);
      if (!useActiveStrengthSessionStore.getState().completionRequestedAt) {
        useActiveStrengthSessionStore.getState().requestCompletion();
      }
      enqueueVoiceCue('Workout ended.', 'motivation');
    }
  }
}

export default function WatchWorkoutBridge() {
  const markDeviceConnected = useLiveSensorStore(s => s.markDeviceConnected);
  const markDeviceDisconnected = useLiveSensorStore(s => s.markDeviceDisconnected);
  const markDeviceError = useLiveSensorStore(s => s.markDeviceError);
  const recordBleReading = useLiveSensorStore(s => s.recordBleReading);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;

    const statusSub = addStrideWatchStatusListener(status => {
      if (!status.isPaired || !status.isWatchAppInstalled) {
        markDeviceDisconnected(APPLE_WATCH_DEVICE.id);
      }
    });

    const heartRateSub = addStrideWatchHeartRateListener(event => {
      markDeviceConnected(APPLE_WATCH_DEVICE, event.timestamp);
      recordBleReading({
        deviceId: APPLE_WATCH_DEVICE.id,
        deviceName: APPLE_WATCH_DEVICE.name,
        capability: 'heart_rate',
        metric: 'heartRate',
        value: event.heartRate,
        source: 'apple_watch',
        observedAt: event.timestamp,
      });
      if (event.distanceMeters != null && event.distanceMeters >= 0) {
        recordBleReading({
          deviceId: APPLE_WATCH_DEVICE.id,
          deviceName: APPLE_WATCH_DEVICE.name,
          capability: 'heart_rate',
          metric: 'distance',
          value: event.distanceMeters,
          source: 'apple_watch',
          observedAt: event.timestamp,
        });
      }
    });

    const workoutStateSub = addStrideWatchWorkoutStateListener(event => {
      if (event.state === 'ended' || event.state === 'idle') {
        markDeviceDisconnected(APPLE_WATCH_DEVICE.id, event.timestamp);
      } else {
        markDeviceConnected(APPLE_WATCH_DEVICE, event.timestamp);
      }
      if (event.heartRate != null && event.heartRate > 0) {
        recordBleReading({
          deviceId: APPLE_WATCH_DEVICE.id,
          deviceName: APPLE_WATCH_DEVICE.name,
          capability: 'heart_rate',
          metric: 'heartRate',
          value: event.heartRate,
          source: 'apple_watch',
          observedAt: event.timestamp,
        });
      }
      if (event.distanceMeters != null && event.distanceMeters >= 0) {
        recordBleReading({
          deviceId: APPLE_WATCH_DEVICE.id,
          deviceName: APPLE_WATCH_DEVICE.name,
          capability: 'heart_rate',
          metric: 'distance',
          value: event.distanceMeters,
          source: 'apple_watch',
          observedAt: event.timestamp,
        });
      }
      handleWatchWorkoutState(event);
    });

    const errorSub = addStrideWatchErrorListener(event => {
      markDeviceError(APPLE_WATCH_DEVICE.id, event.message, event.timestamp);
    });

    activateStrideWatchConnectivity().catch(() => undefined);

    return () => {
      statusSub?.remove();
      heartRateSub?.remove();
      workoutStateSub?.remove();
      errorSub?.remove();
    };
  }, [markDeviceConnected, markDeviceDisconnected, markDeviceError, recordBleReading]);

  return null;
}
