export type ThemeMode = 'light' | 'dark';

export type Palette = {
  bg: string;
  surface: string;
  card: string;
  cardElevated: string;
  border: string;
  separator: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  textSubtle: string;
  primary: string;
  primaryDim: string;
  onPrimary: string;
  positive: string;
  positiveDim: string;
  warning: string;
  warningDim: string;
  critical: string;
  criticalDim: string;
  neutral: string;
  danger: string;
  cardAlt: string;
  accent: string;
  accentDim: string;
  icon: string;
  overlay: string;
  skeletonBase: string;
  skeletonHighlight: string;
  chartGrid: string;
  chartAxis: string;
  chartSeriesPrimary: string;
  chartSeriesSecondary: string;
};

export const darkColors: Palette = {
  bg:          '#0a0a0a',
  surface:     '#0a0a0a',
  card:        '#1a1a1a',
  cardElevated:'#202020',
  border:      '#2a2a2a',
  separator:   '#2a2a2a',
  text:        '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary:'#CCCCCC',
  textMuted:   '#CCCCCC',
  textDim:     '#999999',
  textSubtle:  '#666666',
  primary:     '#DCC0A7',
  primaryDim:  'rgba(220,192,167,0.14)',
  onPrimary:   '#0a0a0a',
  positive:    '#6BB388',
  positiveDim: 'rgba(107,179,136,0.16)',
  warning:     '#C79B57',
  warningDim:  'rgba(199,155,87,0.18)',
  critical:    '#8A332D',
  criticalDim: 'rgba(138,51,45,0.2)',
  neutral:     '#999999',
  danger:      '#8A332D',
  cardAlt:     '#141414',
  accent:      '#8B927C',
  accentDim:   'rgba(139,146,124,0.18)',
  icon:         '#CCCCCC',
  overlay:      'rgba(0,0,0,0.54)',
  skeletonBase: '#1a1a1a',
  skeletonHighlight: '#2a2a2a',
  chartGrid:    'rgba(153,153,153,0.16)',
  chartAxis:    '#999999',
  chartSeriesPrimary: '#DCC0A7',
  chartSeriesSecondary: '#8B927C',
};

export const lightColors: Palette = {
  bg:          '#EFE7DA',
  surface:     '#EFE7DA',
  card:        '#f5ede0',
  cardElevated:'#FFF9EF',
  border:      '#dddddd',
  separator:   '#dddddd',
  text:        '#0a0a0a',
  textPrimary: '#0a0a0a',
  textSecondary:'#4D433E',
  textMuted:   '#4D433E',
  textDim:     '#708489',
  textSubtle:  '#999999',
  primary:     '#DCC0A7',
  primaryDim:  'rgba(220,192,167,0.34)',
  onPrimary:   '#0a0a0a',
  positive:    '#6BB388',
  positiveDim: 'rgba(107,179,136,0.18)',
  warning:     '#C79B57',
  warningDim:  'rgba(199,155,87,0.18)',
  critical:    '#8A332D',
  criticalDim: 'rgba(138,51,45,0.16)',
  neutral:     '#708489',
  danger:      '#8A332D',
  cardAlt:     '#EFE7DA',
  accent:      '#8B927C',
  accentDim:   'rgba(139,146,124,0.18)',
  icon:         '#4D433E',
  overlay:      'rgba(17,17,17,0.32)',
  skeletonBase: '#E7DED4',
  skeletonHighlight: '#f5ede0',
  chartGrid:    'rgba(112,132,137,0.18)',
  chartAxis:    '#708489',
  chartSeriesPrimary: '#DCC0A7',
  chartSeriesSecondary: '#8B927C',
};

// Backwards-compatible export for older imports. Keep this aligned with the
// approved Moore Movement dark palette so legacy usage cannot reintroduce the
// previous blue/green Stride palette.
export const strideColors: Palette = darkColors;

export function getColors(mode: ThemeMode): Palette {
  return mode === 'light' ? lightColors : darkColors;
}

// Dynamic reactive colors - keeps all existing `import { colors }` working while
// still reflecting theme changes after components re-render.
export const colors: Palette = new Proxy(darkColors, {
  get(_target, prop: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useThemeStore } = require('../store/themeStore') as typeof import('../store/themeStore');
      const mode = useThemeStore.getState().mode;
      return getColors(mode)[prop as keyof Palette];
    } catch {
      return darkColors[prop as keyof Palette];
    }
  },
});
