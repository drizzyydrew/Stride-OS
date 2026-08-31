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
  lifetimeCyclingTier10: { primary: '#9DE96F', highlight: '#C8F99B', shadow: '#4B7D32', glow: '#7FCC48' },
  lifetimeCyclingTier50: { primary: '#2DD7D0', highlight: '#90F6EF', shadow: '#08787B', glow: '#15B8B1' },
  lifetimeCyclingTier100: { primary: '#44B8F4', highlight: '#9BDEFF', shadow: '#0E5E93', glow: '#1C8FCE' },
  lifetimeCyclingTier250: { primary: '#CB5AF0', highlight: '#F0B8FF', shadow: '#73308D', glow: '#B13AD7' },
  lifetimeCyclingTier500: { primary: '#F29A2B', highlight: '#FFD08A', shadow: '#9A5711', glow: '#D77D1A' },
  lifetimeCyclingTier1000: { primary: '#24D8D0', highlight: '#92F7F1', shadow: '#087A7B', glow: '#15B8B3' },
  lifetimeCyclingTier2500: { primary: '#766DFF', highlight: '#BAB6FF', shadow: '#34328C', glow: '#6156DD' },
  lifetimeCyclingTier5000: { primary: '#D651F2', highlight: '#F0B5FF', shadow: '#7A2392', glow: '#B934D2' },
  lifetimeCyclingTier10000: { primary: '#FF6B2C', highlight: '#FFC197', shadow: '#A33812', glow: '#E3521D' },
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
