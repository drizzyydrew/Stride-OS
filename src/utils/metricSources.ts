import type { TelemetrySource } from '../types/activity';

export type MetricSourceLabel = {
  source: TelemetrySource;
  label: string;
  trustedFor: string[];
};

export const METRIC_SOURCE_LABELS: Record<TelemetrySource, MetricSourceLabel> = {
  phone_gps: { source: 'phone_gps', label: 'Phone GPS', trustedFor: ['distance', 'pace', 'speed', 'route', 'elevation'] },
  phone_motion: { source: 'phone_motion', label: 'Phone motion estimate', trustedFor: ['steps', 'cadence estimates when carried on body'] },
  apple_watch: { source: 'apple_watch', label: 'Apple Watch', trustedFor: ['heart rate', 'distance', 'pace', 'supported running metrics'] },
  healthkit: { source: 'healthkit', label: 'Apple Health', trustedFor: ['workouts', 'heart rate', 'energy', 'authorized samples'] },
  foot_pod: { source: 'foot_pod', label: 'Foot pod', trustedFor: ['distance', 'pace', 'cadence'] },
  ftms_treadmill: { source: 'ftms_treadmill', label: 'Connected treadmill', trustedFor: ['distance', 'speed', 'incline'] },
  smart_trainer: { source: 'smart_trainer', label: 'Smart trainer', trustedFor: ['power', 'speed', 'cadence', 'distance when reported'] },
  heart_rate_monitor: { source: 'heart_rate_monitor', label: 'Heart-rate monitor', trustedFor: ['heart rate'] },
  cycling_power_meter: { source: 'cycling_power_meter', label: 'Cycling power meter', trustedFor: ['power', 'cadence when reported'] },
  manual_equipment_entry: { source: 'manual_equipment_entry', label: 'Equipment display entry', trustedFor: ['distance', 'time', 'speed shown by equipment'] },
  manual_entry: { source: 'manual_entry', label: 'Manual entry', trustedFor: ['user-entered values'] },
  prescribed_estimate: { source: 'prescribed_estimate', label: 'Plan estimate', trustedFor: ['estimated training load only'] },
  unavailable: { source: 'unavailable', label: 'Unavailable', trustedFor: [] },
};

export function labelForMetricSource(source: TelemetrySource | null | undefined): string {
  return METRIC_SOURCE_LABELS[source ?? 'unavailable'].label;
}

export function isSourceAuthoritativeForMetric(source: TelemetrySource | null | undefined, metric: string): boolean {
  if (!source || source === 'unavailable' || source === 'prescribed_estimate') return false;
  if (source === 'phone_motion') return metric === 'steps' || metric === 'cadence';
  if (source === 'phone_gps') return ['distance', 'pace', 'speed', 'route', 'elevation'].includes(metric);
  if (source === 'heart_rate_monitor') return metric === 'heartRate';
  return true;
}
