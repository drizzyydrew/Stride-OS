export type LifetimeDistanceRunningTierTokenName =
  | 'lifetimeRunTier1'
  | 'lifetimeRunTier2'
  | 'lifetimeRunTier3'
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
  lifetimeRunTier1: { primary: '#9DE67B', highlight: '#C5F6A3', shadow: '#4F7943', glow: '#7BCC5D' },
  lifetimeRunTier2: { primary: '#24D8D0', highlight: '#8EF7F1', shadow: '#087A7B', glow: '#14B6B3' },
  lifetimeRunTier3: { primary: '#33B7F0', highlight: '#91DBFF', shadow: '#0E5D8B', glow: '#168BC9' },
  lifetimeRunTier4: { primary: '#FF5E59', highlight: '#FFB0A9', shadow: '#9D241F', glow: '#E7463E' },
  lifetimeRunTier5: { primary: '#65CEF2', highlight: '#B5EEFF', shadow: '#287799', glow: '#3EADD4' },
  lifetimeRunTier6: { primary: '#766DFF', highlight: '#BAB5FF', shadow: '#34328C', glow: '#6156DD' },
  lifetimeRunTier7: { primary: '#CB51F3', highlight: '#ECB5FF', shadow: '#732392', glow: '#AA32D2' },
  lifetimeRunTier8: { primary: '#FF6A42', highlight: '#FFB097', shadow: '#9A2D16', glow: '#E84E2D' },
  lifetimeRunTier9: { primary: '#F3C33D', highlight: '#FFE68C', shadow: '#9B6815', glow: '#DFA720' },
};

export const LIFETIME_DISTANCE_RUNNING_TIER_NAMES: LifetimeDistanceRunningTierTokenName[] = [
  'lifetimeRunTier1',
  'lifetimeRunTier2',
  'lifetimeRunTier3',
  'lifetimeRunTier4',
  'lifetimeRunTier5',
  'lifetimeRunTier6',
  'lifetimeRunTier7',
  'lifetimeRunTier8',
  'lifetimeRunTier9',
];
