import type { UnitSystem } from '../../store/settingsStore';
import {
  MONTHLY_DISTANCE_BY_ID,
  type MonthlyDistanceDefinition,
  type MonthlyDistanceMilestoneKm,
} from './monthlyDistanceDefinitions';

const M_PER_MI = 1609.344;
const M_PER_KM = 1000;

export function monthlyDistanceDefinitionFromAchievementId(id: string): MonthlyDistanceDefinition | null {
  return id in MONTHLY_DISTANCE_BY_ID
    ? MONTHLY_DISTANCE_BY_ID[id as MonthlyDistanceDefinition['id']]
    : null;
}

export function formatMonthlyDistanceBadgeText(kilometers: MonthlyDistanceMilestoneKm): `${number}K` {
  return `${kilometers}K` as `${number}K`;
}

export function formatMonthlyDistanceMeters(meters: number, units: UnitSystem): string {
  if (units === 'metric') return `${Number((meters / M_PER_KM).toFixed(1)).toLocaleString()} km`;
  return `${Number((meters / M_PER_MI).toFixed(1)).toLocaleString()} mi`;
}

export function formatMonthlyDistanceRemainingMeters(meters: number, units: UnitSystem): string {
  return formatMonthlyDistanceMeters(meters, units);
}

export function monthlyDistanceAchievementAccessibilityLabel(
  definition: MonthlyDistanceDefinition,
  state: 'earned' | 'locked' | 'newly_earned' | 'current',
  units: UnitSystem,
  remainingMeters = 0,
): string {
  if (state === 'locked') {
    const remaining = formatMonthlyDistanceRemainingMeters(remainingMeters, units)
      .replace(' mi', ' miles')
      .replace(' km', ' kilometers');
    return `${definition.thresholdKm} kilometer monthly distance achievement. Locked. ${remaining} remaining this month.`;
  }
  return `${definition.thresholdKm} kilometer monthly distance achievement. Unlocked.`;
}
