import { APPROVED_PALETTE } from "./approvedPalette";

export type LifetimeDistanceCyclingTierTokenName =
  | 'lifetimeCyclingTier10'
  | 'lifetimeCyclingTier50'
  | 'lifetimeCyclingTier100'
  | 'lifetimeCyclingTier250'
  | 'lifetimeCyclingTier500'
  | 'lifetimeCyclingTier1000'
  | 'lifetimeCyclingTier2500'
  | 'lifetimeCyclingTier5000'
  | 'lifetimeCyclingTier10000';

export type LifetimeDistanceCyclingColorTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
};

export const LIFETIME_DISTANCE_CYCLING_NEAR_BLACK = '#050607';
export const LIFETIME_DISTANCE_CYCLING_PANEL_BLACK = '#090B0D';
export const LIFETIME_DISTANCE_CYCLING_LOCKED_GRAY = '#8C8C8A';

export const LIFETIME_DISTANCE_CYCLING_TIER_COLORS: Record<LifetimeDistanceCyclingTierTokenName, LifetimeDistanceCyclingColorTokens> = {
  lifetimeCyclingTier10: { primary: APPROVED_PALETTE["lifetime_cycle_10_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_10_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_10_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_10_mi:imperial"].primary },
  lifetimeCyclingTier50: { primary: APPROVED_PALETTE["lifetime_cycle_50_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_50_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_50_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_50_mi:imperial"].primary },
  lifetimeCyclingTier100: { primary: APPROVED_PALETTE["lifetime_cycle_100_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_100_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_100_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_100_mi:imperial"].primary },
  lifetimeCyclingTier250: { primary: APPROVED_PALETTE["lifetime_cycle_250_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_250_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_250_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_250_mi:imperial"].primary },
  lifetimeCyclingTier500: { primary: APPROVED_PALETTE["lifetime_cycle_500_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_500_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_500_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_500_mi:imperial"].primary },
  lifetimeCyclingTier1000: { primary: APPROVED_PALETTE["lifetime_cycle_1000_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_1000_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_1000_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_1000_mi:imperial"].primary },
  lifetimeCyclingTier2500: { primary: APPROVED_PALETTE["lifetime_cycle_2500_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_2500_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_2500_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_2500_mi:imperial"].primary },
  lifetimeCyclingTier5000: { primary: APPROVED_PALETTE["lifetime_cycle_5000_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_5000_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_5000_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_5000_mi:imperial"].primary },
  lifetimeCyclingTier10000: { primary: APPROVED_PALETTE["lifetime_cycle_10000_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_cycle_10000_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_cycle_10000_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_cycle_10000_mi:imperial"].primary },
};

export const LIFETIME_DISTANCE_CYCLING_TIER_NAMES: LifetimeDistanceCyclingTierTokenName[] = [
  'lifetimeCyclingTier10',
  'lifetimeCyclingTier50',
  'lifetimeCyclingTier100',
  'lifetimeCyclingTier250',
  'lifetimeCyclingTier500',
  'lifetimeCyclingTier1000',
  'lifetimeCyclingTier2500',
  'lifetimeCyclingTier5000',
  'lifetimeCyclingTier10000',
];
