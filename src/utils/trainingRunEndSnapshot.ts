import type { ActiveRunStore, Coordinate } from '../store/activeRunStore';
import type { LiveRunEntry } from '../lib/runCompletionJournal';
import type { RunEndCommand } from '../lib/runCompletionCommand';
import { capturedRunTelemetryMetrics } from './capturedRunTelemetryMetrics';
import { matchingWatchRecording, runCompletionKey } from './runCompletionIdentity';

/** Coordinates already passed the Training Run GPS filters; retain its exact distance scale. */
function milesBetween(a: Coordinate, b: Coordinate) {
  const radians = Math.PI / 180;
  const chord = Math.sin((b.lat - a.lat) * radians / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin((b.lng - a.lng) * radians / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

export function captureTrainingRunEnd(state: ActiveRunStore, command: RunEndCommand): LiveRunEntry {
  const startedAt = state.startTime;
  if (!state.isActive || state.workoutInstanceId !== command.workoutInstanceId || startedAt == null
    || !Number.isFinite(command.endedAt) || command.endedAt < startedAt || command.endedAt > Date.now() + 5_000) {
    throw new Error('End does not match the active recording');
  }
  if (state.environment === 'indoor') throw new Error('Indoor completion requires TreadmillCompletionSheet confirmation');
  const bounded = <T extends { timestamp: number }>(values: T[] = []) => values
    .filter(value => Number.isFinite(value.timestamp) && value.timestamp >= startedAt && value.timestamp <= command.endedAt)
    .map(value => ({ ...value }));
  const metrics = capturedRunTelemetryMetrics({ ...state,
    rawHeartRateSamples: bounded(state.rawHeartRateSamples), cadenceSamples: bounded(state.cadenceSamples),
    powerSamples: bounded(state.powerSamples), recordingPauses: state.recordingPauses ?? [],
  }, command.endedAt);
  const pauses = metrics.recordingPauses ?? [];
  const elapsed = command.elapsedSeconds ?? Math.max(0, (command.endedAt - startedAt
    - pauses.reduce((sum, pause) => sum + pause.endTime - pause.startTime, 0)) / 1000);
  const coordinates = bounded(state.coordinates).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  let gpsMiles = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const point = coordinates[index];
    if (point.timestamp <= previous.timestamp
      || pauses.some(pause => pause.startTime < point.timestamp && pause.endTime > previous.timestamp)) continue;
    gpsMiles += milesBetween(previous, point);
  }
  const distance = command.distanceMiles ?? gpsMiles;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > (command.endedAt - startedAt) / 1000 + 1
    || !Number.isFinite(distance) || distance < 0) throw new Error('End contains invalid measured totals');
  return {
    completionKey: runCompletionKey(command.workoutInstanceId), workoutInstanceId: command.workoutInstanceId,
    watchRecording: matchingWatchRecording(command.watchRecording, command.workoutInstanceId, startedAt)
      ?? matchingWatchRecording(state.watchRecording, command.workoutInstanceId, startedAt),
    actualStartTime: startedAt, actualEndTime: command.endedAt,
    scheduledSessionId: state.scheduledSessionId ?? undefined,
    source: state.plannedWorkout ? 'generated' : 'manual', workoutId: state.plannedWorkout?.id,
    type: state.plannedWorkout?.type ?? 'easy_run', intensity: state.plannedWorkout?.intensity ?? 'easy',
    durationMinutes: elapsed / 60, distanceMiles: distance, routeCoordinates: coordinates,
    activityMetrics: { ...metrics, durationSeconds: elapsed, activeTimeSeconds: elapsed,
      elapsedTimeSeconds: (command.endedAt - startedAt) / 1000,
      metricSources: { ...metrics.metricSources, distance: command.distanceMiles != null ? 'apple_watch' : 'phone_gps' } },
    indoor: false, distanceSource: command.distanceSource ?? 'gps', notes: 'Saved from the recording End command.',
  };
}

export function validRunEndSnapshot(snapshot: LiveRunEntry, command: RunEndCommand): boolean {
  return !!snapshot && snapshot.workoutInstanceId === command.workoutInstanceId
    && snapshot.completionKey === runCompletionKey(command.workoutInstanceId) && snapshot.indoor === false
    && snapshot.actualEndTime === command.endedAt && typeof snapshot.actualStartTime === 'number'
    && Number.isFinite(snapshot.actualStartTime) && snapshot.actualStartTime <= command.endedAt
    && Number.isFinite(snapshot.durationMinutes) && snapshot.durationMinutes >= 0
    && snapshot.durationMinutes * 60 <= (command.endedAt - snapshot.actualStartTime) / 1000 + 1
    && Number.isFinite(snapshot.distanceMiles) && snapshot.distanceMiles >= 0;
}
