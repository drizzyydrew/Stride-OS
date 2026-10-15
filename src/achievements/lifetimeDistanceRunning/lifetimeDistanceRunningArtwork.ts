import { APPROVED_ARTWORK } from './approvedArtwork';
import { renderApprovedVector } from '../shared/approvedVector';
import type { UnitSystem } from '../../store/settingsStore';
import {
  LIFETIME_DISTANCE_RUNNING_BY_MILESTONE,
  normalizeLifetimeDistanceRunningBadgeState,
  type LifetimeDistanceRunningBadgeInputState,
  type LifetimeDistanceRunningBadgeState,
  type LifetimeDistanceRunningDefinition,
  type LifetimeDistanceRunningMilestone,
} from './lifetimeDistanceRunningDefinitions';
import {
  LIFETIME_DISTANCE_RUNNING_LOCKED_GRAY,
  LIFETIME_DISTANCE_RUNNING_NEAR_BLACK,
} from './lifetimeDistanceRunningTokens';
import {
  formatLifetimeRunningMilestoneNumber,
  lifetimeRunningAchievementAccessibilityLabel,
  lifetimeRunningUnitLabel,
} from './lifetimeDistanceRunningUtils';

export const LIFETIME_DISTANCE_RUNNING_VIEWBOX = 100;
export const LIFETIME_DISTANCE_RUNNING_DIAMOND_PATH =
  'M50 7.5 Q52.4 7.5 54.4 9.6 L90.4 45.6 Q92.5 47.7 92.5 50 Q92.5 52.3 90.4 54.4 L54.4 90.4 Q52.3 92.5 50 92.5 Q47.7 92.5 45.6 90.4 L9.6 54.4 Q7.5 52.3 7.5 50 Q7.5 47.7 9.6 45.6 L45.6 9.6 Q47.7 7.5 50 7.5 Z';
export const LIFETIME_DISTANCE_RUNNING_NUMBER_FONT = "Didot, 'Bodoni 72', Georgia, serif";
export const LIFETIME_DISTANCE_RUNNING_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";

export type LifetimeDistanceRunningRenderTokens = {
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

export function lifetimeDistanceRunningBadgeTokens(
  definition: LifetimeDistanceRunningDefinition,
  state: LifetimeDistanceRunningBadgeState,
): LifetimeDistanceRunningRenderTokens {
  const locked = state === 'locked';
  const transparent = state === 'transparent';
  const colors = locked
    ? {
        primary: LIFETIME_DISTANCE_RUNNING_LOCKED_GRAY,
        highlight: '#C8C8C4',
        shadow: '#4E504E',
        glow: '#7B7D7A',
      }
    : definition.colors;

  return {
    ...colors,
    fill: transparent ? 'transparent' : LIFETIME_DISTANCE_RUNNING_NEAR_BLACK,
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

export function lifetimeDistanceRunningNumberFontSize(text: string, compact = false): number {
  const base = text.length >= 6 ? 12 : text.length >= 5 ? 15 : text.length >= 4 ? 18 : text.length >= 3 ? 21 : text.length >= 2 ? 24 : 26;
  return compact ? Math.max(12, base - 2) : base;
}

const LIFETIME_DISTANCE_RUNNING_NUMBER_X_OVERRIDES: Record<string, number> = {
  '1': 44,
  '5': 48,
  '10': 47.3,
  '50': 48.3,
};

export function lifetimeDistanceRunningNumberX(text: string): number {
  const override = LIFETIME_DISTANCE_RUNNING_NUMBER_X_OVERRIDES[text];
  if (override !== undefined) return override;
  if (text.includes(',')) return 49.2;
  if (/^\d{3,}$/.test(text)) return text.startsWith('1') ? 48.4 : 48.8;
  if (text.startsWith('1') && text.length >= 3) return 48.4;
  return 50;
}

export const LIFETIME_DISTANCE_RUNNING_NUMBER_Y = 44;

export function renderLifetimeDistanceRunningBadgeSvg(
  milestone: LifetimeDistanceRunningMilestone,
  state: LifetimeDistanceRunningBadgeInputState = 'unlocked',
  options: { unitSystem?: UnitSystem; compact?: boolean; size?: number; remainingMeters?: number } = {},
): string {
  const definition = LIFETIME_DISTANCE_RUNNING_BY_MILESTONE[milestone];
  const units = options.unitSystem ?? 'imperial';
  const visualState = normalizeLifetimeDistanceRunningBadgeState(state);
  return renderApprovedVector(APPROVED_ARTWORK[`${definition.id}:${units}`], visualState, {
    ...options,
    label: lifetimeRunningAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', units, options.remainingMeters),
    namespace: `lifetime-running-${definition.slug}-${units}-${visualState}`,
  });
}
