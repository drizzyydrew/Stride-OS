import type { PowerSample } from '../types/activity';
import { distanceMeters, MAX_SPEED_MPS, type TrackPoint } from './activityTracking';
import { estimateCyclingWatts } from './outdoorPower';

/** Conservative live adapter; never substitutes flat grade for missing altitude. */
export function liveCyclingPower(input: {
  activityType: string;
  isPaused: boolean;
  points: readonly TrackPoint[];
  recordingPauses: readonly { startTime: number; endTime: number }[];
  bodyMassKg: number;
  bikeMassKg: number;
  now: number;
}): PowerSample | null {
  if (input.activityType !== 'cycling' || input.isPaused) return null;
  const last = input.points.at(-1);
  if (!last || !Number.isFinite(last.timestamp) || input.now < last.timestamp || input.now - last.timestamp > 5_000) return null;
  const points = input.points.filter(point => point.timestamp >= last.timestamp - 20_000);
  if (points.length < 3) return null;
  let meters = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    if (![point.latitude, point.longitude, point.timestamp, point.altitudeMeters, point.accuracyMeters].every(Number.isFinite)
      || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180
      || point.accuracyMeters! <= 0 || point.accuracyMeters! > 20) return null;
    const previous = points[index - 1];
    if (!previous) continue;
    const seconds = (point.timestamp - previous.timestamp) / 1000;
    const delta = distanceMeters(previous, point);
    if (seconds <= 0 || seconds > 5 || delta / seconds > MAX_SPEED_MPS.cycling!
      || input.recordingPauses.some(pause => pause.startTime < point.timestamp && pause.endTime > previous.timestamp)) return null;
    meters += delta;
  }
  const first = points[0]!;
  const seconds = (last.timestamp - first.timestamp) / 1000;
  if (meters < 20 || seconds < 5) return null;
  const grade = (last.altitudeMeters! - first.altitudeMeters!) / meters;
  const watts = estimateCyclingWatts({ bodyMassKg: input.bodyMassKg, bikeMassKg: input.bikeMassKg,
    speedMps: meters / seconds, grade, accelerationMps2: 0 });
  if (watts == null) return null;
  return { timestamp: last.timestamp, watts, sport: 'cycling', source: 'model_estimate', kind: 'model_estimated', modelVersion: 'stride-road-load/2' };
}
