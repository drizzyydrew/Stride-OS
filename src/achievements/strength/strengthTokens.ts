import { APPROVED_PALETTE } from "./approvedPalette";

export type StrengthColorTokens = {
  primary: string;
  secondary: string;
  highlight: string;
  shadow: string;
  glow: string;
  text: string;
};

export const STRENGTH_NEAR_BLACK = '#090A09';
export const STRENGTH_PANEL_BLACK = '#050606';
export const STRENGTH_LOCKED_GRAY = '#8E8E88';

export const STRENGTH_COLORS: StrengthColorTokens = {
  primary: APPROVED_PALETTE["first_strength_session"].primary,
  secondary: APPROVED_PALETTE["first_strength_session"].primary,
  highlight: APPROVED_PALETTE["first_strength_session"].highlight,
  shadow: APPROVED_PALETTE["first_strength_session"].shadow,
  glow: APPROVED_PALETTE["first_strength_session"].primary,
  text: APPROVED_PALETTE["first_strength_session"].text,
};

export const STRENGTH_LOCKED_COLORS: StrengthColorTokens = {
  primary: STRENGTH_LOCKED_GRAY,
  secondary: '#62625E',
  highlight: '#CACAC4',
  shadow: '#444541',
  glow: '#767670',
  text: '#A9A9A3',
};
