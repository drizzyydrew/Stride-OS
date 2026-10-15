import { APPROVED_PALETTE } from "./approvedPalette";

export type WeeklyDistanceTierTokenName =
  | 'weeklyDistance5K'
  | 'weeklyDistance10K'
  | 'weeklyDistance15K'
  | 'weeklyDistance25K'
  | 'weeklyDistance30K'
  | 'weeklyDistance50K'
  | 'weeklyDistance75K'
  | 'weeklyDistance100K';

export type WeeklyDistanceColorTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
};

export const WEEKLY_DISTANCE_NEAR_BLACK = '#050607';
export const WEEKLY_DISTANCE_LOCKED_GRAY = '#8C8C8A';

export const WEEKLY_DISTANCE_TIER_COLORS: Record<WeeklyDistanceTierTokenName, WeeklyDistanceColorTokens> = {
  weeklyDistance5K: { primary: APPROVED_PALETTE["weekly_5k"].primary, highlight: APPROVED_PALETTE["weekly_5k"].highlight, shadow: APPROVED_PALETTE["weekly_5k"].shadow, glow: APPROVED_PALETTE["weekly_5k"].primary },
  weeklyDistance10K: { primary: APPROVED_PALETTE["weekly_10k"].primary, highlight: APPROVED_PALETTE["weekly_10k"].highlight, shadow: APPROVED_PALETTE["weekly_10k"].shadow, glow: APPROVED_PALETTE["weekly_10k"].primary },
  weeklyDistance15K: { primary: APPROVED_PALETTE["weekly_15k"].primary, highlight: APPROVED_PALETTE["weekly_15k"].highlight, shadow: APPROVED_PALETTE["weekly_15k"].shadow, glow: APPROVED_PALETTE["weekly_15k"].primary },
  weeklyDistance25K: { primary: APPROVED_PALETTE["weekly_25k"].primary, highlight: APPROVED_PALETTE["weekly_25k"].highlight, shadow: APPROVED_PALETTE["weekly_25k"].shadow, glow: APPROVED_PALETTE["weekly_25k"].primary },
  weeklyDistance30K: { primary: APPROVED_PALETTE["weekly_30k"].primary, highlight: APPROVED_PALETTE["weekly_30k"].highlight, shadow: APPROVED_PALETTE["weekly_30k"].shadow, glow: APPROVED_PALETTE["weekly_30k"].primary },
  weeklyDistance50K: { primary: APPROVED_PALETTE["weekly_50k"].primary, highlight: APPROVED_PALETTE["weekly_50k"].highlight, shadow: APPROVED_PALETTE["weekly_50k"].shadow, glow: APPROVED_PALETTE["weekly_50k"].primary },
  weeklyDistance75K: { primary: APPROVED_PALETTE["weekly_75k"].primary, highlight: APPROVED_PALETTE["weekly_75k"].highlight, shadow: APPROVED_PALETTE["weekly_75k"].shadow, glow: APPROVED_PALETTE["weekly_75k"].primary },
  weeklyDistance100K: { primary: APPROVED_PALETTE["weekly_100k"].primary, highlight: APPROVED_PALETTE["weekly_100k"].highlight, shadow: APPROVED_PALETTE["weekly_100k"].shadow, glow: APPROVED_PALETTE["weekly_100k"].primary },
};

export const WEEKLY_DISTANCE_TIER_NAMES: WeeklyDistanceTierTokenName[] = [
  'weeklyDistance5K',
  'weeklyDistance10K',
  'weeklyDistance15K',
  'weeklyDistance25K',
  'weeklyDistance30K',
  'weeklyDistance50K',
  'weeklyDistance75K',
  'weeklyDistance100K',
];
