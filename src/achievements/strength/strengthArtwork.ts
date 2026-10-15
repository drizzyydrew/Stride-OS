import { APPROVED_ARTWORK } from './approvedArtwork';
import { renderApprovedVector } from '../shared/approvedVector';
import {
  STRENGTH_ACHIEVEMENT_BY_ID,
  normalizeStrengthAchievementBadgeState,
  type StrengthAchievementBadgeInputState,
  type StrengthAchievementBadgeState,
  type StrengthAchievementDefinition,
  type StrengthAchievementId,
} from './strengthDefinitions';
import {
  STRENGTH_COLORS,
  STRENGTH_LOCKED_COLORS,
  STRENGTH_NEAR_BLACK,
} from './strengthTokens';
import { strengthAchievementAccessibilityLabel } from './strengthUtils';

export type { StrengthAchievementBadgeInputState, StrengthAchievementBadgeState } from './strengthDefinitions';

export const STRENGTH_VIEWBOX = 100;
export const STRENGTH_HEXAGON_PATH =
  'M50 5.5 Q52.3 5.5 54.5 6.8 L85.7 24.8 Q88 26.1 88 28.8 L88 71.2 Q88 73.9 85.7 75.2 L54.5 93.2 Q52.3 94.5 50 94.5 Q47.7 94.5 45.5 93.2 L14.3 75.2 Q12 73.9 12 71.2 L12 28.8 Q12 26.1 14.3 24.8 L45.5 6.8 Q47.7 5.5 50 5.5 Z';
export const STRENGTH_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";
export const STRENGTH_DISPLAY_FONT = "'Avenir Next', Inter, Arial, sans-serif";

// Frozen construction source used by the approved hollow-plate adapter.
// Production renders the compiled derivative, not these original thick bars.
export const STRENGTH_DUMBBELL_SIGNATURE =
  '<!-- strength-dumbbell-start --><g data-glyph="canonical-strength-dumbbell"><path d="M24.6 38.9 H75.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M31.1 31.8 V46 M36.2 29.4 V48.4 M63.8 29.4 V48.4 M68.9 31.8 V46 M27.1 34.9 V42.9 M72.9 34.9 V42.9" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/><path d="M40.7 38.9 H59.3" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g><!-- strength-dumbbell-end -->';

export type StrengthRenderTokens = {
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

export function strengthBadgeTokens(state: StrengthAchievementBadgeState): StrengthRenderTokens {
  const locked = state === 'locked';
  const transparent = state === 'transparent';
  const colors = locked ? STRENGTH_LOCKED_COLORS : STRENGTH_COLORS;
  return {
    ...colors,
    fill: transparent ? 'transparent' : STRENGTH_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    secondaryOpacity: locked ? 0.24 : 0.34,
    ambientOpacity: locked ? 0.06 : transparent ? 0 : 0.16,
    glyphOpacity: locked ? 0.42 : 0.96,
    titleOpacity: locked ? 0.48 : 0.96,
    wordmarkOpacity: locked ? 0.32 : 0.76,
    chevronOpacity: locked ? 0.3 : 0.88,
    keylineOpacity: transparent ? 0.72 : 0,
  };
}

export function renderStrengthDumbbellGlyph(tokens: StrengthRenderTokens): string {
  return (strengthSessionDumbbellFragment(renderStrengthAchievementBadgeSvg('first_strength_session')) ?? '')
    .replace(/stroke="#[\da-fA-F]{6}"/g, `stroke="${tokens.primary}"`);
}

export function strengthSessionDumbbellFragment(svg: string): string | null {
  const start = svg.indexOf('<g data-glyph="canonical-strength-dumbbell-outline"');
  if (start < 0) return null;
  const tags = /<\/?g\b[^>]*>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(svg); tag; tag = tags.exec(svg)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return svg.slice(start, tags.lastIndex);
  }
  return null;
}

export function renderStrengthAchievementBadgeSvg(
  achievement: StrengthAchievementId,
  state: StrengthAchievementBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number; remaining?: number } = {},
): string {
  const definition = STRENGTH_ACHIEVEMENT_BY_ID[achievement];
  const visualState = normalizeStrengthAchievementBadgeState(state);
  return renderApprovedVector(APPROVED_ARTWORK[achievement], visualState, {
    ...options,
    label: strengthAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', options.remaining),
    namespace: `strength-${definition.slug}-${visualState}`,
  });
}
