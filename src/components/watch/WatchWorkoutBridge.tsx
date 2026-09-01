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
import { startActivityLocationTracking, stopActivityLocationTracking } from '../../lib/activityGpsTracking';
import { endOutdoorLiveActivity, startOutdoorLiveActivity, updateOutdoorLiveActivity } from '../../lib/runLiveActivity';
import { endStrengthLiveActivity, startStrengthLiveActivity, strengthLiveActivitySessionId, updateStrengthLiveActivity } from '../../lib/strengthLiveActivity';
import { enqueueVoiceCue } from '../../lib/voiceCue';
import { activeOutdoorElapsedSeconds, useActiveActivityStore, type ActiveOutdoorType } from '../../store/activeActivityStore';
import { activeStrengthElapsedSeconds, useActiveStrengthSessionStore } from '../../store/activeStrengthSessionStore';
import { useLiveSensorStore } from '../../store/liveSensorStore';

const APPLE_WATCH_DEVICE = {
  id: 'apple_watch',
  name: 'Apple Watch',
  serviceUUIDs: [],
  capabilities: ['heart_rate' as const],
  kind: 'other' as const,
};

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
  return event.workoutInstanceId?.trim()
    || `watch_${event.workoutKind ?? 'workout'}_${Math.round(event.timestamp)}`;
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
  const outdoorType = outdoorTypeFromWatch(event.workoutKind);
  const strengthKind = strengthKindFromWatch(event.workoutKind);
  if (!outdoorType && !strengthKind) return;

  if (event.state === 'running') {
    if (outdoorType) {
      const active = useActiveActivityStore.getState();
      const activeStrength = useActiveStrengthSessionStore.getState().session;
      const id = eventWorkoutId(event);
      const hasConflict = active.isActive
        && active.workoutInstanceId !== id
        && active.activityType !== outdoorType;
      if (hasConflict || activeStrength) return;
      if (!active.isActive) {
        useActiveActivityStore.getState().start({
          activityType: outdoorType,
          subtype: event.environment === 'indoor' ? 'indoor' : 'outdoor',
          name: labelForWatchKind(event.workoutKind),
          workoutInstanceId: id,
        });
        void startActivityLocationTracking().catch(() => undefined);
        void startOutdoorLiveActivity({
          sessionId: id,
          workoutInstanceId: id,
          sessionSource: 'outdoor',
          activityName: labelForWatchKind(event.workoutKind),
          activityType: outdoorType,
          elapsedSeconds: event.elapsedSeconds ?? 0,
          distanceMiles: distanceMiles(event),
          averagePace: paceLabel(event),
          heartRateBpm: event.heartRate ?? null,
          zoneLabel: event.heartRateZone,
          isPaused: false,
        }).catch(() => undefined);
        enqueueVoiceCue(`${labelForWatchKind(event.workoutKind)} started.`, 'motivation');
        return;
      }
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
      if (useActiveActivityStore.getState().isActive) return;
      if (!session) {
        useActiveStrengthSessionStore.getState().startSession({
          source: 'custom',
          workoutId: id,
          workoutName: `Watch ${labelForWatchKind(event.workoutKind)}`,
          plannedDurationMin: strengthKind === 'mobility' ? 15 : 30,
          exercises: [],
          workoutInstanceId: id,
        });
        const launched = useActiveStrengthSessionStore.getState().session;
        void startStrengthLiveActivity({
          workoutName: launched?.workoutName ?? `Watch ${labelForWatchKind(event.workoutKind)}`,
          sessionId: launched ? strengthLiveActivitySessionId(launched) : id,
          sessionSource: 'custom',
          workoutInstanceId: id,
          elapsedSeconds: event.elapsedSeconds ?? 0,
          currentExercise: `${labelForWatchKind(event.workoutKind)} in progress`,
          nextExercise: '',
          setsCompleted: 0,
          totalSets: 1,
          progressLabel: 'Apple Watch live',
        }).catch(() => undefined);
        enqueueVoiceCue(`${labelForWatchKind(event.workoutKind)} started.`, 'motivation');
        return;
      }
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
      if (!active.isActive) return;
      if (active.workoutInstanceId && active.workoutInstanceId !== eventWorkoutId(event)) return;
      void stopActivityLocationTracking().catch(() => undefined);
      void endOutdoorLiveActivity({
        sessionId: active.workoutInstanceId ?? active.activityId ?? eventWorkoutId(event),
        workoutInstanceId: active.workoutInstanceId ?? eventWorkoutId(event),
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
      useActiveActivityStore.getState().requestCompletion();
      enqueueVoiceCue('Workout ended.', 'motivation');
      return;
    }
    if (strengthKind) {
      const session = useActiveStrengthSessionStore.getState().session;
      if (!session || session.workoutInstanceId !== eventWorkoutId(event)) return;
      void endStrengthLiveActivity({
        workoutInstanceId: session.workoutInstanceId,
        sessionId: strengthLiveActivitySessionId(session),
        sessionSource: session.source,
      }).catch(() => undefined);
      useActiveStrengthSessionStore.getState().requestCompletion();
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
