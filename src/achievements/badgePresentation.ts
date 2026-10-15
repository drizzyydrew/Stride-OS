import type { AchievementFamily, EvaluatedAchievement } from '../utils/achievementSystem';
import { CHALLENGE_PRESENTATION_DEFINITIONS } from './challenges/challengesDefinitions';
import { CHALLENGES_COLORS } from './challenges/challengesTokens';
import { STRENGTH_ACHIEVEMENT_DEFINITIONS } from './strength/strengthDefinitions';
import { STRENGTH_COLORS } from './strength/strengthTokens';

export type BadgePresentationFamily = 'challenges' | 'strength';

/** Visual context never changes canonical family, threshold, state or earned ID. */
export function achievementBadgePresentation(
  achievement: EvaluatedAchievement,
  requestedFamily?: string,
): EvaluatedAchievement {
  const definition = requestedFamily === 'challenges'
    ? CHALLENGE_PRESENTATION_DEFINITIONS.find(item => item.id === achievement.id)
    : requestedFamily === 'strength'
      ? STRENGTH_ACHIEVEMENT_DEFINITIONS.find(item => item.id === achievement.id)
      : undefined;
  if (!definition) return achievement;
  const dominantColor = 'colorToken' in definition ? CHALLENGES_COLORS[definition.colorToken].primary : STRENGTH_COLORS.primary;
  return {
    ...achievement,
    category: requestedFamily === 'challenges' ? 'challenges' : 'strength',
    title: definition.title,
    shortTitle: definition.compactTitle,
    artworkPath: definition.artworkPath,
    lockedArtworkPath: definition.lockedArtworkPath,
    shareArtPath: definition.unlockedPngPath,
    shareOverlayPath: definition.shareTransparentPngPath,
    dominantColor,
  };
}

export function badgeFamilyPresentationRows(
  achievements: readonly EvaluatedAchievement[],
  filter: 'all' | AchievementFamily,
): EvaluatedAchievement[] {
  const definitions = filter === 'challenges' ? CHALLENGE_PRESENTATION_DEFINITIONS
    : filter === 'strength' ? STRENGTH_ACHIEVEMENT_DEFINITIONS : undefined;
  if (!definitions) return [...achievements];
  const byId = new Map(achievements.map(item => [item.id, item]));
  return definitions.flatMap(definition => {
    const achievement = byId.get(definition.id);
    return achievement ? [achievementBadgePresentation(achievement, filter)] : [];
  });
}
