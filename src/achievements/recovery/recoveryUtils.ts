import {
  RECOVERY_ACHIEVEMENT_BY_ID,
  type RecoveryAchievementDefinition,
  type RecoveryAchievementId,
} from './recoveryDefinitions';

export function recoveryAchievementDefinitionFromAchievementId(id: string): RecoveryAchievementDefinition | null {
  return id in RECOVERY_ACHIEVEMENT_BY_ID
    ? RECOVERY_ACHIEVEMENT_BY_ID[id as RecoveryAchievementId]
    : null;
}

export function recoveryAchievementSupportValue(definition: RecoveryAchievementDefinition): string {
  if (definition.progressKind === 'nights') return `${definition.threshold} nights`;
  if (definition.progressKind === 'checkIns') return `${definition.threshold} check-ins`;
  if (definition.progressKind === 'days') return `${definition.threshold} days`;
  return '1';
}

export function recoveryAchievementProgressText(definition: RecoveryAchievementDefinition, current: number): string {
  const safeCurrent = Math.max(0, Math.min(definition.threshold, Math.round(current)));
  const remaining = Math.max(0, definition.threshold - safeCurrent);
  if (definition.progressKind === 'binary') return definition.lockedCopy;
  if (definition.progressKind === 'nights') return `${safeCurrent} / ${definition.threshold} nights. ${remaining} nights remaining.`;
  if (definition.progressKind === 'checkIns') return `${safeCurrent} / ${definition.threshold} check-ins. ${remaining} check-ins remaining.`;
  return `${safeCurrent} / ${definition.threshold} days. ${remaining} days remaining.`;
}

export function recoveryAchievementAccessibilityLabel(
  definition: RecoveryAchievementDefinition,
  state: 'locked' | 'earned' | 'newly_earned' | 'current',
  remaining?: number,
): string {
  const status = state === 'locked' ? 'Locked.' : 'Unlocked.';
  if (state === 'locked' && remaining !== undefined && definition.progressKind !== 'binary') {
    const safeRemaining = Math.max(0, Math.round(remaining));
    if (definition.progressKind === 'nights') return `${definition.title} achievement. ${status} ${safeRemaining} nights remaining.`;
    if (definition.progressKind === 'checkIns') return `${definition.title} achievement. ${status} ${safeRemaining} check-ins remaining.`;
    return `${definition.title} achievement. ${status} ${safeRemaining} days remaining.`;
  }
  return `${definition.title} achievement. ${status}`;
}
