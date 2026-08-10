import type { Activity, ActivityMetrics } from '../types/activity';
import type { UnitSystem } from '../store/settingsStore';
import {
  distanceUnitLabel,
  formatDistance,
  formatExerciseWeightLb,
  formatPaceSecPerMile,
  formatSpeedMps,
} from '../lib/units';
import { displayLabel } from './displayLabels';

export type ActivitySummaryMetric = {
  label: string;
  value: string;
  priority: 'primary' | 'detail';
  privacy: 'public' | 'health' | 'private';
};

export type ActivitySummarySection = {
  title: string;
  metrics: ActivitySummaryMetric[];
};

export type ActivitySummary = {
  title: string;
  primary: ActivitySummaryMetric[];
  sections: ActivitySummarySection[];
};

const M_PER_MI = 1609.344;

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatElevationMeters(meters: number | null | undefined, units: UnitSystem): string {
  if (!finitePositive(meters)) return '';
  if (units === 'metric') return `${Math.round(meters).toLocaleString()} m`;
  return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
}

function metric(
  label: string,
  value: string | null | undefined,
  priority: ActivitySummaryMetric['priority'] = 'detail',
  privacy: ActivitySummaryMetric['privacy'] = 'public',
): ActivitySummaryMetric | null {
  if (!value || value === '0' || value === '0.0 mi' || value === '0.0 km') return null;
  return { label, value, priority, privacy };
}

function pushMetric(target: ActivitySummaryMetric[], item: ActivitySummaryMetric | null): void {
  if (item) target.push(item);
}

function formatDistanceMeters(meters: number | null | undefined, units: UnitSystem): string | null {
  if (!finitePositive(meters)) return null;
  return formatDistance(meters / M_PER_MI, units);
}

function averagePace(metrics: ActivityMetrics, units: UnitSystem): string | null {
  const secPerKm = metrics.pace?.averageSecondsPerKilometer;
  if (!finitePositive(secPerKm)) return null;
  return formatPaceSecPerMile(secPerKm * 1.609344, units);
}

function splitSummary(metrics: ActivityMetrics, units: UnitSystem): string | null {
  const splits = metrics.pace?.splitsSecondsPerKilometer?.filter(finitePositive) ?? [];
  if (!splits.length) return null;
  const best = Math.min(...splits) * 1.609344;
  return `${splits.length} ${distanceUnitLabel(units)} splits, best ${formatPaceSecPerMile(best, units)}`;
}

function runWalkSummary(metrics: ActivityMetrics): string | null {
  const intervals = metrics.runWalkIntervals ?? [];
  if (!intervals.length) return null;
  const runCount = intervals.filter(item => item.kind === 'run').length;
  const walkCount = intervals.filter(item => item.kind === 'walk').length;
  return `${runCount} run / ${walkCount} walk segments`;
}

function hrZoneSummary(metrics: ActivityMetrics): string | null {
  const zones = metrics.heartRateZoneSeconds;
  if (!zones) return null;
  const entries = Object.entries(zones)
    .filter(([, seconds]) => finitePositive(seconds))
    .map(([zone, seconds]) => `Z${zone} ${Math.round((seconds ?? 0) / 60)}m`);
  return entries.length ? entries.join(' - ') : null;
}

function strengthExerciseSummary(metrics: ActivityMetrics, units: UnitSystem): ActivitySummaryMetric[] {
  const strength = metrics.strength;
  if (!strength) return [];
  const out: ActivitySummaryMetric[] = [];
  pushMetric(out, metric('Exercises', strength.exerciseCount ? String(strength.exerciseCount) : null));
  pushMetric(out, metric('Sets', strength.sets ? String(strength.sets) : null));
  pushMetric(out, metric('Reps', strength.reps ? String(strength.reps) : null));
  pushMetric(out, metric('External load', strength.externalLoadVolumeLb ? formatExerciseWeightLb(Math.round(strength.externalLoadVolumeLb), units) : null));
  pushMetric(out, metric('Band sets', strength.bandSetsCount ? String(strength.bandSetsCount) : null));
  pushMetric(out, metric('Bodyweight sets', strength.bodyweightSetsCount ? String(strength.bodyweightSetsCount) : null));
  pushMetric(out, metric('Holds', strength.totalHoldSeconds ? formatDuration(strength.totalHoldSeconds) : null));
  pushMetric(out, metric('Avg strength RPE', strength.averageRpe ? `${strength.averageRpe.toFixed(1)}/10` : null, 'detail', 'health'));
  if (strength.exercises?.length) {
    pushMetric(out, metric('Exercise list', strength.exercises.map(item => item.name).slice(0, 5).join(', '), 'detail', 'private'));
  }
  return out;
}

export function buildActivitySummary(
  activity: Activity,
  units: UnitSystem,
  options: { dataRich?: boolean; includePrivate?: boolean } = {},
): ActivitySummary {
  const dataRich = options.dataRich ?? true;
  const metrics = activity.metrics;
  const endurance = ['running', 'walking', 'hiking', 'cycling', 'indoor_cycling', 'downhill_skiing', 'cross_country_skiing', 'snowboarding', 'elliptical', 'rowing', 'stair_climbing'].includes(activity.activityType);
  const speedBased = ['cycling', 'indoor_cycling', 'downhill_skiing', 'cross_country_skiing', 'snowboarding', 'rowing'].includes(activity.activityType);
  const primary: ActivitySummaryMetric[] = [];

  pushMetric(primary, metric('Duration', formatDuration(metrics.durationSeconds), 'primary'));
  if (endurance) pushMetric(primary, metric('Distance', formatDistanceMeters(metrics.distanceMeters, units), 'primary'));
  if (speedBased) {
    pushMetric(primary, metric('Average speed', finitePositive(metrics.speed?.averageMetersPerSecond) ? formatSpeedMps(metrics.speed.averageMetersPerSecond, units) : null, 'primary'));
  } else if (['running', 'walking', 'hiking'].includes(activity.activityType)) {
    pushMetric(primary, metric('Average pace', averagePace(metrics, units), 'primary'));
  }
  if (activity.activityType === 'strength') {
    pushMetric(primary, metric('Exercises', metrics.strength?.exerciseCount ? String(metrics.strength.exerciseCount) : null, 'primary'));
    pushMetric(primary, metric('Sets', metrics.strength?.sets ? String(metrics.strength.sets) : null, 'primary'));
  }
  if (dataRich) pushMetric(primary, metric('Average HR', metrics.averageHeartRateBpm ? `${Math.round(metrics.averageHeartRateBpm)} bpm` : null, 'primary', 'health'));
  pushMetric(primary, metric('Elevation gain', formatElevationMeters(metrics.elevationGainMeters, units), 'primary'));
  pushMetric(primary, metric('RPE', activity.rpe ? `${activity.rpe}/10` : null, 'primary', 'health'));

  const performance: ActivitySummaryMetric[] = [];
  pushMetric(performance, metric('Active time', metrics.activeTimeSeconds ? formatDuration(metrics.activeTimeSeconds) : null));
  pushMetric(performance, metric('Elapsed time', metrics.elapsedTimeSeconds && metrics.elapsedTimeSeconds !== metrics.durationSeconds ? formatDuration(metrics.elapsedTimeSeconds) : null));
  pushMetric(performance, metric('Maximum speed', finitePositive(metrics.speed?.maximumMetersPerSecond) ? formatSpeedMps(metrics.speed.maximumMetersPerSecond, units) : null));
  pushMetric(performance, metric('Maximum HR', dataRich && metrics.maximumHeartRateBpm ? `${Math.round(metrics.maximumHeartRateBpm)} bpm` : null, 'detail', 'health'));
  pushMetric(performance, metric('Cadence', dataRich && metrics.cadenceRpm ? `${Math.round(metrics.cadenceRpm)} rpm` : null));
  pushMetric(performance, metric('Average power', dataRich && metrics.cyclingPowerWatts ? `${Math.round(metrics.cyclingPowerWatts)} W` : null));
  pushMetric(performance, metric('Elevation loss', formatElevationMeters(metrics.elevationLossMeters, units)));
  pushMetric(performance, metric('Calories', dataRich && metrics.estimatedCalories ? `${Math.round(metrics.estimatedCalories)} kcal` : null, 'detail', 'health'));
  pushMetric(performance, metric('HR zones', dataRich ? hrZoneSummary(metrics) : null, 'detail', 'health'));
  pushMetric(performance, metric('Splits', dataRich ? splitSummary(metrics, units) : null));
  pushMetric(performance, metric('Workout structure', runWalkSummary(metrics)));
  pushMetric(performance, metric('Distance source', metrics.distanceSource ? displayLabel(metrics.distanceSource) : null));

  const activitySpecific: ActivitySummaryMetric[] = [];
  if (metrics.resistanceLevel) pushMetric(activitySpecific, metric('Resistance', metrics.resistanceLevel));
  if (metrics.swimming) {
    pushMetric(activitySpecific, metric('Swim environment', displayLabel(metrics.swimming.environment)));
    pushMetric(activitySpecific, metric('Laps', metrics.swimming.laps ? String(metrics.swimming.laps) : null));
    pushMetric(activitySpecific, metric('Stroke', metrics.swimming.strokeType ? displayLabel(metrics.swimming.strokeType) : null));
  }
  if (metrics.skiing) {
    pushMetric(activitySpecific, metric('Descent', formatElevationMeters(metrics.skiing.descentMeters, units)));
  }
  if (metrics.mixedModal) {
    pushMetric(activitySpecific, metric('Rounds', metrics.mixedModal.rounds ? String(metrics.mixedModal.rounds) : null));
    pushMetric(activitySpecific, metric('Work intervals', metrics.mixedModal.workIntervals ? String(metrics.mixedModal.workIntervals) : null));
    pushMetric(activitySpecific, metric('Strength component', metrics.mixedModal.strengthComponent ?? null));
  }
  activitySpecific.push(...strengthExerciseSummary(metrics, units));

  const link: ActivitySummaryMetric[] = [];
  pushMetric(link, metric('Completed vs planned', activity.completionClassification ? displayLabel(activity.completionClassification) : null));
  pushMetric(link, metric('Linked plan', activity.scheduledSessionId ? 'Scheduled workout' : null, 'detail', 'private'));
  pushMetric(link, metric('Route', metrics.routeId || metrics.routeCoordinates?.length ? 'Saved route available' : null, 'detail', 'private'));
  pushMetric(link, metric('Shoe', activity.shoeId ? 'Assigned' : null, 'detail', 'private'));
  pushMetric(link, metric('Whole-body load', dataRich ? `${Math.round(activity.trainingLoad.wholeBody)}` : null, 'detail', 'health'));

  return {
    title: displayLabel(activity.subtype === 'run_walk' ? 'run_walk' : activity.activityType),
    primary: primary.slice(0, 8),
    sections: [
      { title: 'Performance', metrics: performance },
      { title: 'Activity Specifics', metrics: activitySpecific },
      { title: 'Training Link', metrics: link },
    ].filter(section => section.metrics.length),
  };
}

export function buildActivityShareMessage(activity: Activity, units: UnitSystem): string {
  const summary = buildActivitySummary(activity, units, { dataRich: false, includePrivate: false });
  const safeMetrics = summary.primary
    .filter(item => item.privacy === 'public')
    .slice(0, 4)
    .map(item => `${item.label}: ${item.value}`)
    .join('\n');
  return `StrideOS\n${summary.title}\n${safeMetrics}`;
}
