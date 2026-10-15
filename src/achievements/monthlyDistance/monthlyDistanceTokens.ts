import { APPROVED_PALETTE } from "./approvedPalette";

export type MonthlyDistanceTierTokenName =
  | 'monthlyDistance25K'
  | 'monthlyDistance50K'
  | 'monthlyDistance100K'
  | 'monthlyDistance150K'
  | 'monthlyDistance200K'
  | 'monthlyDistance250K'
  | 'monthlyDistance300K';

export type MonthlyDistanceColorTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
};

export const MONTHLY_DISTANCE_NEAR_BLACK = '#050607';
export const MONTHLY_DISTANCE_LOCKED_GRAY = '#8C8C8A';

export const MONTHLY_DISTANCE_TIER_COLORS: Record<MonthlyDistanceTierTokenName, MonthlyDistanceColorTokens> = {
  monthlyDistance25K: { primary: APPROVED_PALETTE["monthly_run_25k"].primary, highlight: APPROVED_PALETTE["monthly_run_25k"].highlight, shadow: APPROVED_PALETTE["monthly_run_25k"].shadow, glow: APPROVED_PALETTE["monthly_run_25k"].primary },
  monthlyDistance50K: { primary: APPROVED_PALETTE["monthly_run_50k"].primary, highlight: APPROVED_PALETTE["monthly_run_50k"].highlight, shadow: APPROVED_PALETTE["monthly_run_50k"].shadow, glow: APPROVED_PALETTE["monthly_run_50k"].primary },
  monthlyDistance100K: { primary: APPROVED_PALETTE["monthly_run_100k"].primary, highlight: APPROVED_PALETTE["monthly_run_100k"].highlight, shadow: APPROVED_PALETTE["monthly_run_100k"].shadow, glow: APPROVED_PALETTE["monthly_run_100k"].primary },
  monthlyDistance150K: { primary: APPROVED_PALETTE["monthly_run_150k"].primary, highlight: APPROVED_PALETTE["monthly_run_150k"].highlight, shadow: APPROVED_PALETTE["monthly_run_150k"].shadow, glow: APPROVED_PALETTE["monthly_run_150k"].primary },
  monthlyDistance200K: { primary: APPROVED_PALETTE["monthly_run_200k"].primary, highlight: APPROVED_PALETTE["monthly_run_200k"].highlight, shadow: APPROVED_PALETTE["monthly_run_200k"].shadow, glow: APPROVED_PALETTE["monthly_run_200k"].primary },
  monthlyDistance250K: { primary: APPROVED_PALETTE["monthly_run_250k"].primary, highlight: APPROVED_PALETTE["monthly_run_250k"].highlight, shadow: APPROVED_PALETTE["monthly_run_250k"].shadow, glow: APPROVED_PALETTE["monthly_run_250k"].primary },
  monthlyDistance300K: { primary: APPROVED_PALETTE["monthly_run_300k"].primary, highlight: APPROVED_PALETTE["monthly_run_300k"].highlight, shadow: APPROVED_PALETTE["monthly_run_300k"].shadow, glow: APPROVED_PALETTE["monthly_run_300k"].primary },
};

export const MONTHLY_DISTANCE_TIER_NAMES: MonthlyDistanceTierTokenName[] = [
  'monthlyDistance25K',
  'monthlyDistance50K',
  'monthlyDistance100K',
  'monthlyDistance150K',
  'monthlyDistance200K',
  'monthlyDistance250K',
  'monthlyDistance300K',
];
