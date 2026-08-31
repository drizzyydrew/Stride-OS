import {
  STREAK_MILESTONE_BY_ID,
  streakHeatTierForDays,
  type StreakBadgeState,
} from './streakDefinitions';
import {
  STREAK_HEAT_COLORS,
  STREAK_LOCKED_GRAY,
  STREAK_NEAR_BLACK,
  STREAK_PANEL_BLACK,
} from './streakTokens';
import { streakAchievementAccessibilityLabel } from './streakUtils';

export type { StreakBadgeState } from './streakDefinitions';

export const STREAK_VIEWBOX = 100;
export const STREAK_HEXAGON_PATH =
  'M50 7.5 Q52.3 7.5 54.4 8.7 L82.9 25.1 Q85.2 26.4 85.2 29.1 L85.2 70.9 Q85.2 73.6 82.9 74.9 L54.4 91.3 Q52.3 92.5 50 92.5 Q47.7 92.5 45.6 91.3 L17.1 74.9 Q14.8 73.6 14.8 70.9 L14.8 29.1 Q14.8 26.4 17.1 25.1 L45.6 8.7 Q47.7 7.5 50 7.5 Z';
export const STREAK_FLAME_OUTER_PATH =
  'M50.6 18.8 C43.7 27.5 35.8 36 35.8 48.3 C35.8 61.4 45 68.9 50.4 72.2 C57.2 67.6 65.1 60.5 65.1 49.2 C65.1 40.7 60.2 34.1 58.9 27.4 C55.6 32.7 53.3 36.5 52.7 41.7 C49.1 36 53.1 27.4 50.6 18.8 Z';
export const STREAK_FLAME_LEFT_PATH =
  'M40.7 42.6 C36.6 48.6 36.1 56.3 40.5 62.4 C43.5 66.4 47.5 69 50 70.3 C47.1 64.9 48.1 59 51.2 53.7 C45.5 56 42.6 51.5 43.4 45.2 C42.2 45.6 41.3 44.8 40.7 42.6 Z';
export const STREAK_FLAME_INNER_PATH =
  'M51.4 43.3 C47.7 48.9 45.8 54.8 47.6 60.8 C49.1 65.6 52.2 68.2 52.2 68.2 C56.1 64.5 58.6 60 58.6 55.1 C58.6 50.4 55.6 47.2 54.4 43.3 C53.4 46.1 52.6 48.5 52.6 51.6 C50.3 48.8 50.6 45.8 51.4 43.3 Z';
export const STREAK_NUMBER_FONT = "Didot, 'Bodoni 72', Georgia, serif";
export const STREAK_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";
export const STREAK_FLAME_TRANSFORM = 'translate(16 4) scale(0.68)';

export type StreakRenderTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
  center: string;
  fill: string;
  fillOpacity: number;
  borderOpacity: number;
  secondaryOpacity: number;
  ambientOpacity: number;
  flameOpacity: number;
  numberOpacity: number;
  labelOpacity: number;
  wordmarkOpacity: number;
  chevronOpacity: number;
  keylineOpacity: number;
};

export function streakBadgeTokens(days: number, state: StreakBadgeState): StreakRenderTokens {
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const locked = visualState === 'locked';
  const transparent = visualState === 'share-transparent';
  const heatTier = streakHeatTierForDays(days);
  const colors = locked
    ? {
        primary: STREAK_LOCKED_GRAY,
        highlight: '#D0D2D2',
        shadow: '#444748',
        glow: '#74787A',
        center: '#E8EAEA',
      }
    : STREAK_HEAT_COLORS[heatTier.token];

  return {
    ...colors,
    fill: transparent ? 'transparent' : STREAK_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    secondaryOpacity: locked ? 0.24 : 0.42,
    ambientOpacity: locked ? 0.08 : transparent ? 0 : heatTier.token === 'streakHeatWhiteHot' ? 0.18 : 0.24,
    flameOpacity: locked ? 0.42 : 1,
    numberOpacity: locked ? 0.54 : 1,
    labelOpacity: locked ? 0.42 : 0.96,
    wordmarkOpacity: locked ? 0.32 : 0.82,
    chevronOpacity: locked ? 0.3 : 0.9,
    keylineOpacity: transparent ? 0.72 : 0,
  };
}

export function streakNumberFontSize(text: string, compact = false): number {
  const base = text.length >= 4 ? 18.8 : text.length >= 3 ? 21 : text.length >= 2 ? 23 : 25;
  return compact ? Math.max(16, base - 2) : base;
}

export function streakNumberX(text: string): number {
  if (text.startsWith('1') && text.length >= 3) return 49.2;
  return 50;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderStreakBadgeSvg(
  days: number,
  state: StreakBadgeState = 'unlocked',
  options: { compact?: boolean; size?: number; remainingDays?: number } = {},
): string {
  const safeDays = Math.max(1, Math.floor(Number.isFinite(days) ? days : 1));
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const compact = options.compact ?? false;
  const size = options.size ?? STREAK_VIEWBOX;
  const tokens = streakBadgeTokens(safeDays, visualState);
  const text = String(safeDays);
  const numberSize = streakNumberFontSize(text, compact);
  const numberX = streakNumberX(text);
  const definition = Object.values(STREAK_MILESTONE_BY_ID).find(item => item.thresholdDays === safeDays);
  const stateForLabel = visualState === 'locked' ? 'locked' : 'earned';
  const label = streakAchievementAccessibilityLabel(safeDays, stateForLabel, options.remainingDays ?? 0, definition?.subtitle);
  const slug = definition?.slug ?? `${safeDays}-day`;
  const edgeId = `streak-${slug}-${visualState}-edge`;
  const flameId = `streak-${slug}-${visualState}-flame`;
  const glowId = `streak-${slug}-${visualState}-glow`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${STREAK_VIEWBOX} ${STREAK_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="17" y1="8" x2="84" y2="91" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.highlight}"/>
      <stop offset="0.5" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <linearGradient id="${flameId}" x1="43" y1="19" x2="58" y2="72" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.center}"/>
      <stop offset="0.42" stop-color="${tokens.highlight}"/>
      <stop offset="0.7" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 43) rotate(90) scale(36 32)">
      <stop offset="0" stop-color="${tokens.glow}" stop-opacity="${visualState === 'locked' ? '0.13' : '0.36'}"/>
      <stop offset="0.66" stop-color="${tokens.glow}" stop-opacity="${visualState === 'share-transparent' ? '0.04' : '0.12'}"/>
      <stop offset="1" stop-color="${tokens.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${STREAK_HEXAGON_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="2.35" stroke-linejoin="round" stroke-opacity="${tokens.borderOpacity}"/>
  <path d="${STREAK_HEXAGON_PATH}" fill="none" stroke="${tokens.highlight}" stroke-width="0.75" stroke-linejoin="round" stroke-opacity="${tokens.secondaryOpacity}" transform="translate(0.9 0.9) scale(0.982)"/>
  <ellipse cx="50" cy="44" rx="31" ry="29" fill="url(#${glowId})" opacity="${tokens.ambientOpacity}"/>
  <path d="${STREAK_FLAME_OUTER_PATH}" fill="url(#${flameId})" opacity="${tokens.flameOpacity}" transform="${STREAK_FLAME_TRANSFORM}"/>
  <path d="${STREAK_FLAME_LEFT_PATH}" fill="${tokens.primary}" opacity="${visualState === 'locked' ? 0.28 : 0.72}" transform="${STREAK_FLAME_TRANSFORM}"/>
  <path d="${STREAK_FLAME_INNER_PATH}" fill="${visualState === 'locked' ? '#111315' : STREAK_PANEL_BLACK}" opacity="${visualState === 'share-transparent' ? 0.18 : 0.92}" transform="${STREAK_FLAME_TRANSFORM}"/>
  <path d="${STREAK_FLAME_INNER_PATH}" fill="${tokens.center}" opacity="${visualState === 'locked' ? 0.22 : 0.18}" transform="${STREAK_FLAME_TRANSFORM} translate(1.1 -1.2) scale(0.94)"/>
  ${tokens.keylineOpacity > 0 ? `<text x="${numberX}" y="65.8" text-anchor="middle" dominant-baseline="middle" font-family="${STREAK_NUMBER_FONT}" font-size="${numberSize}" font-weight="600" stroke="#030405" stroke-width="1.05" stroke-opacity="${tokens.keylineOpacity}" fill="none">${escapeXml(text)}</text>` : ''}
  <text x="${numberX}" y="65.8" text-anchor="middle" dominant-baseline="middle" font-family="${STREAK_NUMBER_FONT}" font-size="${numberSize}" font-weight="600" fill="${tokens.primary}" fill-opacity="${tokens.numberOpacity}">${escapeXml(text)}</text>
  ${compact ? '' : `
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="75.2" text-anchor="middle" font-family="${STREAK_LABEL_FONT}" font-size="5.6" font-weight="900" letter-spacing="0.7" stroke="#030405" stroke-width="0.45" stroke-opacity="${tokens.keylineOpacity}" fill="none">DAY STREAK</text>` : ''}
  <text x="50" y="75.2" text-anchor="middle" font-family="${STREAK_LABEL_FONT}" font-size="5.6" font-weight="900" letter-spacing="0.7" fill="${tokens.primary}" fill-opacity="${tokens.labelOpacity}">DAY STREAK</text>
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="82.8" text-anchor="middle" font-family="${STREAK_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" stroke="#030405" stroke-width="0.35" stroke-opacity="${tokens.keylineOpacity}" fill="none">STRIDEOS</text>` : ''}
  <text x="50" y="82.8" text-anchor="middle" font-family="${STREAK_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" fill="${tokens.primary}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M43.6 86.8 L50 90.6 L56.4 86.8" fill="none" stroke="${tokens.primary}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M44.4 91 L50 94.3 L55.6 91" fill="none" stroke="${tokens.highlight}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>`}
</svg>
`;
}
