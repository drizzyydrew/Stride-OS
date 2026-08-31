import type { DistanceSource } from '../../types/activity';

export type BleMetricSource =
  | 'ftms_treadmill'
  | 'ftms_trainer'
  | 'foot_pod'
  | 'wheel_sensor'
  | 'ble_hr'
  | 'apple_watch'
  | 'power_meter'
  | 'confirmed_speed_estimate'
  | 'manual';

export type BleMetricReading = {
  metric: 'distance' | 'heartRate' | 'speed' | 'cadence' | 'power';
  value: number;
  source: BleMetricSource;
  observedAt: number;
};

export type ArbitedMetric = {
  value: number | null;
  source: BleMetricSource | null;
  distanceSource?: DistanceSource;
  stale: boolean;
  reason?: string;
};

const DISTANCE_PRIORITY: BleMetricSource[] = [
  'ftms_treadmill',
  'ftms_trainer',
  'foot_pod',
  'wheel_sensor',
  'apple_watch',
  'confirmed_speed_estimate',
  'manual',
];

export function arbitrateDistance(
  readings: readonly BleMetricReading[],
  now: number,
  staleAfterMs = 5000,
): ArbitedMetric {
  const candidates = readings
    .filter(item => item.metric === 'distance' && Number.isFinite(item.value) && item.value >= 0)
    .filter(item => now - item.observedAt <= staleAfterMs)
    .sort((a, b) => DISTANCE_PRIORITY.indexOf(a.source) - DISTANCE_PRIORITY.indexOf(b.source));
  const best = candidates[0];
  if (!best) return { value: null, source: null, stale: true, reason: 'no_current_distance_source' };
  return { value: best.value, source: best.source, distanceSource: distanceSourceFor(best.source), stale: false };
}

export function arbitrateHeartRate(
  readings: readonly BleMetricReading[],
  now: number,
  staleAfterMs = 10_000,
): ArbitedMetric {
  const priority: BleMetricSource[] = ['ble_hr', 'apple_watch'];
  const best = readings
    .filter(item => item.metric === 'heartRate' && Number.isFinite(item.value) && item.value > 0)
    .filter(item => now - item.observedAt <= staleAfterMs)
    .sort((a, b) => {
      const aRank = priority.includes(a.source) ? priority.indexOf(a.source) : priority.length;
      const bRank = priority.includes(b.source) ? priority.indexOf(b.source) : priority.length;
      return aRank - bRank || b.observedAt - a.observedAt;
    })[0];
  return best
    ? { value: best.value, source: best.source, stale: false }
    : { value: null, source: null, stale: true, reason: 'no_current_hr_source' };
}

export function rejectFabricatedCyclingDistance(readings: readonly BleMetricReading[]): boolean {
  return !readings.some(item => item.metric === 'distance')
    && readings.some(item => item.metric === 'heartRate' || item.metric === 'power');
}

function distanceSourceFor(source: BleMetricSource): DistanceSource {
  switch (source) {
  case 'ftms_treadmill': return 'treadmill_reported';
  case 'ftms_trainer': return 'trainer_reported';
  case 'foot_pod': return 'foot_pod';
  case 'wheel_sensor': return 'wheel_sensor';
  case 'apple_watch': return 'health_import';
  case 'confirmed_speed_estimate': return 'confirmed_speed_estimate';
  default: return 'manual_entry';
  }
}
