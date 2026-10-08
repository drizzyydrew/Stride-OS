import {
  CHALLENGE_ACHIEVEMENT_BY_ID,
  type ChallengeAchievementDefinition,
  type ChallengeAchievementId,
} from './challengesDefinitions';

export function challengeAchievementDefinitionFromAchievementId(id: string): ChallengeAchievementDefinition | null {
  return id in CHALLENGE_ACHIEVEMENT_BY_ID
    ? CHALLENGE_ACHIEVEMENT_BY_ID[id as ChallengeAchievementId]
    : null;
}

export function challengeAchievementAccessibilityLabel(
  definition: ChallengeAchievementDefinition,
  state: 'locked' | 'earned' | 'newly_earned' | 'current',
): string {
  const status = state === 'locked' ? 'Locked.' : 'Unlocked.';
  return `${definition.title} achievement. ${status}`;
}
