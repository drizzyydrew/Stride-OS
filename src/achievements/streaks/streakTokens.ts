export type StreakHeatTokenName =
  | 'streakHeatGreen'
  | 'streakHeatYellow'
  | 'streakHeatOrange'
  | 'streakHeatRedOrange'
  | 'streakHeatHotPink'
  | 'streakHeatViolet'
  | 'streakHeatBlue'
  | 'streakHeatBlueWhite'
  | 'streakHeatWhiteHot';

export type StreakHeatColorTokens = {
  primary: string;
  highlight: string;
  shadow: string;
  glow: string;
  center: string;
};

export const STREAK_NEAR_BLACK = '#070809';
export const STREAK_PANEL_BLACK = '#0B0D10';
export const STREAK_LOCKED_GRAY = '#8E9294';

export const STREAK_HEAT_COLORS: Record<StreakHeatTokenName, StreakHeatColorTokens> = {
  streakHeatGreen: {
    primary: '#A5EC70',
    highlight: '#D8FFC0',
    shadow: '#4A8D43',
    glow: '#69C85D',
    center: '#F2FFE3',
  },
  streakHeatYellow: {
    primary: '#FFD84A',
    highlight: '#FFF4A2',
    shadow: '#A9751F',
    glow: '#FFC737',
    center: '#FFF9C7',
  },
  streakHeatOrange: {
    primary: '#FF962D',
    highlight: '#FFD08A',
    shadow: '#B84F14',
    glow: '#FF7C1E',
    center: '#FFE2B3',
  },
  streakHeatRedOrange: {
    primary: '#FF4F2D',
    highlight: '#FFAA79',
    shadow: '#9F2519',
    glow: '#EF3A20',
    center: '#FFD0B8',
  },
  streakHeatHotPink: {
    primary: '#FF4F85',
    highlight: '#FFC2D7',
    shadow: '#9E244D',
    glow: '#F43773',
    center: '#FFE0EC',
  },
  streakHeatViolet: {
    primary: '#B96CFF',
    highlight: '#E2C4FF',
    shadow: '#6033B8',
    glow: '#9347EC',
    center: '#F0DFFF',
  },
  streakHeatBlue: {
    primary: '#4EA4FF',
    highlight: '#BCDFFF',
    shadow: '#265B9E',
    glow: '#3489F3',
    center: '#E0F1FF',
  },
  streakHeatBlueWhite: {
    primary: '#46E6F1',
    highlight: '#E7FFFF',
    shadow: '#27868E',
    glow: '#32CBD8',
    center: '#F0FFFF',
  },
  streakHeatWhiteHot: {
    primary: '#F4F5F2',
    highlight: '#FFFFFF',
    shadow: '#8E9294',
    glow: '#D7E5EA',
    center: '#FFFFFF',
  },
};
