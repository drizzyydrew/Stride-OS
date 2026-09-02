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
  monthlyDistance25K: { primary: '#9DE67B', highlight: '#CDF6A3', shadow: '#4F7943', glow: '#7BCC5D' },
  monthlyDistance50K: { primary: '#31D8D4', highlight: '#92F6F2', shadow: '#087A7D', glow: '#18B9B5' },
  monthlyDistance100K: { primary: '#78B7F6', highlight: '#B8DFFF', shadow: '#265D9F', glow: '#4A96DD' },
  monthlyDistance150K: { primary: '#8A70FF', highlight: '#C4B3FF', shadow: '#43328E', glow: '#775CDE' },
  monthlyDistance200K: { primary: '#D861EA', highlight: '#F2BBFF', shadow: '#7A2D86', glow: '#BC40D2' },
  monthlyDistance250K: { primary: '#FF674B', highlight: '#FFC0A8', shadow: '#A52C1B', glow: '#E64E34' },
  monthlyDistance300K: { primary: '#F5A42D', highlight: '#FFD38A', shadow: '#9B5A10', glow: '#D98119' },
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
