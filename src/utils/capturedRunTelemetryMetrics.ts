import type { ActiveRunStore } from '../store/activeRunStore';
import type { ActivityMetrics } from '../types/activity';
import { outdoorTelemetryMetrics } from './outdoorTelemetry';
import { appendTrackingPoint, type TrackingAggregate, type TrackPoint } from './activityTracking';

type Snapshot = Pick<ActiveRunStore,
  'rawHeartRateSamples' | 'cadenceSamples' | 'powerSamples' | 'recordingPauses'
  | 'startTime' | 'isPaused' | 'pausedAt' | 'telemetryStartedAt' | 'telemetryEndedAt'>
  & Partial<Pick<ActiveRunStore, 'coordinates' | 'environment'>>;

/** B passes the captured state, not a store read after completion/reset. */
export function capturedRunTelemetryMetrics(snapshot: Snapshot, endedAt = snapshot.telemetryEndedAt ?? Date.now()): Partial<ActivityMetrics> {
  const startedAt = snapshot.startTime ?? snapshot.telemetryStartedAt;
  const bounded = <T extends { timestamp: number }>(samples: T[] = []) => samples
    .filter(sample => startedAt != null && Number.isFinite(sample.timestamp)
      && sample.timestamp >= startedAt && sample.timestamp <= endedAt)
    .map(sample => ({ ...sample }));
  const metrics = outdoorTelemetryMetrics({ ...snapshot, startedAt,
    recordingPauses: snapshot.recordingPauses ?? [], rawHeartRateSamples: bounded(snapshot.rawHeartRateSamples),
    cadenceSamples: bounded(snapshot.cadenceSamples), powerSamples: bounded(snapshot.powerSamples),
  }, endedAt);
  const pauses = metrics.recordingPauses ?? [];
  const elapsed = startedAt != null && Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt >= startedAt
    ? (endedAt - startedAt) / 1000 : undefined;
  const active = elapsed == null ? undefined : Math.max(0, elapsed
    - pauses.reduce((sum, pause) => sum + pause.endTime - pause.startTime, 0) / 1000);
  let aggregate: TrackingAggregate = { points: [], distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0,
    currentMetersPerSecond: 0, averageMetersPerSecond: 0, maximumMetersPerSecond: 0 };
  let observedAltitudePair = false;
  if (snapshot.environment !== 'indoor') {
    const coordinates = bounded(snapshot.coordinates).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng)
      && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180).sort((a, b) => a.timestamp - b.timestamp);
    for (const coordinate of coordinates) {
      const point: TrackPoint = { latitude: coordinate.lat, longitude: coordinate.lng, timestamp: coordinate.timestamp,
        altitudeMeters: Number.isFinite(coordinate.altitudeM) ? coordinate.altitudeM : undefined };
      const previous = aggregate.points.at(-1);
      // Match route-analysis continuity: never infer a climb across a pause or >30s GPS gap.
      if (previous && (point.timestamp - previous.timestamp > 30_000
        || pauses.some(pause => pause.startTime < point.timestamp && pause.endTime > previous.timestamp))) {
        aggregate = { ...aggregate, points: [point] };
        continue;
      }
      const next = appendTrackingPoint(aggregate, point, 'running', active ?? 0);
      if (previous && next !== aggregate && Number.isFinite(previous.altitudeMeters) && Number.isFinite(point.altitudeMeters)) {
        observedAltitudePair = true;
      }
      aggregate = next.points.length > 1 ? { ...next, points: next.points.slice(-1) } : next;
    }
  }
  return { ...metrics, elapsedTimeSeconds: elapsed, activeTimeSeconds: active,
    ...(observedAltitudePair ? { elevationGainMeters: aggregate.elevationGainMeters, elevationLossMeters: aggregate.elevationLossMeters,
      metricSources: { ...metrics.metricSources, elevation: 'phone_gps' as const } } : {}),
  };
}
