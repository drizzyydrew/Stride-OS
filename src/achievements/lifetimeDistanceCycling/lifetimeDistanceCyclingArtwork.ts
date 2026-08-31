import type { UnitSystem } from '../../store/settingsStore';
import {
  LIFETIME_DISTANCE_CYCLING_BY_MILESTONE,
  type LifetimeDistanceCyclingBadgeState,
  type LifetimeDistanceCyclingDefinition,
  type LifetimeDistanceCyclingMilestone,
} from './lifetimeDistanceCyclingDefinitions';
import {
  LIFETIME_DISTANCE_CYCLING_LOCKED_GRAY,
  LIFETIME_DISTANCE_CYCLING_NEAR_BLACK,
} from './lifetimeDistanceCyclingTokens';
import {
  formatLifetimeCyclingMilestoneNumber,
  lifetimeCyclingAchievementAccessibilityLabel,
  lifetimeCyclingUnitLabel,
} from './lifetimeDistanceCyclingUtils';

export const LIFETIME_DISTANCE_CYCLING_VIEWBOX = 100;
export const LIFETIME_DISTANCE_CYCLING_DIAMOND_PATH =
  'M50 7.5 Q52.4 7.5 54.4 9.6 L90.4 45.6 Q92.5 47.7 92.5 50 Q92.5 52.3 90.4 54.4 L54.4 90.4 Q52.3 92.5 50 92.5 Q47.7 92.5 45.6 90.4 L9.6 54.4 Q7.5 52.3 7.5 50 Q7.5 47.7 9.6 45.6 L45.6 9.6 Q47.7 7.5 50 7.5 Z';
export const LIFETIME_DISTANCE_CYCLING_NUMBER_FONT = "Didot, 'Bodoni 72', Georgia, serif";
export const LIFETIME_DISTANCE_CYCLING_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";

export type LifetimeDistanceCyclingRenderTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
  fill: string;
  fillOpacity: number;
  borderOpacity: number;
  ambientOpacity: number;
  numberOpacity: number;
  unitOpacity: number;
  wordmarkOpacity: number;
  chevronOpacity: number;
  keylineOpacity: number;
};

export function lifetimeDistanceCyclingBadgeTokens(
  definition: LifetimeDistanceCyclingDefinition,
  state: LifetimeDistanceCyclingBadgeState,
): LifetimeDistanceCyclingRenderTokens {
  const locked = state === 'locked';
  const transparent = state === 'share-transparent';
  const colors = locked
    ? {
        primary: LIFETIME_DISTANCE_CYCLING_LOCKED_GRAY,
        highlight: '#C8C8C4',
        shadow: '#4E504E',
        glow: '#7B7D7A',
      }
    : definition.colors;

  return {
    ...colors,
    fill: transparent ? 'transparent' : LIFETIME_DISTANCE_CYCLING_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    ambientOpacity: locked ? 0.08 : transparent ? 0 : 0.22,
    numberOpacity: locked ? 0.54 : 1,
    unitOpacity: locked ? 0.42 : 0.95,
    wordmarkOpacity: locked ? 0.32 : 0.84,
    chevronOpacity: locked ? 0.30 : 0.9,
    keylineOpacity: transparent ? 0.72 : 0,
  };
}

export function lifetimeDistanceCyclingNumberFontSize(text: string, compact = false): number {
  const base = text.length >= 6 ? 12 : text.length >= 5 ? 15 : text.length >= 4 ? 18 : text.length >= 3 ? 21 : text.length >= 2 ? 24 : 26;
  return compact ? Math.max(12, base - 2) : base;
}

export function lifetimeDistanceCyclingNumberX(text: string): number {
  if (text.includes(',')) return 49.2;
  if (/^\d{3,}$/.test(text)) return text.startsWith('1') ? 48.4 : 48.8;
  if (text.startsWith('1') && text.length >= 3) return 48.4;
  return 50;
}

export const LIFETIME_DISTANCE_CYCLING_NUMBER_Y = 44;

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderLifetimeDistanceCyclingBadgeSvg(
  milestone: LifetimeDistanceCyclingMilestone,
  state: LifetimeDistanceCyclingBadgeState = 'unlocked',
  options: { unitSystem?: UnitSystem; compact?: boolean; size?: number; remainingMeters?: number } = {},
): string {
  const definition = LIFETIME_DISTANCE_CYCLING_BY_MILESTONE[milestone];
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const unitSystem = options.unitSystem ?? 'imperial';
  const compact = options.compact ?? false;
  const size = options.size ?? LIFETIME_DISTANCE_CYCLING_VIEWBOX;
  const tokens = lifetimeDistanceCyclingBadgeTokens(definition, visualState);
  const number = formatLifetimeCyclingMilestoneNumber(definition.thresholdMiles, unitSystem);
  const unit = lifetimeCyclingUnitLabel(unitSystem);
  const numberSize = lifetimeDistanceCyclingNumberFontSize(number, compact);
  const numberX = lifetimeDistanceCyclingNumberX(number);
  const stateForLabel = visualState === 'locked' ? 'locked' : 'earned';
  const label = lifetimeCyclingAchievementAccessibilityLabel(definition, stateForLabel, unitSystem, options.remainingMeters ?? 0);
  const edgeId = `lifetime-cycle-${definition.slug}-${visualState}-${unit}-edge`;
  const glowId = `lifetime-cycle-${definition.slug}-${visualState}-${unit}-glow`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${LIFETIME_DISTANCE_CYCLING_VIEWBOX} ${LIFETIME_DISTANCE_CYCLING_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="17" y1="14" x2="84" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.highlight}"/>
      <stop offset="0.52" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 42) rotate(90) scale(32 35)">
      <stop offset="0" stop-color="${tokens.glow}" stop-opacity="${visualState === 'locked' ? '0.18' : '0.38'}"/>
      <stop offset="0.55" stop-color="${tokens.glow}" stop-opacity="${visualState === 'share-transparent' ? '0.05' : '0.13'}"/>
      <stop offset="1" stop-color="${tokens.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${LIFETIME_DISTANCE_CYCLING_DIAMOND_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="2.2" stroke-linejoin="round" stroke-opacity="${tokens.borderOpacity}"/>
  <ellipse cx="50" cy="43" rx="30" ry="25" fill="url(#${glowId})" opacity="${tokens.ambientOpacity}"/>
  ${tokens.keylineOpacity > 0 ? `<text x="${numberX}" y="${LIFETIME_DISTANCE_CYCLING_NUMBER_Y}" text-anchor="middle" dominant-baseline="middle" font-family="${LIFETIME_DISTANCE_CYCLING_NUMBER_FONT}" font-size="${numberSize}" font-weight="400" stroke="#030405" stroke-width="1.1" stroke-opacity="${tokens.keylineOpacity}" fill="none">${escapeXml(number)}</text>` : ''}
  <text x="${numberX}" y="${LIFETIME_DISTANCE_CYCLING_NUMBER_Y}" text-anchor="middle" dominant-baseline="middle" font-family="${LIFETIME_DISTANCE_CYCLING_NUMBER_FONT}" font-size="${numberSize}" font-weight="400" fill="${tokens.primary}" fill-opacity="${tokens.numberOpacity}">${escapeXml(number)}</text>
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="58.5" text-anchor="middle" font-family="${LIFETIME_DISTANCE_CYCLING_LABEL_FONT}" font-size="7.4" font-weight="800" letter-spacing="1.4" stroke="#030405" stroke-width="0.5" stroke-opacity="${tokens.keylineOpacity}" fill="none">${unit}</text>` : ''}
  <text x="50" y="58.5" text-anchor="middle" font-family="${LIFETIME_DISTANCE_CYCLING_LABEL_FONT}" font-size="7.4" font-weight="800" letter-spacing="1.4" fill="${tokens.primary}" fill-opacity="${tokens.unitOpacity}">${unit}</text>
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="68.5" text-anchor="middle" font-family="${LIFETIME_DISTANCE_CYCLING_LABEL_FONT}" font-size="4.4" font-weight="800" letter-spacing="1.7" stroke="#030405" stroke-width="0.4" stroke-opacity="${tokens.keylineOpacity}" fill="none">STRIDEOS</text>` : ''}
  <text x="50" y="68.5" text-anchor="middle" font-family="${LIFETIME_DISTANCE_CYCLING_LABEL_FONT}" font-size="4.4" font-weight="800" letter-spacing="1.7" fill="${tokens.primary}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M42.5 76.8 L50 81.9 L57.5 76.8" fill="none" stroke="${tokens.primary}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M43 82.7 L50 87.2 L57 82.7" fill="none" stroke="${tokens.highlight}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
</svg>
`;
}
