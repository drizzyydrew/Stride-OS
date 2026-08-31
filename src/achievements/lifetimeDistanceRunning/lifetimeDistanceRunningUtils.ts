import type { UnitSystem } from '../../store/settingsStore';
import {
  LIFETIME_DISTANCE_RUNNING_BY_ID,
  type LifetimeDistanceRunningDefinition,
} from './lifetimeDistanceRunningDefinitions';

const KM_PER_MILE = 1.609344;
const METERS_PER_MILE = 1609.344;

function numberWithOptionalDecimal(value: number, digits: 0 | 1): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function cleanDistanceNumber(value: number): string {
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return numberWithOptionalDecimal(rounded, isWhole ? 0 : 1);
}

export function lifetimeDistanceRunningDefinitionFromAchievementId(id: string): LifetimeDistanceRunningDefinition | null {
  return id in LIFETIME_DISTANCE_RUNNING_BY_ID
    ? LIFETIME_DISTANCE_RUNNING_BY_ID[id as LifetimeDistanceRunningDefinition['id']]
    : null;
}

export function formatLifetimeRunningMilestoneNumber(miles: number, units: UnitSystem): string {
  if (units === 'imperial') {
    return numberWithOptionalDecimal(miles, Number.isInteger(miles) ? 0 : 1);
  }
  const kilometers = miles * KM_PER_MILE;
  if (miles === 1 || miles === 26.2) return numberWithOptionalDecimal(kilometers, 1);
  return Math.round(kilometers).toLocaleString();
}

export function formatLifetimeRunningMilestoneTarget(miles: number, units: UnitSystem): string {
  return `${formatLifetimeRunningMilestoneNumber(miles, units)} ${units === 'metric' ? 'km' : 'mi'}`;
}

export function formatLifetimeRunningDistanceMeters(meters: number, units: UnitSystem): string {
  const value = units === 'metric' ? meters / 1000 : meters / METERS_PER_MILE;
  return `${cleanDistanceNumber(Math.max(0, value))} ${units === 'metric' ? 'km' : 'mi'}`;
}

export function formatLifetimeRunningRemainingMeters(meters: number, units: UnitSystem): string {
  const value = units === 'metric' ? meters / 1000 : meters / METERS_PER_MILE;
  const positive = Math.max(0, value);
  if (positive > 0 && positive < 0.1) return `0.1 ${units === 'metric' ? 'km' : 'mi'}`;
  return formatLifetimeRunningDistanceMeters(meters, units);
}

export function lifetimeRunningUnitLabel(units: UnitSystem): 'MI' | 'KM' {
  return units === 'metric' ? 'KM' : 'MI';
}

export function lifetimeRunningAchievementAccessibilityLabel(
  definition: LifetimeDistanceRunningDefinition,
  state: 'locked' | 'earned' | 'newly_earned' | 'current',
  units: UnitSystem,
  remainingMeters = 0,
): string {
  const target = formatLifetimeRunningMilestoneNumber(definition.thresholdMiles, units);
  const unit = units === 'metric' ? 'kilometer' : 'mile';
  if (state === 'locked') {
    const remaining = formatLifetimeRunningRemainingMeters(remainingMeters, units).replace(' km', ' kilometers').replace(' mi', ' miles');
    return `${target} ${unit} lifetime running distance achievement. Locked. ${remaining} remaining.`;
  }
  return `${target} ${unit} lifetime running distance achievement. Unlocked.`;
}
