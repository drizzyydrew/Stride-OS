import type { UnitSystem } from '../../store/settingsStore';
import {
  FIRST_ACHIEVEMENT_BY_ID,
  type FirstAchievementDefinition,
  type FirstAchievementId,
} from './firstsDefinitions';

export function firstAchievementDefinitionFromAchievementId(id: string): FirstAchievementDefinition | null {
  return id in FIRST_ACHIEVEMENT_BY_ID
    ? FIRST_ACHIEVEMENT_BY_ID[id as FirstAchievementId]
    : null;
}

export function firstAchievementBadgeShieldLabel(definition: FirstAchievementDefinition, units: UnitSystem): string | null {
  return definition.shieldLabel?.(units) ?? null;
}

export function firstAchievementSupportValue(definition: FirstAchievementDefinition, units: UnitSystem): string {
  if (definition.id === 'first_5k') return '5K';
  if (definition.id === 'first_10k') return '10K';
  if (definition.id === 'first_half_marathon') return units === 'metric' ? '21.1 km' : '13.1 mi';
  if (definition.id === 'first_marathon') return units === 'metric' ? '42.2 km' : '26.2 mi';
  return '1';
}

export function firstAchievementAccessibilityLabel(
  definition: FirstAchievementDefinition,
  state: 'locked' | 'earned' | 'newly_earned' | 'current',
  units: UnitSystem,
): string {
  const status = state === 'locked' ? 'Not yet achieved.' : 'Unlocked.';
  if (definition.id === 'first_half_marathon') {
    return `${definition.title} achievement. ${status} ${units === 'metric' ? '21.1 kilometers.' : '13.1 miles.'}`;
  }
  if (definition.id === 'first_marathon') {
    return `${definition.title} achievement. ${status} ${units === 'metric' ? '42.2 kilometers.' : '26.2 miles.'}`;
  }
  return `${definition.title} achievement. ${status}`;
}
