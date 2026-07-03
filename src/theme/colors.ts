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
  bg:          '#101010',
  surface:     '#101010',
  card:        '#181818',
  cardElevated:'#24211F',
  border:      '#30302C',
  separator:   '#30302C',
  text:        '#F4EEE7',
  textPrimary: '#F4EEE7',
  textSecondary:'#CFC7BB',
  textMuted:   '#CFC7BB',
  textDim:     '#8F8A80',
  textSubtle:  '#625E56',
  primary:     '#8B927C',
  primaryDim:  'rgba(139,146,124,0.18)',
  onPrimary:   '#FFFFFF',
  positive:    '#6F8A63',
  positiveDim: 'rgba(111,138,99,0.18)',
  warning:     '#C79B57',
  warningDim:  'rgba(199,155,87,0.18)',
  critical:    '#8A332D',
  criticalDim: 'rgba(138,51,45,0.2)',
  neutral:     '#CFC7BB',
  danger:      '#8A332D',
  cardAlt:     '#24211F',
  accent:      '#DCC0A7',
  accentDim:   'rgba(220,192,167,0.18)',
  icon:         '#CFC7BB',
  overlay:      'rgba(0,0,0,0.54)',
  skeletonBase: '#24211F',
  skeletonHighlight: '#30302C',
  chartGrid:    'rgba(207,199,187,0.14)',
  chartAxis:    '#8F8A80',
  chartSeriesPrimary: '#8B927C',
  chartSeriesSecondary: '#DCC0A7',
};

export const lightColors: Palette = {
  bg:          '#EFE7DA',
  surface:     '#F8F5EF',
  card:        '#FFFFFF',
  cardElevated:'#FFFFFF',
  border:      '#E7DED4',
  separator:   '#E7DED4',
  text:        '#111111',
  textPrimary: '#111111',
  textSecondary:'#4D4A45',
  textMuted:   '#4D4A45',
  textDim:     '#8B877F',
  textSubtle:  '#B9B1A6',
  primary:     '#DCC0A7',
  primaryDim:  'rgba(220,192,167,0.28)',
  onPrimary:   '#111111',
  positive:    '#8B927C',
  positiveDim: 'rgba(139,146,124,0.2)',
  warning:     '#C79B57',
  warningDim:  'rgba(199,155,87,0.18)',
  critical:    '#8A332D',
  criticalDim: 'rgba(138,51,45,0.16)',
  neutral:     '#4D4A45',
  danger:      '#8A332D',
  cardAlt:     '#F8F5EF',
  accent:      '#8B927C',
  accentDim:   'rgba(139,146,124,0.18)',
  icon:         '#4D4A45',
  overlay:      'rgba(17,17,17,0.32)',
  skeletonBase: '#E7DED4',
  skeletonHighlight: '#F8F5EF',
  chartGrid:    'rgba(77,74,69,0.14)',
  chartAxis:    '#8B877F',
  chartSeriesPrimary: '#6F7F6D',
  chartSeriesSecondary: '#708489',
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
