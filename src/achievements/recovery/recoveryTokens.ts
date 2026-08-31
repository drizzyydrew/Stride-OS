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
  primary: '#9FBF8D',
  secondary: '#7FB5AE',
  highlight: '#D5E7C4',
  shadow: '#516F5D',
  glow: '#7DAE86',
  text: '#BFD6AE',
};

export const RECOVERY_LOCKED_COLORS: RecoveryColorTokens = {
  primary: RECOVERY_LOCKED_GRAY,
  secondary: '#62625E',
  highlight: '#CACAC4',
  shadow: '#444541',
  glow: '#767670',
  text: '#A9A9A3',
};
