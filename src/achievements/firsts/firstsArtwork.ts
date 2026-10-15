import type { UnitSystem } from '../../store/settingsStore';
import {
  FIRST_ACHIEVEMENT_BY_ID,
  normalizeFirstAchievementBadgeState,
  type FirstAchievementBadgeInputState,
  type FirstAchievementBadgeState,
  type FirstAchievementId,
} from './firstsDefinitions';
import { FIRSTS_COLORS, FIRSTS_LOCKED_COLORS, FIRSTS_NEAR_BLACK } from './firstsTokens';
import { FIRSTS_GLYPH_ARTWORK } from './firstsGlyphs';
import { FIRSTS_TITLE_PATHS, FIRSTS_WORDMARK_PATH, FIRSTS_SHIELD_TEXT_PATHS } from './firstsTypography';
import { firstAchievementAccessibilityLabel, firstAchievementBadgeShieldLabel } from './firstsUtils';

export type { FirstAchievementBadgeInputState, FirstAchievementBadgeState } from './firstsDefinitions';

export const FIRSTS_VIEWBOX = 100;
export const FIRSTS_HEXAGON_PATH =
  'M50 4 Q52.4 4 54.5 5.2 L84.8 22.6 Q87 23.9 87 26.5 L87 72 Q87 74.6 84.8 75.9 L54.5 93.8 Q52.4 95 50 95 Q47.6 95 45.5 93.8 L15.2 75.9 Q13 74.6 13 72 L13 26.5 Q13 23.9 15.2 22.6 L45.5 5.2 Q47.6 4 50 4 Z';
export const FIRSTS_LABEL_FONT = 'Arial Narrow';
export const FIRSTS_DISPLAY_FONT = FIRSTS_LABEL_FONT;

export type FirstsRenderTokens = {
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

export function firstsBadgeTokens(state: FirstAchievementBadgeState): FirstsRenderTokens {
  return {
    ...(state === 'locked' ? FIRSTS_LOCKED_COLORS : FIRSTS_COLORS),
    fill: state === 'transparent' ? 'transparent' : state === 'locked' ? '#090909' : FIRSTS_NEAR_BLACK,
    fillOpacity: state === 'transparent' ? 0 : 1,
    borderOpacity: 1,
    secondaryOpacity: 1,
    ambientOpacity: state === 'transparent' ? 0 : 1,
    glyphOpacity: 1,
    titleOpacity: 1,
    wordmarkOpacity: 1,
    chevronOpacity: 1,
    keylineOpacity: 0,
  };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderFirstAchievementBadgeSvg(
  achievement: FirstAchievementId,
  state: FirstAchievementBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number; unitSystem?: UnitSystem } = {},
): string {
  const resolvedState = normalizeFirstAchievementBadgeState(state);
  const definition = FIRST_ACHIEVEMENT_BY_ID[achievement];
  const compact = options.compact ?? false;
  const size = options.size ?? FIRSTS_VIEWBOX;
  const units = options.unitSystem ?? 'imperial';
  const tokens = firstsBadgeTokens(resolvedState);
  const edgeId = `firsts-${definition.slug}-${resolvedState}-edge`;
  const ambientId = `firsts-${definition.slug}-${resolvedState}-ambient`;
  const label = firstAchievementAccessibilityLabel(definition, resolvedState === 'locked' ? 'locked' : 'earned', units);
  const shieldLabel = firstAchievementBadgeShieldLabel(definition, units);
  const shieldText = shieldLabel ? FIRSTS_SHIELD_TEXT_PATHS[shieldLabel as keyof typeof FIRSTS_SHIELD_TEXT_PATHS] : '';
  const glyph = FIRSTS_GLYPH_ARTWORK[achievement]
    .replace('{{shieldText}}', shieldText)
    .replace(/currentColor/g, tokens.primary)
    .replace(/\{\{highlight\}\}/g, tokens.highlight);
  const title = FIRSTS_TITLE_PATHS[achievement].replace(/currentColor/g, tokens.text);
  const wordmark = FIRSTS_WORDMARK_PATH.replace(/currentColor/g, tokens.text);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="20" y1="4" x2="80" y2="95" gradientUnits="userSpaceOnUse">
      <stop stop-color="${tokens.highlight}"/><stop offset=".5" stop-color="${tokens.primary}"/><stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${ambientId}"><stop stop-color="${tokens.primary}" stop-opacity=".025"/><stop offset="1" stop-color="${tokens.primary}" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="${FIRSTS_HEXAGON_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="1.02" stroke-linejoin="round"/>
  ${resolvedState === 'transparent' ? '' : `<ellipse cx="50" cy="35" rx="30" ry="27" fill="url(#${ambientId})"/>`}
  ${glyph}
  ${compact ? '' : `<g data-title="${escapeXml(definition.title)}">${title}</g>
  <g data-wordmark="STRIDEOS">${wordmark}</g>
  <path data-chevrons="2" d="M45.1 81.6 L50 84.5 L54.9 81.6 M45.4 85.2 L50 88 L54.6 85.2" stroke="${tokens.primary}" stroke-width=".73" stroke-linecap="round" stroke-linejoin="round"/>`}
</svg>
`;
}
