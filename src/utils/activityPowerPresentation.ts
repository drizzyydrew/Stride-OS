import type { Activity, PowerEstimate } from '../types/activity';
import type { UnitSystem } from '../store/settingsStore';
import { storedClimbingWork } from './climbingWork';
import { climbingWorkTime, devicePowerSummary, powerEstimateLabel, powerModelExclusionReason, validActivityPowerEstimate } from './outdoorPower';
import { formatDuration } from './activitySummary';
import { profilePowerMass, type PowerMassProfile } from './profilePower';
import { displayLabel } from './displayLabels';

type Help = { what: string; why: string; read: string };
export type ActivityPowerPresentation = {
  title: string;
  value: number | null;
  unit: 'W' | 'kJ';
  label: string;
  context: string;
  quantity: 'climbing' | 'metabolic' | 'power';
  details: string[];
  help: Help;
  estimate?: PowerEstimate;
};

function sourceLabel(source: string | undefined): string {
  const labels: Record<string, string> = {
    manual_entry: 'Entered ascent', phone_gps: 'Phone GPS', apple_watch: 'Apple Watch', healthkit: 'Apple Health',
    barometer: 'Barometer', route_analysis: 'Route analysis', gps: 'GPS',
  };
  return source && labels[source] ? labels[source]! : 'Ascent source unknown';
}

export function formatActivityPowerValue(value: number): string {
  return value > 0 && value < 1 ? '<1' : String(Math.round(value));
}

export function activityPowerPresentation(activity: Activity, units: UnitSystem, profile?: PowerMassProfile): ActivityPowerPresentation | null {
  const title = activity.activityType === 'indoor_cycling' ? 'Indoor Cycling Work' : `${displayLabel(activity.activityType)} Work`;
  const climbing = activity.activityType === 'hiking' || activity.activityType === 'walking';
  const device = devicePowerSummary(activity);
  const entered = !device && ['cycling', 'indoor_cycling'].includes(activity.activityType)
    && Number.isFinite(activity.metrics.cyclingPowerWatts) && activity.metrics.cyclingPowerWatts! >= 0
    && activity.metrics.metricSources?.power !== 'model_estimate' ? activity.metrics.cyclingPowerWatts : undefined;
  const estimate = !device && entered == null && validActivityPowerEstimate(activity, activity.metrics.powerEstimate) ? activity.metrics.powerEstimate : undefined;
  if (!climbing && !['running', 'cycling'].includes(activity.activityType) && !device && entered == null) return null;

  if (climbing) {
    const work = storedClimbingWork(activity);
    const time = climbingWorkTime(activity);
    const averageWatts = work && time ? work.kilojoules * 1000 / time.seconds : null;
    const details = work ? [
      work.note,
      `Saved weight: ${(work.bodyMassKg * (units === 'metric' ? 1 : 2.20462)).toFixed(1)} ${units === 'metric' ? 'kg' : 'lb'}. ${work.weightProvenance.source === 'user_entered' ? 'User-entered profile weight.' : 'Legacy weight entry; original entry date unknown.'}`,
      `${sourceLabel(activity.metrics.metricSources?.elevation)}: ${Math.round(activity.metrics.elevationGainMeters! * (units === 'metric' ? 1 : 3.28084))} ${units === 'metric' ? 'm' : 'ft'}.`,
      ...(time && averageWatts != null && Number.isFinite(averageWatts) ? [`Average climbing-component power: ${formatActivityPowerValue(averageWatts)} W over ${formatDuration(time.seconds)} ${time.timeBasis === 'active' ? 'active time' : time.timeBasis === 'elapsed' ? 'elapsed time including pauses; active time unavailable' : 'duration; active time unavailable'}.`] : ['Average climbing power unavailable without a valid positive duration and finite result.']),
      'kJ is the total climbing work. Watts are that work divided by time; they are not a second total.',
    ] : [!profilePowerMass(profile) ? 'A user-saved profile weight between 20 and 300 kg is required for an estimate.'
      : activity.metrics.elevationGainMeters === 0 ? 'Entered ascent is zero; no positive climbing work.' : 'Elevation gain is required for a climbing-work estimate.'];
    return {
      title, value: work?.kilojoules ?? null, unit: 'kJ', label: 'Estimated uphill work',
      context: 'Uphill component only, not total workout energy or calories.', quantity: 'climbing', details,
      help: {
        what: 'Estimated work to lift your saved body weight uphill, measured in kilojoules (kJ).',
        why: 'Compare uphill work across similar outings. More work does not necessarily mean better fitness.',
        read: 'kJ is the total; watts in the details show the rate. This covers uphill movement only, not total effort or calories.',
      },
    };
  }

  const metabolic = estimate?.quantity === 'running_metabolic_estimate';
  const watts = device?.watts ?? entered ?? estimate?.averageWatts ?? null;
  const coverage = device ? device.coverageRatio == null ? 'Recording coverage unknown' : `${Math.round(device.coverageRatio * 100)}% recorded coverage`
    : estimate ? `${Math.round(estimate.coverageRatio * 100)}% usable GPS coverage` : 'Recording source and coverage unavailable';
  const details = device ? ['Average over the available recorded power samples.', coverage]
    : entered != null ? ['User-entered average power; sensor provenance and recording coverage are unavailable.']
      : estimate ? [`Model: ${estimate.modelId} v${estimate.version}.`, coverage,
        ...estimate.inputs.filter(input => input.unit === 'kg').map(input => `${/bike|bicycle/i.test(input.name) ? 'Bicycle mass' : 'Saved body weight'}: ${(input.value! * (units === 'metric' ? 1 : 2.20462)).toFixed(1)} ${units === 'metric' ? 'kg' : 'lb'}.`),
        ...estimate.assumptions]
        : [!profilePowerMass(profile) ? 'A user-saved profile weight between 20 and 300 kg is required for an estimate.'
          : powerModelExclusionReason(activity) ?? 'An estimate requires at least 20 seconds and 70% usable recorded GPS speed and grade coverage. Unsupported speeds and grades remain unavailable.'];
  return {
    title, value: watts, unit: 'W', quantity: metabolic ? 'metabolic' : 'power',
    label: device?.label ?? (entered != null ? 'Entered average power' : estimate ? powerEstimateLabel(estimate) : 'Power estimate unavailable'),
    context: watts == null ? 'No reliable result for this activity.' : coverage,
    details, estimate,
    help: {
      what: metabolic ? 'Estimated energy use per second, based on weight, speed and slope. Not device-measured running power.'
        : 'Power is how quickly work is done, measured in watts (W). The label shows its source.',
      why: 'Review intensity alongside pace and heart rate. Compare the same source across similar sessions.',
      read: 'Watts show a rate, not total energy. The average covers available data, not necessarily the whole activity. Metabolic and device power are not directly comparable.',
    },
  };
}
