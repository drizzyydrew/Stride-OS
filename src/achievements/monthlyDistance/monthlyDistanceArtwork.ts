import {
  MONTHLY_DISTANCE_BY_KM,
  type MonthlyDistanceBadgeState,
  type MonthlyDistanceDefinition,
  type MonthlyDistanceMilestoneKm,
} from './monthlyDistanceDefinitions';
import {
  MONTHLY_DISTANCE_LOCKED_GRAY,
  MONTHLY_DISTANCE_NEAR_BLACK,
} from './monthlyDistanceTokens';
import {
  formatMonthlyDistanceBadgeText,
  monthlyDistanceAchievementAccessibilityLabel,
} from './monthlyDistanceUtils';

export type { MonthlyDistanceBadgeState } from './monthlyDistanceDefinitions';

export const MONTHLY_DISTANCE_VIEWBOX = 100;
export const MONTHLY_DISTANCE_HEXAGON_PATH =
  'M50 7.5 Q52.3 7.5 54.4 8.7 L82.9 25.1 Q85.2 26.4 85.2 29.1 L85.2 70.9 Q85.2 73.6 82.9 74.9 L54.4 91.3 Q52.3 92.5 50 92.5 Q47.7 92.5 45.6 91.3 L17.1 74.9 Q14.8 73.6 14.8 70.9 L14.8 29.1 Q14.8 26.4 17.1 25.1 L45.6 8.7 Q47.7 7.5 50 7.5 Z';
export const MONTHLY_DISTANCE_NUMBER_FONT = "Didot, 'Bodoni 72', Georgia, serif";
export const MONTHLY_DISTANCE_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";

export type MonthlyDistanceRenderTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
  fill: string;
  fillOpacity: number;
  borderOpacity: number;
  ambientOpacity: number;
  numberOpacity: number;
  labelOpacity: number;
  wordmarkOpacity: number;
  chevronOpacity: number;
  keylineOpacity: number;
};

export function monthlyDistanceBadgeTokens(
  definition: MonthlyDistanceDefinition,
  state: MonthlyDistanceBadgeState,
): MonthlyDistanceRenderTokens {
  const locked = state === 'locked';
  const transparent = state === 'share-transparent';
  const colors = locked
    ? {
        primary: MONTHLY_DISTANCE_LOCKED_GRAY,
        highlight: '#C8C8C4',
        shadow: '#4E504E',
        glow: '#777A78',
      }
    : definition.colors;

  return {
    ...colors,
    fill: transparent ? 'transparent' : MONTHLY_DISTANCE_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    ambientOpacity: locked ? 0.08 : transparent ? 0 : 0.2,
    numberOpacity: locked ? 0.54 : 1,
    labelOpacity: locked ? 0.42 : 0.95,
    wordmarkOpacity: locked ? 0.32 : 0.82,
    chevronOpacity: locked ? 0.3 : 0.9,
    keylineOpacity: transparent ? 0.72 : 0,
  };
}

export function monthlyDistanceNumberFontSize(text: string, compact = false): number {
  const base = text.length >= 4 ? 23 : text.length >= 3 ? 26 : 29;
  return compact ? Math.max(20, base - 2) : base;
}

export function monthlyDistanceNumberX(text: string): number {
  if (text.startsWith('1') && text.length >= 3) return 48.9;
  return 50;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderMonthlyDistanceBadgeSvg(
  milestoneKm: MonthlyDistanceMilestoneKm,
  state: MonthlyDistanceBadgeState = 'unlocked',
  options: { compact?: boolean; size?: number; remainingMeters?: number } = {},
): string {
  const definition = MONTHLY_DISTANCE_BY_KM[milestoneKm];
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const compact = options.compact ?? false;
  const size = options.size ?? MONTHLY_DISTANCE_VIEWBOX;
  const tokens = monthlyDistanceBadgeTokens(definition, visualState);
  const number = formatMonthlyDistanceBadgeText(definition.thresholdKm);
  const numberSize = monthlyDistanceNumberFontSize(number, compact);
  const numberX = monthlyDistanceNumberX(number);
  const stateForLabel = visualState === 'locked' ? 'locked' : 'earned';
  const label = monthlyDistanceAchievementAccessibilityLabel(definition, stateForLabel, 'metric', options.remainingMeters ?? 0);
  const edgeId = `monthly-distance-${definition.slug}-${visualState}-edge`;
  const glowId = `monthly-distance-${definition.slug}-${visualState}-glow`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${MONTHLY_DISTANCE_VIEWBOX} ${MONTHLY_DISTANCE_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="16" y1="10" x2="84" y2="90" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.highlight}"/>
      <stop offset="0.55" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 39) rotate(90) scale(34 38)">
      <stop offset="0" stop-color="${tokens.glow}" stop-opacity="${visualState === 'locked' ? '0.14' : '0.34'}"/>
      <stop offset="0.62" stop-color="${tokens.glow}" stop-opacity="${visualState === 'share-transparent' ? '0.04' : '0.12'}"/>
      <stop offset="1" stop-color="${tokens.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${MONTHLY_DISTANCE_HEXAGON_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="2.35" stroke-linejoin="round" stroke-opacity="${tokens.borderOpacity}"/>
  <ellipse cx="50" cy="41" rx="30" ry="26" fill="url(#${glowId})" opacity="${tokens.ambientOpacity}"/>
  ${tokens.keylineOpacity > 0 ? `<text x="${numberX}" y="39.5" text-anchor="middle" dominant-baseline="middle" font-family="${MONTHLY_DISTANCE_NUMBER_FONT}" font-size="${numberSize}" font-weight="400" stroke="#030405" stroke-width="1.1" stroke-opacity="${tokens.keylineOpacity}" fill="none">${escapeXml(number)}</text>` : ''}
  <text x="${numberX}" y="39.5" text-anchor="middle" dominant-baseline="middle" font-family="${MONTHLY_DISTANCE_NUMBER_FONT}" font-size="${numberSize}" font-weight="400" fill="${tokens.primary}" fill-opacity="${tokens.numberOpacity}">${escapeXml(number)}</text>
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="56.5" text-anchor="middle" font-family="${MONTHLY_DISTANCE_LABEL_FONT}" font-size="7" font-weight="800" letter-spacing="1.3" stroke="#030405" stroke-width="0.5" stroke-opacity="${tokens.keylineOpacity}" fill="none">MONTH</text>` : ''}
  <text x="50" y="56.5" text-anchor="middle" font-family="${MONTHLY_DISTANCE_LABEL_FONT}" font-size="7" font-weight="800" letter-spacing="1.3" fill="${tokens.primary}" fill-opacity="${tokens.labelOpacity}">MONTH</text>
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="67" text-anchor="middle" font-family="${MONTHLY_DISTANCE_LABEL_FONT}" font-size="4.4" font-weight="800" letter-spacing="1.7" stroke="#030405" stroke-width="0.4" stroke-opacity="${tokens.keylineOpacity}" fill="none">STRIDEOS</text>` : ''}
  <text x="50" y="67" text-anchor="middle" font-family="${MONTHLY_DISTANCE_LABEL_FONT}" font-size="4.4" font-weight="800" letter-spacing="1.7" fill="${tokens.primary}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M42.6 75.5 L50 80.3 L57.4 75.5" fill="none" stroke="${tokens.primary}" stroke-width="1.22" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M43.1 81 L50 85.4 L56.9 81" fill="none" stroke="${tokens.highlight}" stroke-width="1.22" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
</svg>
`;
}
