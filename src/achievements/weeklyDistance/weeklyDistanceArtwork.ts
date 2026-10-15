import { APPROVED_ARTWORK } from './approvedArtwork';
import { renderApprovedVector } from '../shared/approvedVector';
import {
  WEEKLY_DISTANCE_BY_KM,
  normalizeWeeklyDistanceBadgeState,
  type WeeklyDistanceBadgeInputState,
  type WeeklyDistanceBadgeState,
  type WeeklyDistanceDefinition,
  type WeeklyDistanceMilestoneKm,
} from './weeklyDistanceDefinitions';
import {
  WEEKLY_DISTANCE_LOCKED_GRAY,
  WEEKLY_DISTANCE_NEAR_BLACK,
} from './weeklyDistanceTokens';
import {
  formatWeeklyDistanceBadgeText,
  weeklyDistanceAchievementAccessibilityLabel,
} from './weeklyDistanceUtils';

export type { WeeklyDistanceBadgeInputState, WeeklyDistanceBadgeState } from './weeklyDistanceDefinitions';

export const WEEKLY_DISTANCE_VIEWBOX = 100;
export const WEEKLY_DISTANCE_HEXAGON_PATH =
  'M50 7.5 Q52.3 7.5 54.4 8.7 L82.9 25.1 Q85.2 26.4 85.2 29.1 L85.2 70.9 Q85.2 73.6 82.9 74.9 L54.4 91.3 Q52.3 92.5 50 92.5 Q47.7 92.5 45.6 91.3 L17.1 74.9 Q14.8 73.6 14.8 70.9 L14.8 29.1 Q14.8 26.4 17.1 25.1 L45.6 8.7 Q47.7 7.5 50 7.5 Z';
export const WEEKLY_DISTANCE_NUMBER_FONT = "Didot, 'Bodoni 72', Georgia, serif";
export const WEEKLY_DISTANCE_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";

export type WeeklyDistanceRenderTokens = {
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

export function weeklyDistanceBadgeTokens(
  definition: WeeklyDistanceDefinition,
  state: WeeklyDistanceBadgeState,
): WeeklyDistanceRenderTokens {
  const locked = state === 'locked';
  const transparent = state === 'transparent';
  const colors = locked
    ? {
        primary: WEEKLY_DISTANCE_LOCKED_GRAY,
        highlight: '#C8C8C4',
        shadow: '#4E504E',
        glow: '#777A78',
      }
    : definition.colors;

  return {
    ...colors,
    fill: transparent ? 'transparent' : WEEKLY_DISTANCE_NEAR_BLACK,
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

export function weeklyDistanceNumberFontSize(text: string, compact = false): number {
  const base = text.length >= 4 ? 23 : text.length >= 3 ? 26 : 29;
  return compact ? Math.max(20, base - 2) : base;
}

export function weeklyDistanceNumberX(text: string): number {
  if (text.startsWith('1') && text.length >= 3) return 48.9;
  return 50;
}

export function renderWeeklyDistanceBadgeSvg(
  milestoneKm: WeeklyDistanceMilestoneKm,
  state: WeeklyDistanceBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number; remainingMeters?: number; unitSystem?: 'metric' | 'imperial' } = {},
): string {
  const definition = WEEKLY_DISTANCE_BY_KM[milestoneKm];
  const visualState = normalizeWeeklyDistanceBadgeState(state);
  return renderApprovedVector(APPROVED_ARTWORK[definition.id], visualState, {
    ...options,
    label: weeklyDistanceAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', options.unitSystem ?? 'metric', options.remainingMeters),
    namespace: `weekly-${definition.slug}-${visualState}`,
  });
}
