import type { Activity, ActivityCoordinate } from '../types/activity';
import type { UnitSystem } from '../store/settingsStore';
import { formatPaceSecPerMile } from '../lib/units';

const M_PER_MI = 1609.344;
const M_PER_KM = 1000;
const EARTH_RADIUS_M = 6371000;

export type RunSplitTrend = 'baseline' | 'faster' | 'slower' | 'even';

export type RunSplit = {
  index: number;
  label: string;
  distanceLabel: string;
  paceLabel: string;
  trend: RunSplitTrend;
  deltaLabel: string | null;
  secondsPerUnit: number;
};

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

function distanceBetweenMeters(a: ActivityCoordinate, b: ActivityCoordinate): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function formatDelta(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function compareSplit(secondsPerUnit: number, previous?: RunSplit): Pick<RunSplit, 'trend' | 'deltaLabel'> {
  if (!previous) return { trend: 'baseline', deltaLabel: null };
  const delta = secondsPerUnit - previous.secondsPerUnit;
  if (Math.abs(delta) < 1) return { trend: 'even', deltaLabel: 'Even' };
  return {
    trend: delta < 0 ? 'faster' : 'slower',
    deltaLabel: `${formatDelta(Math.abs(delta))} ${delta < 0 ? 'faster' : 'slower'}`,
  };
}

function paceLabel(secondsPerUnit: number, units: UnitSystem): string {
  const secondsPerMile = units === 'metric' ? secondsPerUnit * 1.609344 : secondsPerUnit;
  return formatPaceSecPerMile(secondsPerMile, units);
}

function splitLabel(index: number, units: UnitSystem): string {
  return units === 'metric' ? `Km ${index}` : `Mile ${index}`;
}

function distanceLabel(distanceMeters: number, units: UnitSystem): string {
  const unitMeters = units === 'metric' ? M_PER_KM : M_PER_MI;
  const value = distanceMeters / unitMeters;
  const unit = units === 'metric' ? 'km' : 'mi';
  return `${value >= 0.95 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

function isRunLike(activity: Activity): boolean {
  return activity.activityType === 'running' || activity.subtype === 'run_walk';
}

function routeSplits(activity: Activity, units: UnitSystem): RunSplit[] {
  const points = (activity.metrics.routeCoordinates ?? [])
    .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && finitePositive(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (points.length < 2) return [];

  const unitMeters = units === 'metric' ? M_PER_KM : M_PER_MI;
  const out: RunSplit[] = [];
  let cumulativeMeters = 0;
  let splitStartMeters = 0;
  let splitStartTime = points[0]!.timestamp;
  let nextBoundaryMeters = unitMeters;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const segmentMeters = distanceBetweenMeters(previous, current);
    const segmentMs = current.timestamp - previous.timestamp;
    if (!finitePositive(segmentMeters) || !finitePositive(segmentMs)) continue;

    while (cumulativeMeters + segmentMeters >= nextBoundaryMeters) {
      const ratio = (nextBoundaryMeters - cumulativeMeters) / segmentMeters;
      const boundaryTime = previous.timestamp + ratio * segmentMs;
      const splitDistance = nextBoundaryMeters - splitStartMeters;
      const splitSeconds = (boundaryTime - splitStartTime) / 1000;
      if (finitePositive(splitSeconds)) {
        const secondsPerUnit = splitSeconds / (splitDistance / unitMeters);
        const comparison = compareSplit(secondsPerUnit, out.at(-1));
        out.push({
          index: out.length + 1,
          label: splitLabel(out.length + 1, units),
          distanceLabel: distanceLabel(splitDistance, units),
          paceLabel: paceLabel(secondsPerUnit, units),
          secondsPerUnit,
          ...comparison,
        });
      }
      splitStartMeters = nextBoundaryMeters;
      splitStartTime = boundaryTime;
      nextBoundaryMeters += unitMeters;
    }

    cumulativeMeters += segmentMeters;
  }

  const partialDistance = cumulativeMeters - splitStartMeters;
  const lastTimestamp = points.at(-1)!.timestamp;
  const partialSeconds = (lastTimestamp - splitStartTime) / 1000;
  if (partialDistance >= unitMeters * 0.25 && finitePositive(partialSeconds)) {
    const secondsPerUnit = partialSeconds / (partialDistance / unitMeters);
    const comparison = compareSplit(secondsPerUnit, out.at(-1));
    out.push({
      index: out.length + 1,
      label: splitLabel(out.length + 1, units),
      distanceLabel: distanceLabel(partialDistance, units),
      paceLabel: paceLabel(secondsPerUnit, units),
      secondsPerUnit,
      ...comparison,
    });
  }

  return out;
}

function storedPaceSplits(activity: Activity, units: UnitSystem): RunSplit[] {
  const splits = activity.metrics.pace?.splitsSecondsPerKilometer?.filter(finitePositive) ?? [];
  if (!splits.length) return [];
  const unitMeters = units === 'metric' ? M_PER_KM : M_PER_MI;
  return splits.map((secondsPerKm, index, all) => {
    const secondsPerUnit = units === 'metric' ? secondsPerKm : secondsPerKm * 1.609344;
    const previousSecondsPerUnit = index > 0
      ? (units === 'metric' ? all[index - 1]! : all[index - 1]! * 1.609344)
      : undefined;
    const previous = previousSecondsPerUnit
      ? { secondsPerUnit: previousSecondsPerUnit } as RunSplit
      : undefined;
    return {
      index: index + 1,
      label: splitLabel(index + 1, units),
      distanceLabel: distanceLabel(unitMeters, units),
      paceLabel: paceLabel(secondsPerUnit, units),
      secondsPerUnit,
      ...compareSplit(secondsPerUnit, previous),
    };
  });
}

export function buildRunSplits(activity: Activity, units: UnitSystem): RunSplit[] {
  if (!isRunLike(activity)) return [];
  const fromRoute = routeSplits(activity, units);
  if (fromRoute.length) return fromRoute;
  return storedPaceSplits(activity, units);
}
