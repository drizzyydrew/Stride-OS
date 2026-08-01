import { useEffect } from 'react';
import { router } from 'expo-router';

import {
  activeOutdoorElapsedSeconds,
  useActiveActivityStore,
} from '../../store/activeActivityStore';
import {
  activeRunElapsedSeconds,
  useActiveRunStore,
} from '../../store/activeRunStore';
import {
  activeStrengthElapsedSeconds,
  useActiveStrengthSessionStore,
} from '../../store/activeStrengthSessionStore';
import {
  liveActivityCommandMatchesSession,
} from '../../lib/liveActivityContracts';
import {
  startControlCommandPolling,
  updateOutdoorLiveActivity,
  updateRunLiveActivity,
  type StrideRunControlCommand,
} from '../../lib/runLiveActivity';
import {
  strengthLiveActivitySessionId,
  updateStrengthLiveActivity,
} from '../../lib/strengthLiveActivity';

type PersistedStore = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (callback: () => void) => () => void;
  };
};

function waitForHydration(store: PersistedStore): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise(resolve => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

function runCommandMatches(command: StrideRunControlCommand): boolean {
  const run = useActiveRunStore.getState();
  return Boolean(
    run.isActive
    && run.startTime
    && liveActivityCommandMatchesSession(command, {
      sessionId: run.workoutInstanceId ?? `run:${run.startTime}`,
      sessionSource: 'running',
    }),
  );
}

function outdoorCommandMatches(command: StrideRunControlCommand): boolean {
  const outdoor = useActiveActivityStore.getState();
  return Boolean(
    outdoor.isActive
    && outdoor.activityId
    && liveActivityCommandMatchesSession(command, {
      sessionId: outdoor.workoutInstanceId ?? outdoor.activityId,
      sessionSource: 'outdoor',
    }),
  );
}

function strengthCommandMatches(command: StrideRunControlCommand): boolean {
  const strength = useActiveStrengthSessionStore.getState().session;
  return Boolean(
    strength
    && liveActivityCommandMatchesSession(command, {
      sessionId: strength.workoutInstanceId ?? strengthLiveActivitySessionId(strength),
      sessionSource: strength.source,
    }),
  );
}

async function publishRunState(): Promise<void> {
  const run = useActiveRunStore.getState();
  if (!run.isActive || !run.startTime) return;
  const pace = run.averagePaceSecPerMile;
  await updateRunLiveActivity({
    sessionId: run.workoutInstanceId ?? `run:${run.startTime}`,
    workoutInstanceId: run.workoutInstanceId ?? undefined,
    sessionSource: 'running',
    elapsedSeconds: activeRunElapsedSeconds(run),
    distanceMiles: run.distanceMiles,
    averagePace: pace
      ? `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')}`
      : '--:--',
    heartRateBpm: null,
    zoneLabel: 'Zone --',
    zoneStatus: 'unknown',
    isPaused: run.isPaused,
  }).catch(() => undefined);
}

async function publishOutdoorState(): Promise<void> {
  const outdoor = useActiveActivityStore.getState();
  if (!outdoor.isActive || !outdoor.activityId) return;
  const averageSpeed = outdoor.aggregate.averageMetersPerSecond;
  const speedBased = outdoor.activityType === 'cycling'
    || outdoor.activityType.includes('skiing')
    || outdoor.activityType === 'snowboarding';
  const pace = averageSpeed ? 1609.344 / averageSpeed : 0;
  await updateOutdoorLiveActivity({
    sessionId: outdoor.workoutInstanceId ?? outdoor.activityId,
    workoutInstanceId: outdoor.workoutInstanceId ?? undefined,
    sessionSource: 'outdoor',
    activityName: outdoor.name,
    activityType: outdoor.runWalkIntervals.length ? 'run_walk' : outdoor.activityType,
    elapsedSeconds: activeOutdoorElapsedSeconds(outdoor),
    distanceMiles: outdoor.aggregate.distanceMeters / 1609.344,
    averagePace: !speedBased && pace
      ? `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')}`
      : '--:--',
    averageSpeedMph: averageSpeed * 2.23694,
    heartRateBpm: null,
    isPaused: outdoor.isPaused,
    navigationInstruction: outdoor.nextInstruction ?? undefined,
    elevationGainMeters: outdoor.aggregate.elevationGainMeters,
    elevationLossMeters: outdoor.aggregate.elevationLossMeters,
  }).catch(() => undefined);
}

async function publishStrengthState(): Promise<void> {
  const strength = useActiveStrengthSessionStore.getState().session;
  if (!strength) return;
  const current = strength.exercises[strength.currentExerciseIndex];
  const next = strength.exercises[strength.currentExerciseIndex + 1];
  if (!current) return;
  await updateStrengthLiveActivity({
    workoutName: strength.workoutName,
    workoutInstanceId: strength.workoutInstanceId,
    sessionId: strengthLiveActivitySessionId(strength),
    sessionSource: strength.source,
    elapsedSeconds: activeStrengthElapsedSeconds(strength),
    currentExercise: current.name,
    nextExercise: next?.name ?? '',
    setsCompleted: strength.completedExerciseIds.length,
    totalSets: strength.exercises.length,
    isPaused: strength.status === 'paused',
    prescription: `${current.sets}×${current.reps}`,
    loadDisplay: strength.loadByExercise[current.id]
      || (current.equipment.includes('bodyweight') ? 'Bodyweight' : 'Load not set'),
    progressLabel: `${strength.completedExerciseIds.length}/${strength.exercises.length} exercises`,
  }).catch(() => undefined);
}

export default function LiveActivityCommandReconciler() {
  useEffect(() => {
    let cancelled = false;
    let stopPolling: (() => void) | null = null;

    void Promise.all([
      waitForHydration(useActiveRunStore),
      waitForHydration(useActiveActivityStore),
      waitForHydration(useActiveStrengthSessionStore),
    ]).then(() => {
      if (cancelled) return;
      stopPolling = startControlCommandPolling({
        pause: command => {
          if (runCommandMatches(command)) {
            useActiveRunStore.getState().pauseRun();
            void publishRunState();
          } else if (outdoorCommandMatches(command)) {
            useActiveActivityStore.getState().pause();
            void publishOutdoorState();
          }
        },
        resume: command => {
          if (runCommandMatches(command)) {
            useActiveRunStore.getState().resumeRun();
            void publishRunState();
          } else if (outdoorCommandMatches(command)) {
            useActiveActivityStore.getState().resume();
            void publishOutdoorState();
          }
        },
        stop: command => {
          if (runCommandMatches(command)) {
            useActiveRunStore.getState().requestCompletion();
            router.replace('/(tabs)/training' as never);
          } else if (outdoorCommandMatches(command)) {
            useActiveActivityStore.getState().requestCompletion();
            router.replace('/(tabs)/activity/start' as never);
          }
        },
        strength_pause: command => {
          if (!strengthCommandMatches(command)) return;
          useActiveStrengthSessionStore.getState().pause();
          void publishStrengthState();
        },
        strength_resume: command => {
          if (!strengthCommandMatches(command)) return;
          useActiveStrengthSessionStore.getState().resume();
          void publishStrengthState();
        },
        strength_complete: command => {
          if (!strengthCommandMatches(command)) return;
          const source = useActiveStrengthSessionStore.getState().session?.source;
          useActiveStrengthSessionStore.getState().requestCompletion();
          router.replace((source === 'preset' ? '/(tabs)/strength/preset-session' : '/(tabs)/strength') as never);
          void publishStrengthState();
        },
      });
    });

    return () => {
      cancelled = true;
      stopPolling?.();
    };
  }, []);

  return null;
}
