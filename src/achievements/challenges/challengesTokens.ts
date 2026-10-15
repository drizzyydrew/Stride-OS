import { APPROVED_PALETTE } from "./approvedPalette";

export type ChallengeColorTokens = {
  primary: string;
  secondary: string;
  highlight: string;
  shadow: string;
  glow: string;
  text: string;
};

export const CHALLENGES_NEAR_BLACK = '#090A09';
export const CHALLENGES_PANEL_BLACK = '#050606';
export const CHALLENGES_LOCKED_GRAY = '#8E8E88';

export type ChallengeColorTokenName =
  | 'challengeAugust'
  | 'challengeSeptember'
  | 'challengeWinter'
  | 'challengeSpring'
  | 'challengeSummer'
  | 'challengeElevation'
  | 'challenge5kMonth'
  | 'challenge25kWeek'
  | 'challenge50kMonth'
  | 'challenge100kMonth'
  | 'challenge150kMonth'
  | 'challenge200kMonth'
  | 'challengeStrengthRun'
  | 'challengeRecovery';

export const CHALLENGES_COLORS: Record<ChallengeColorTokenName, ChallengeColorTokens> = {
  challenge5kMonth: {"primary":"#D664A8","secondary":"#B3457F","highlight":"#F0A9D4","shadow":"#6E2650","glow":"#C4528E","text":"#F0C1DF"},
  challengeAugust: { primary: APPROVED_PALETTE["challenge_august_base_builder"].primary, secondary: APPROVED_PALETTE["challenge_august_base_builder"].primary, highlight: APPROVED_PALETTE["challenge_august_base_builder"].highlight, shadow: APPROVED_PALETTE["challenge_august_base_builder"].shadow, glow: APPROVED_PALETTE["challenge_august_base_builder"].primary, text: APPROVED_PALETTE["challenge_august_base_builder"].text },
  challengeSeptember: { primary: APPROVED_PALETTE["challenge_september_consistency"].primary, secondary: APPROVED_PALETTE["challenge_september_consistency"].primary, highlight: APPROVED_PALETTE["challenge_september_consistency"].highlight, shadow: APPROVED_PALETTE["challenge_september_consistency"].shadow, glow: APPROVED_PALETTE["challenge_september_consistency"].primary, text: APPROVED_PALETTE["challenge_september_consistency"].text },
  challengeWinter: { primary: APPROVED_PALETTE["challenge_winter_strength_block"].primary, secondary: APPROVED_PALETTE["challenge_winter_strength_block"].primary, highlight: APPROVED_PALETTE["challenge_winter_strength_block"].highlight, shadow: APPROVED_PALETTE["challenge_winter_strength_block"].shadow, glow: APPROVED_PALETTE["challenge_winter_strength_block"].primary, text: APPROVED_PALETTE["challenge_winter_strength_block"].text },
  challengeSpring: { primary: APPROVED_PALETTE["challenge_spring_mileage_build"].primary, secondary: APPROVED_PALETTE["challenge_spring_mileage_build"].primary, highlight: APPROVED_PALETTE["challenge_spring_mileage_build"].highlight, shadow: APPROVED_PALETTE["challenge_spring_mileage_build"].shadow, glow: APPROVED_PALETTE["challenge_spring_mileage_build"].primary, text: APPROVED_PALETTE["challenge_spring_mileage_build"].text },
  challengeSummer: { primary: APPROVED_PALETTE["challenge_summer_long_run"].primary, secondary: APPROVED_PALETTE["challenge_summer_long_run"].primary, highlight: APPROVED_PALETTE["challenge_summer_long_run"].highlight, shadow: APPROVED_PALETTE["challenge_summer_long_run"].shadow, glow: APPROVED_PALETTE["challenge_summer_long_run"].primary, text: APPROVED_PALETTE["challenge_summer_long_run"].text },
  challengeElevation: { primary: APPROVED_PALETTE["challenge_elevation_month"].primary, secondary: APPROVED_PALETTE["challenge_elevation_month"].primary, highlight: APPROVED_PALETTE["challenge_elevation_month"].highlight, shadow: APPROVED_PALETTE["challenge_elevation_month"].shadow, glow: APPROVED_PALETTE["challenge_elevation_month"].primary, text: APPROVED_PALETTE["challenge_elevation_month"].text },
  challenge25kWeek: { primary: APPROVED_PALETTE["weekly_25k"].primary, secondary: APPROVED_PALETTE["weekly_25k"].primary, highlight: APPROVED_PALETTE["weekly_25k"].highlight, shadow: APPROVED_PALETTE["weekly_25k"].shadow, glow: APPROVED_PALETTE["weekly_25k"].primary, text: APPROVED_PALETTE["weekly_25k"].text },
  challenge50kMonth: { primary: APPROVED_PALETTE["monthly_run_50k"].primary, secondary: APPROVED_PALETTE["monthly_run_50k"].primary, highlight: APPROVED_PALETTE["monthly_run_50k"].highlight, shadow: APPROVED_PALETTE["monthly_run_50k"].shadow, glow: APPROVED_PALETTE["monthly_run_50k"].primary, text: APPROVED_PALETTE["monthly_run_50k"].text },
  challenge100kMonth: { primary: APPROVED_PALETTE["monthly_run_100k"].primary, secondary: APPROVED_PALETTE["monthly_run_100k"].primary, highlight: APPROVED_PALETTE["monthly_run_100k"].highlight, shadow: APPROVED_PALETTE["monthly_run_100k"].shadow, glow: APPROVED_PALETTE["monthly_run_100k"].primary, text: APPROVED_PALETTE["monthly_run_100k"].text },
  challengeStrengthRun: { primary: APPROVED_PALETTE["strength_run_week_completed"].primary, secondary: APPROVED_PALETTE["strength_run_week_completed"].primary, highlight: APPROVED_PALETTE["strength_run_week_completed"].highlight, shadow: APPROVED_PALETTE["strength_run_week_completed"].shadow, glow: APPROVED_PALETTE["strength_run_week_completed"].primary, text: APPROVED_PALETTE["strength_run_week_completed"].text },
  challengeRecovery: { primary: APPROVED_PALETTE["recovery_check_in_streak"].primary, secondary: APPROVED_PALETTE["recovery_check_in_streak"].primary, highlight: APPROVED_PALETTE["recovery_check_in_streak"].highlight, shadow: APPROVED_PALETTE["recovery_check_in_streak"].shadow, glow: APPROVED_PALETTE["recovery_check_in_streak"].primary, text: APPROVED_PALETTE["recovery_check_in_streak"].text },
  challenge150kMonth: { primary: APPROVED_PALETTE["monthly_run_150k"].primary, secondary: APPROVED_PALETTE["monthly_run_150k"].primary, highlight: APPROVED_PALETTE["monthly_run_150k"].highlight, shadow: APPROVED_PALETTE["monthly_run_150k"].shadow, glow: APPROVED_PALETTE["monthly_run_150k"].primary, text: APPROVED_PALETTE["monthly_run_150k"].text },
  challenge200kMonth: { primary: APPROVED_PALETTE["monthly_run_200k"].primary, secondary: APPROVED_PALETTE["monthly_run_200k"].primary, highlight: APPROVED_PALETTE["monthly_run_200k"].highlight, shadow: APPROVED_PALETTE["monthly_run_200k"].shadow, glow: APPROVED_PALETTE["monthly_run_200k"].primary, text: APPROVED_PALETTE["monthly_run_200k"].text },
};

export const CHALLENGES_LOCKED_COLORS: ChallengeColorTokens = {
  primary: CHALLENGES_LOCKED_GRAY,
  secondary: '#62625E',
  highlight: '#CACAC4',
  shadow: '#444541',
  glow: '#767670',
  text: '#A9A9A3',
};
