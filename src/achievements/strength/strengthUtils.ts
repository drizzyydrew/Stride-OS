import {
  STRENGTH_ACHIEVEMENT_BY_ID,
  type StrengthAchievementDefinition,
  type StrengthAchievementId,
} from './strengthDefinitions';

export function strengthAchievementDefinitionFromAchievementId(id: string): StrengthAchievementDefinition | null {
  return id in STRENGTH_ACHIEVEMENT_BY_ID
    ? STRENGTH_ACHIEVEMENT_BY_ID[id as StrengthAchievementId]
    : null;
}

export function strengthAchievementSupportValue(definition: StrengthAchievementDefinition): string {
  if (definition.thresholdUnit === 'weeks') return `${definition.threshold} weeks`;
  if (definition.thresholdUnit === 'sessions') return `${definition.threshold} sessions`;
  return '1';
}

export function strengthAchievementAccessibilityLabel(
  definition: StrengthAchievementDefinition,
  state: 'locked' | 'earned' | 'newly_earned' | 'current',
  remaining?: number,
): string {
  const status = state === 'locked' ? 'Locked.' : 'Unlocked.';
  if (state === 'locked' && remaining !== undefined) {
    const safeRemaining = Math.max(0, remaining);
    if (definition.thresholdUnit === 'weeks') {
      return `${definition.title} achievement. ${status} ${safeRemaining} weeks remaining.`;
    }
    if (definition.thresholdUnit === 'sessions') {
      return `${definition.title} achievement. ${status} ${safeRemaining} sessions remaining.`;
    }
  }
  return `${definition.title} achievement. ${status}`;
}
