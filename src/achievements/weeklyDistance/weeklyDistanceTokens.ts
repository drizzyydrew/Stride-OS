export type WeeklyDistanceTierTokenName =
  | 'weeklyDistance10K'
  | 'weeklyDistance15K'
  | 'weeklyDistance25K'
  | 'weeklyDistance50K'
  | 'weeklyDistance75K'
  | 'weeklyDistance100K'
  | 'weeklyDistance150K';

export type WeeklyDistanceColorTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
};

export const WEEKLY_DISTANCE_NEAR_BLACK = '#050607';
export const WEEKLY_DISTANCE_LOCKED_GRAY = '#8C8C8A';

export const WEEKLY_DISTANCE_TIER_COLORS: Record<WeeklyDistanceTierTokenName, WeeklyDistanceColorTokens> = {
  weeklyDistance10K: { primary: '#A4E778', highlight: '#CDF6A3', shadow: '#4E7B34', glow: '#7FCB54' },
  weeklyDistance15K: { primary: '#31D8D4', highlight: '#92F6F2', shadow: '#087A7D', glow: '#18B9B5' },
  weeklyDistance25K: { primary: '#78B7F6', highlight: '#B8DFFF', shadow: '#265D9F', glow: '#4A96DD' },
  weeklyDistance50K: { primary: '#D861EA', highlight: '#F2BBFF', shadow: '#7A2D86', glow: '#BC40D2' },
  weeklyDistance75K: { primary: '#F46D61', highlight: '#FFB6AD', shadow: '#A2352F', glow: '#D64E44' },
  weeklyDistance100K: { primary: '#F5A42D', highlight: '#FFD38A', shadow: '#9B5A10', glow: '#D98119' },
  weeklyDistance150K: { primary: '#FFE27A', highlight: '#FFF2B6', shadow: '#A77516', glow: '#DFA720' },
};

export const WEEKLY_DISTANCE_TIER_NAMES: WeeklyDistanceTierTokenName[] = [
  'weeklyDistance10K',
  'weeklyDistance15K',
  'weeklyDistance25K',
  'weeklyDistance50K',
  'weeklyDistance75K',
  'weeklyDistance100K',
  'weeklyDistance150K',
];
