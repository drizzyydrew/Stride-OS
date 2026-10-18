import type { Activity, PowerEstimate, PowerSample, TelemetrySource } from '../types/activity';
import { buildRouteObservations, sampleAtTime, weightedSensorMean, type RouteObservation } from './outdoorAnalysis';

export const CYCLING_POWER_ASSUMPTIONS = [
  'Experimental road-load estimate; field error is unknown, not a power meter.',
  'Still air, no drafting, air density 1.225 kg/m3, drag area 0.32 m2.',
  'Road rolling resistance 0.005 and drivetrain efficiency 97%.',
  'Negative road-load demand is floored at zero; pedaling, braking and coasting cannot be distinguished.',
];
export const RUNNING_POWER_ASSUMPTIONS = [
  'Metabolic expenditure estimate, NOT mechanical or wearable running power.',
  'Minetti 2002 treadmill running cost curve; individual field accuracy is unknown.',
  'Excludes wind, individual economy and running dynamics; not comparable to cycling watts.',
  'Running only; mixed run/walk and grades outside -45% to +45% are not modeled.',
];

export function estimateCyclingWatts(input: { bodyMassKg: number; bikeMassKg?: number; speedMps: number; grade: number; accelerationMps2?: number }): number | null {
  const bikeMassKg = input.bikeMassKg ?? 10;
  const { bodyMassKg, speedMps: horizontalSpeed, grade } = input;
  const horizontalAcceleration = input.accelerationMps2 ?? 0;
  if (![bodyMassKg, bikeMassKg, horizontalSpeed, grade, horizontalAcceleration].every(Number.isFinite)
    || bodyMassKg < 20 || bodyMassKg > 300 || bikeMassKg < 1 || bikeMassKg > 60
    || horizontalSpeed < 0 || horizontalSpeed > 30 || Math.abs(grade) > 0.35 || Math.abs(horizontalAcceleration) > 2) return null;
  // Callers supply horizontal GPS speed/acceleration; forces act along the road.
  const slopeFactor = Math.hypot(1, grade);
  const speed = horizontalSpeed * slopeFactor;
  const acceleration = horizontalAcceleration * slopeFactor;
  const mass = bodyMassKg + bikeMassKg;
  const theta = Math.atan(grade);
  const rolling = 0.005 * mass * 9.80665 * Math.cos(theta);
  const gravity = mass * 9.80665 * Math.sin(theta);
  const drag = 0.5 * 1.225 * 0.32 * speed * speed;
  return Math.max(0, (rolling + gravity + drag + mass * acceleration) * speed / 0.97);
}

export function estimateRunningMetabolicWatts(bodyMassKg: number, speedMps: number, grade: number): number | null {
  if (![bodyMassKg, speedMps, grade].every(Number.isFinite) || bodyMassKg < 20 || bodyMassKg > 300
    || speedMps < 1.8 || speedMps > 7 || Math.abs(grade) > 0.45) return null;
  const cost = 155.4 * grade ** 5 - 30.4 * grade ** 4 - 43.3 * grade ** 3 + 46.3 * grade ** 2 + 19.5 * grade + 3.6;
  return Math.max(0, cost * bodyMassKg * speedMps);
}

export function powerModelExclusionReason(activity: Activity, route: RouteObservation[] = buildRouteObservations(activity)): string | null {
  if (activity.indoor || ['indoor', 'treadmill', 'stationary'].includes(activity.subtype ?? '')) return 'Outdoor power estimates require a recorded outdoor route.';
  if (['manual', 'training_plan'].includes(activity.source) && !activity.workoutInstanceId && !activity.healthKit) {
    return 'Manual distance, elevation and duration do not identify total power. A timed recorded route is required.';
  }
  if (activity.activityType !== 'running') return null;
  if (activity.subtype === 'run_walk' || activity.metrics.runWalkIntervals?.length) return 'Mixed run/walk activities are not modeled.';
  if (route.some(point => point.continuous && (point.gradeRejected || (point.grade != null && Math.abs(point.grade) > 0.45)))) {
    return 'Running metabolic estimates exclude the entire activity when any usable grade is outside -45% to +45%.';
  }
  return null;
}

function routeInputSource(activity: Activity): TelemetrySource {
  if (activity.source === 'healthkit' || activity.healthKit) return 'healthkit';
  const source = activity.metrics.metricSources?.distance;
  return source === 'phone_gps' || source === 'apple_watch' || source === 'healthkit' ? source : 'unavailable';
}

export type ClimbingWorkCalculation = { kilojoules: number; averageClimbingWatts?: number; seconds?: number; timeBasis?: 'active' | 'duration' | 'elapsed'; note: string };

export function climbingWorkTime(activity: Pick<Activity, 'metrics'>): { seconds: number; timeBasis: 'active' | 'duration' | 'elapsed' } | null {
  const m = activity.metrics;
  // An explicitly invalid/zero active duration must not become a positive elapsed estimate.
  if (m.activeTimeSeconds != null) return Number.isFinite(m.activeTimeSeconds) && m.activeTimeSeconds > 0 ? { seconds: m.activeTimeSeconds, timeBasis: 'active' } : null;
  if (m.durationSeconds != null) return Number.isFinite(m.durationSeconds) && m.durationSeconds > 0 ? { seconds: m.durationSeconds, timeBasis: 'duration' } : null;
  return Number.isFinite(m.elapsedTimeSeconds) && m.elapsedTimeSeconds! > 0 ? { seconds: m.elapsedTimeSeconds!, timeBasis: 'elapsed' } : null;
}

export function estimateClimbingWork(activity: Pick<Activity, 'activityType' | 'indoor' | 'metrics'>, bodyMassKg: number): ClimbingWorkCalculation | null {
  const gain = activity.metrics.elevationGainMeters;
  const source = activity.metrics.metricSources?.elevation;
  if (source === 'prescribed_estimate' || source === 'unavailable') return null;
  if (!['walking', 'hiking'].includes(activity.activityType) || activity.indoor
    || !Number.isFinite(bodyMassKg) || bodyMassKg < 20 || bodyMassKg > 300 || !Number.isFinite(gain) || gain! <= 0) return null;
  const joules = bodyMassKg * 9.80665 * gain!;
  if (!Number.isFinite(joules)) return null;
  const time = climbingWorkTime(activity);
  const watts = time ? joules / time.seconds : undefined;
  return {
    kilojoules: joules / 1000,
    ...(time ? { ...time, ...(Number.isFinite(watts) ? { averageClimbingWatts: watts } : {}) } : {}),
    note: 'Positive-ascent climbing component only (m g h). Assisted ascent cannot be distinguished and may be included. Excludes backpack, horizontal movement and muscle inefficiency; not total human power or calories.',
  };
}

export function estimateActivityPower(activity: Activity, bodyMassKg: number, bikeMassKg = 10, now = Date.now()): PowerEstimate | null {
  const cycling = activity.activityType === 'cycling';
  const running = activity.activityType === 'running' && activity.subtype !== 'run_walk' && !activity.metrics.runWalkIntervals?.length;
  if (!cycling && !running) return null;
  if (!Number.isFinite(bodyMassKg) || bodyMassKg < 20 || bodyMassKg > 300) return null;
  const route = buildRouteObservations(activity);
  if (powerModelExclusionReason(activity, route)) return null;
  const samples: { watts: number; seconds: number }[] = [];
  // A 20m grade window and a 5s speed window suppress single-fix spikes.
  for (let index = 1; index < route.length; index += 1) {
    const observation = route[index]!;
    if (!observation.continuous || observation.grade == null) continue;
    let meters = observation.segmentMeters;
    let seconds = observation.segmentSeconds;
    for (let previous = index - 1; previous > 0 && seconds < 5; previous -= 1) {
      const point = route[previous]!;
      if (!point.continuous) break;
      meters += point.segmentMeters;
      seconds += point.segmentSeconds;
    }
    if (seconds < 3) continue;
    const speed = meters / seconds;
    const watts = cycling
      ? estimateCyclingWatts({ bodyMassKg, bikeMassKg, speedMps: speed, grade: observation.grade })
      : estimateRunningMetabolicWatts(bodyMassKg, speed * Math.hypot(1, observation.grade), observation.grade);
    if (watts != null) samples.push({ watts, seconds: observation.segmentSeconds });
  }
  const covered = samples.reduce((sum, sample) => sum + sample.seconds, 0);
  const total = activity.metrics.activeTimeSeconds ?? activity.metrics.durationSeconds ?? 0;
  const ratio = total > 0 ? Math.min(1, covered / total) : 0;
  if (covered < 20 || ratio < 0.7) return null;
  return {
    modelId: cycling ? 'stride-road-load' : 'stride-running-metabolic', version: '2',
    quantity: cycling ? 'cycling_mechanical_estimate' : 'running_metabolic_estimate',
    sport: cycling ? 'cycling' : 'running', computedAt: now,
    coverageSeconds: covered, coverageRatio: ratio,
    averageWatts: samples.reduce((sum, sample) => sum + sample.watts * sample.seconds, 0) / covered,
    assumptions: cycling
      ? [...CYCLING_POWER_ASSUMPTIONS, 'Steady-speed approximation: acceleration is omitted from this post-workout model.']
      : RUNNING_POWER_ASSUMPTIONS.slice(),
    inputs: [
      { name: 'Confirmed body mass', value: bodyMassKg, unit: 'kg', source: 'manual_entry' },
      ...(cycling ? [{ name: 'Confirmed bike mass', value: bikeMassKg, unit: 'kg', source: 'manual_entry' as const }] : []),
      { name: routeInputSource(activity) === 'unavailable' ? 'Recorded route speed and smoothed grade (recording source unknown)' : 'Recorded route speed and smoothed grade', source: routeInputSource(activity) },
    ],
  };
}

export function powerEstimateLabel(estimate: PowerEstimate): string {
  return estimate.quantity === 'running_metabolic_estimate' ? 'Metabolic power estimate' : 'Estimated cycling power';
}

export function powerSampleLabel(sample: PowerSample): string {
  if (sample.kind === 'measured') return 'Measured power';
  if (sample.kind === 'device_estimated') return sample.sport === 'running' ? 'Device running power' : 'Device-estimated cycling power';
  return sample.sport === 'cycling' ? 'Estimated cycling power' : 'Model-estimated running power';
}

export function routePowerSample(activity: Activity, timestamp: number): PowerSample | undefined {
  const sport = activity.activityType === 'running' ? 'running' : activity.activityType === 'cycling' ? 'cycling' : null;
  if (!sport) return undefined;
  const samples = (activity.metrics.powerSamples ?? []).filter(sample => sample.sport === sport
    && Number.isFinite(sample.watts) && sample.watts >= 0 && sample.timestamp >= activity.startTime);
  for (const kind of ['measured', 'device_estimated', 'model_estimated'] as const) {
    const sample = sampleAtTime(samples.filter(item => item.kind === kind), timestamp, 10_000, activity.metrics.recordingPauses);
    if (sample) return sample;
  }
  return undefined;
}

export function devicePowerSummary(activity: Activity): { watts: number; label: string; coverageRatio: number | null; kind: PowerSample['kind'] } | null {
  const sport = activity.activityType === 'running' ? 'running' : activity.activityType === 'cycling' || activity.activityType === 'indoor_cycling' ? 'cycling' : null;
  if (!sport) return null;
  const samples = (activity.metrics.powerSamples ?? []).filter(sample => sample.sport === sport && sample.kind !== 'model_estimated');
  const end = activity.endTime ?? activity.startTime + (activity.metrics.elapsedTimeSeconds ?? activity.metrics.durationSeconds ?? 0) * 1000;
  const total = activity.metrics.activeTimeSeconds ?? activity.metrics.durationSeconds ?? 0;
  for (const kind of ['measured', 'device_estimated'] as const) {
    const result = weightedSensorMean(samples.filter(sample => sample.kind === kind), sample => sample.watts, activity.startTime, end, activity.metrics.recordingPauses);
    const coverageRatio = total > 0 ? Math.min(1, result.coverageSeconds / total) : 0;
    if (result.mean != null && coverageRatio >= 0.5) return { watts: result.mean, coverageRatio, kind,
      label: kind === 'measured' ? 'Measured power' : sport === 'running' ? 'Device running power' : 'Device-estimated cycling power' };
    const watts = activity.metrics.cyclingPowerWatts;
    if (kind === 'measured' && sport === 'cycling' && Number.isFinite(watts) && watts! >= 0 && activity.metrics.metricSources?.power === 'cycling_power_meter') {
      return { watts: watts!, label: 'Measured power', coverageRatio: null, kind: 'measured' };
    }
  }
  return null;
}

export function sharePowerMetric(activity: Activity): { value: string; label: string } | null {
  const device = devicePowerSummary(activity);
  if (device) return { value: `${Math.round(device.watts)} W`, label: device.label };
  const estimate = activity.metrics.powerEstimate;
  if (validActivityPowerEstimate(activity, estimate)) {
    return { value: `${Math.round(estimate!.averageWatts!)} W`, label: powerEstimateLabel(estimate!) };
  }
  return null;
}

export function validActivityPowerEstimate(activity: Activity, estimate: PowerEstimate | undefined): boolean {
  if (!estimate || activity.indoor || ['indoor', 'treadmill', 'stationary', 'run_walk'].includes(activity.subtype ?? '')
    || activity.metrics.runWalkIntervals?.length) return false;
  if (['manual', 'training_plan'].includes(activity.source) && !activity.workoutInstanceId && !activity.healthKit) return false;
  const matches = activity.activityType === 'running' && estimate.sport === 'running' && estimate.quantity === 'running_metabolic_estimate'
    || activity.activityType === 'cycling' && estimate.sport === 'cycling' && estimate.quantity === 'cycling_mechanical_estimate';
  return Boolean(matches && estimate.modelId && estimate.version && Number.isFinite(estimate.computedAt)
    && Number.isFinite(estimate.averageWatts) && estimate.averageWatts! >= 0
    && Number.isFinite(estimate.coverageSeconds) && estimate.coverageSeconds >= 20
    && Number.isFinite(estimate.coverageRatio) && estimate.coverageRatio >= 0.7 && estimate.coverageRatio <= 1
    && Array.isArray(estimate.assumptions) && Array.isArray(estimate.inputs));
}
