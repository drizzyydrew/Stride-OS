import type { UnitSystem } from '../../store/settingsStore';
import {
  WEEKLY_DISTANCE_BY_ID,
  type WeeklyDistanceDefinition,
  type WeeklyDistanceMilestoneKm,
} from './weeklyDistanceDefinitions';

const METERS_PER_MILE = 1609.344;

function cleanDistanceNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: isWhole ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

export function weeklyDistanceDefinitionFromAchievementId(id: string): WeeklyDistanceDefinition | null {
  return id in WEEKLY_DISTANCE_BY_ID
    ? WEEKLY_DISTANCE_BY_ID[id as WeeklyDistanceDefinition['id']]
    : null;
}

export function formatWeeklyDistanceBadgeText(kilometers: WeeklyDistanceMilestoneKm): `${number}K` {
  return `${kilometers}K` as `${number}K`;
}

export function formatWeeklyDistanceMeters(meters: number, units: UnitSystem): string {
  const value = units === 'metric' ? meters / 1000 : meters / METERS_PER_MILE;
  return `${cleanDistanceNumber(Math.max(0, value))} ${units === 'metric' ? 'km' : 'mi'}`;
}

export function formatWeeklyDistanceRemainingMeters(meters: number, units: UnitSystem): string {
  const value = units === 'metric' ? meters / 1000 : meters / METERS_PER_MILE;
  const positive = Math.max(0, value);
  if (positive > 0 && positive < 0.1) return `0.1 ${units === 'metric' ? 'km' : 'mi'}`;
  return formatWeeklyDistanceMeters(meters, units);
}

export function weeklyDistanceAchievementAccessibilityLabel(
  definition: WeeklyDistanceDefinition,
  state: 'locked' | 'earned' | 'newly_earned' | 'current',
  units: UnitSystem,
  remainingMeters = 0,
): string {
  if (state === 'locked') {
    const remaining = formatWeeklyDistanceRemainingMeters(remainingMeters, units)
      .replace(' km', ' kilometers')
      .replace(' mi', ' miles');
    return `${definition.thresholdKm} kilometer weekly distance achievement. Locked. ${remaining} remaining this week.`;
  }
  return `${definition.thresholdKm} kilometer weekly distance achievement. Unlocked.`;
}
