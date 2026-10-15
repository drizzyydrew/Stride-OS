import { APPROVED_PALETTE } from "./approvedPalette";

export type LifetimeDistanceRunningTierTokenName =
  | 'lifetimeRunTier1'
  | 'lifetimeRunTier2'
  | 'lifetimeRunTier3'
  | 'lifetimeRunTierMarathon'
  | 'lifetimeRunTier4'
  | 'lifetimeRunTier5'
  | 'lifetimeRunTier6'
  | 'lifetimeRunTier7'
  | 'lifetimeRunTier8'
  | 'lifetimeRunTier9';

export type LifetimeDistanceRunningColorTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
};

export const LIFETIME_DISTANCE_RUNNING_NEAR_BLACK = '#050607';
export const LIFETIME_DISTANCE_RUNNING_PANEL_BLACK = '#090B0D';
export const LIFETIME_DISTANCE_RUNNING_LOCKED_GRAY = '#8C8C8A';

export const LIFETIME_DISTANCE_RUNNING_TIER_COLORS: Record<LifetimeDistanceRunningTierTokenName, LifetimeDistanceRunningColorTokens> = {
  lifetimeRunTier1: { primary: APPROVED_PALETTE["lifetime_run_1_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_1_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_1_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_1_mi:imperial"].primary },
  lifetimeRunTier2: { primary: APPROVED_PALETTE["lifetime_run_5_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_5_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_5_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_5_mi:imperial"].primary },
  lifetimeRunTier3: { primary: APPROVED_PALETTE["lifetime_run_10_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_10_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_10_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_10_mi:imperial"].primary },
  lifetimeRunTierMarathon: { primary: APPROVED_PALETTE["lifetime_run_26_2_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_26_2_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_26_2_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_26_2_mi:imperial"].primary },
  lifetimeRunTier4: { primary: APPROVED_PALETTE["lifetime_run_50_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_50_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_50_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_50_mi:imperial"].primary },
  lifetimeRunTier5: { primary: APPROVED_PALETTE["lifetime_run_100_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_100_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_100_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_100_mi:imperial"].primary },
  lifetimeRunTier6: { primary: APPROVED_PALETTE["lifetime_run_250_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_250_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_250_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_250_mi:imperial"].primary },
  lifetimeRunTier7: { primary: APPROVED_PALETTE["lifetime_run_500_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_500_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_500_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_500_mi:imperial"].primary },
  lifetimeRunTier8: { primary: APPROVED_PALETTE["lifetime_run_1000_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_1000_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_1000_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_1000_mi:imperial"].primary },
  lifetimeRunTier9: { primary: APPROVED_PALETTE["lifetime_run_10000_mi:imperial"].primary, highlight: APPROVED_PALETTE["lifetime_run_10000_mi:imperial"].highlight, shadow: APPROVED_PALETTE["lifetime_run_10000_mi:imperial"].shadow, glow: APPROVED_PALETTE["lifetime_run_10000_mi:imperial"].primary },
};

export const LIFETIME_DISTANCE_RUNNING_TIER_NAMES: LifetimeDistanceRunningTierTokenName[] = [
  'lifetimeRunTier1',
  'lifetimeRunTier2',
  'lifetimeRunTier3',
  'lifetimeRunTierMarathon',
  'lifetimeRunTier4',
  'lifetimeRunTier5',
  'lifetimeRunTier6',
  'lifetimeRunTier7',
  'lifetimeRunTier8',
  'lifetimeRunTier9',
];
