export type RunLevelColorTokens = {
  outer: string;
  mid: string;
  highlight: string;
  shadow: string;
  glow: string;
};

export const RUN_LEVEL_NEAR_BLACK = '#080909';
export const RUN_LEVEL_PANEL_BLACK = '#0D0E0E';
export const RUN_LEVEL_LOCKED_GRAY = '#9A9892';

export const RUN_LEVEL_COLORS = {
  foundation: {
    outer: '#E8D9BE',
    mid: '#BDA882',
    highlight: '#FFF2D0',
    shadow: '#71634D',
    glow: '#D7C094',
  },
  rhythm: {
    outer: '#D07A3E',
    mid: '#9C4D22',
    highlight: '#F0B06B',
    shadow: '#5A2512',
    glow: '#BE642E',
  },
  momentum: {
    outer: '#A8B585',
    mid: '#76875C',
    highlight: '#D7E2A8',
    shadow: '#3F4A31',
    glow: '#8FA16B',
  },
  durability: {
    outer: '#9FB3CA',
    mid: '#657E98',
    highlight: '#D2DFEC',
    shadow: '#344559',
    glow: '#7893AE',
  },
  engine: {
    outer: '#B5B4AE',
    mid: '#787973',
    highlight: '#D6D3C8',
    shadow: '#393A38',
    glow: '#9B9B94',
  },
  peak: {
    outer: '#8FA0B8',
    mid: '#61718A',
    highlight: '#C8D5E6',
    shadow: '#273140',
    glow: '#71849F',
  },
  summit: {
    outer: '#F1B64C',
    mid: '#C77F25',
    highlight: '#FFD982',
    shadow: '#6C3E13',
    glow: '#E69A2D',
  },
} as const satisfies Record<string, RunLevelColorTokens>;
