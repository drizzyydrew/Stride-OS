import { APPROVED_PALETTE } from "./approvedPalette";

export type RecoveryColorTokens = {
  primary: string;
  secondary: string;
  highlight: string;
  shadow: string;
  glow: string;
  text: string;
};

export const RECOVERY_NEAR_BLACK = '#090A09';
export const RECOVERY_PANEL_BLACK = '#050606';
export const RECOVERY_LOCKED_GRAY = '#8E8E88';

export const RECOVERY_COLORS: RecoveryColorTokens = {
  primary: APPROVED_PALETTE["recovery_week_completed"].primary,
  secondary: APPROVED_PALETTE["recovery_week_completed"].primary,
  highlight: APPROVED_PALETTE["recovery_week_completed"].highlight,
  shadow: APPROVED_PALETTE["recovery_week_completed"].shadow,
  glow: APPROVED_PALETTE["recovery_week_completed"].primary,
  text: APPROVED_PALETTE["recovery_week_completed"].text,
};

export const RECOVERY_LOCKED_COLORS: RecoveryColorTokens = {
  primary: RECOVERY_LOCKED_GRAY,
  secondary: '#62625E',
  highlight: '#CACAC4',
  shadow: '#444541',
  glow: '#767670',
  text: '#A9A9A3',
};
