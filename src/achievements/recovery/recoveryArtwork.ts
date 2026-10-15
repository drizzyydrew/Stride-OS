import { APPROVED_ARTWORK } from './approvedArtwork';
import { renderApprovedVector } from '../shared/approvedVector';
import {
  RECOVERY_ACHIEVEMENT_BY_ID,
  normalizeRecoveryAchievementBadgeState,
  type RecoveryAchievementBadgeInputState,
  type RecoveryAchievementBadgeState,
  type RecoveryAchievementDefinition,
  type RecoveryAchievementId,
} from './recoveryDefinitions';
import {
  RECOVERY_COLORS,
  RECOVERY_LOCKED_COLORS,
  RECOVERY_NEAR_BLACK,
} from './recoveryTokens';
import { recoveryAchievementAccessibilityLabel } from './recoveryUtils';

export type { RecoveryAchievementBadgeInputState, RecoveryAchievementBadgeState } from './recoveryDefinitions';

export const RECOVERY_VIEWBOX = 100;
export const RECOVERY_HEXAGON_PATH =
  'M50 5.5 Q52.3 5.5 54.5 6.8 L85.7 24.8 Q88 26.1 88 28.8 L88 71.2 Q88 73.9 85.7 75.2 L54.5 93.2 Q52.3 94.5 50 94.5 Q47.7 94.5 45.5 93.2 L14.3 75.2 Q12 73.9 12 71.2 L12 28.8 Q12 26.1 14.3 24.8 L45.5 6.8 Q47.7 5.5 50 5.5 Z';
export const RECOVERY_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";

export type RecoveryRenderTokens = {
  primary: string;
  secondary: string;
  highlight: string;
  shadow: string;
  glow: string;
  text: string;
  fill: string;
  fillOpacity: number;
  borderOpacity: number;
  secondaryOpacity: number;
  ambientOpacity: number;
  glyphOpacity: number;
  titleOpacity: number;
  wordmarkOpacity: number;
  chevronOpacity: number;
  keylineOpacity: number;
};

export function recoveryBadgeTokens(state: RecoveryAchievementBadgeState): RecoveryRenderTokens {
  const locked = state === 'locked';
  const transparent = state === 'transparent';
  const colors = locked ? RECOVERY_LOCKED_COLORS : RECOVERY_COLORS;
  return {
    ...colors,
    fill: transparent ? 'transparent' : RECOVERY_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    secondaryOpacity: locked ? 0.24 : 0.34,
    ambientOpacity: locked ? 0.06 : transparent ? 0 : 0.18,
    glyphOpacity: locked ? 0.42 : 0.96,
    titleOpacity: locked ? 0.48 : 0.96,
    wordmarkOpacity: locked ? 0.32 : 0.76,
    chevronOpacity: locked ? 0.3 : 0.88,
    keylineOpacity: transparent ? 0.72 : 0,
  };
}

export function renderRecoveryAchievementBadgeSvg(
  achievement: RecoveryAchievementId,
  state: RecoveryAchievementBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number; remaining?: number } = {},
): string {
  const definition = RECOVERY_ACHIEVEMENT_BY_ID[achievement];
  const visualState = normalizeRecoveryAchievementBadgeState(state);
  return renderApprovedVector(APPROVED_ARTWORK[achievement], visualState, {
    ...options,
    label: recoveryAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', options.remaining),
    namespace: `recovery-${definition.slug}-${visualState}`,
  });
}
