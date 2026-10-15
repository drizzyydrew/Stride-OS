import type { ActivityDraft, WatchRecordingEvidence } from '../types/activity';
import type { ActiveActivityStore } from '../store/activeActivityStore';
import { OUTDOOR_SPORTS } from './outdoorSports';
import { outdoorTelemetryMetrics } from './outdoorTelemetry';
import { appendTrackingPoint, type TrackingAggregate } from './activityTracking';

export type OutdoorEndCommand = {
  workoutInstanceId: string;
  endedAt: number;
  elapsedSeconds?: number;
  distanceMeters?: number;
  watchRecording?: WatchRecordingEvidence;
};
export type OutdoorCompletionDraft = ActivityDraft & { id: string; workoutInstanceId: string; endTime: number };

/** Capture before the first await; recovery must never substitute its own clock. */
export function captureOutdoorCompletion(state: ActiveActivityStore, command: OutdoorEndCommand): OutdoorCompletionDraft {
  const startedAt = state.startedAt;
  if (!state.isActive || state.workoutInstanceId !== command.workoutInstanceId || startedAt == null
    || !Number.isFinite(command.endedAt) || command.endedAt < startedAt || command.endedAt > Date.now() + 5_000) {
    throw new Error('End does not match this outdoor recording');
  }
  const inRecording = <T extends { timestamp: number }>(samples: T[]) => samples
    .filter(sample => sample.timestamp >= startedAt && sample.timestamp <= command.endedAt).map(sample => ({ ...sample }));
  const telemetry = outdoorTelemetryMetrics({ ...state,
    rawHeartRateSamples: inRecording(state.rawHeartRateSamples), cadenceSamples: inRecording(state.cadenceSamples),
    powerSamples: inRecording(state.powerSamples),
  }, command.endedAt);
  const wallSeconds = (command.endedAt - startedAt) / 1000;
  const pausedMs = (telemetry.recordingPauses ?? []).reduce((sum, pause) => sum + pause.endTime - pause.startTime, 0);
  const activeSeconds = command.elapsedSeconds ?? Math.max(0, wallSeconds - pausedMs / 1000);
  const points = inRecording(state.aggregate.points);
  // Use the same bounded, pause-aware calculation regardless of End delivery timing.
  const empty: TrackingAggregate = { points: [], distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0,
    currentMetersPerSecond: 0, averageMetersPerSecond: 0, maximumMetersPerSecond: 0 };
  const speed = points.reduce((aggregate, point) => {
    const previous = aggregate.points.at(-1);
    if (previous && telemetry.recordingPauses?.some(pause => pause.startTime < point.timestamp && pause.endTime > previous.timestamp)) {
      return { ...aggregate, points: [...aggregate.points, point], currentMetersPerSecond: 0 };
    }
    return appendTrackingPoint(aggregate, point, state.activityType, activeSeconds);
  }, empty);
  const distance = command.distanceMeters ?? speed.distanceMeters;
  if (!Number.isFinite(activeSeconds) || activeSeconds < 0 || activeSeconds > wallSeconds + 1
    || !Number.isFinite(distance) || distance < 0) throw new Error('Outdoor End contains invalid measured totals');
  const compatibleRunWalk = (state.activityType === 'running' || state.activityType === 'walking') && state.runWalkIntervals.length > 0;
  const evidence = command.watchRecording ?? state.watchRecording;
  return {
    id: state.activityId ?? `outdoor_${encodeURIComponent(command.workoutInstanceId)}`,
    workoutInstanceId: command.workoutInstanceId,
    watchRecording: evidence?.workoutInstanceId === command.workoutInstanceId ? { ...evidence } : undefined,
    activityType: state.activityType, subtype: compatibleRunWalk ? 'run_walk' : state.subtype,
    source: 'tracked', status: 'completed', completionClassification: 'completed_as_prescribed',
    scheduled: Boolean(state.scheduledSessionId), scheduledSessionId: state.scheduledSessionId ?? undefined,
    associatedTrainingBlockId: state.associatedTrainingBlockId ?? undefined, associatedGoalId: state.associatedGoalId ?? undefined,
    startTime: startedAt, endTime: command.endedAt, indoor: false,
    metrics: {
      ...telemetry, durationSeconds: activeSeconds, elapsedTimeSeconds: wallSeconds, activeTimeSeconds: activeSeconds,
      distanceMeters: distance, distanceSource: 'gps',
      elevationGainMeters: speed.elevationGainMeters, elevationLossMeters: speed.elevationLossMeters,
      speed: { currentMetersPerSecond: speed.currentMetersPerSecond, averageMetersPerSecond: speed.averageMetersPerSecond,
        maximumMetersPerSecond: speed.maximumMetersPerSecond },
      pace: OUTDOOR_SPORTS[state.activityType].speedBased ? undefined : {
        currentSecondsPerKilometer: speed.currentMetersPerSecond ? 1000 / speed.currentMetersPerSecond : undefined,
        averageSecondsPerKilometer: speed.averageMetersPerSecond ? 1000 / speed.averageMetersPerSecond : undefined,
      },
      routeId: state.routeId ?? undefined,
      routeCoordinates: points.map(point => ({ latitude: point.latitude, longitude: point.longitude,
        timestamp: point.timestamp, altitudeMeters: point.altitudeMeters, horizontalAccuracyMeters: point.accuracyMeters })),
      runWalkIntervals: compatibleRunWalk ? state.runWalkIntervals.map(interval => ({ ...interval })) : undefined,
      metricSources: { distance: command.distanceMeters != null ? 'apple_watch' : 'phone_gps', speed: 'phone_gps',
        pace: 'phone_gps', elevation: 'phone_gps', heartRate: telemetry.rawHeartRateSamples?.at(-1)?.source ?? 'unavailable' },
    },
  };
}
