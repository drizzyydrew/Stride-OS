export type ThemeMode = 'light' | 'dark';

export type Palette = {
  backgroundPrimary: string;
  backgroundSecondary: string;
  surfacePrimary: string;
  surfaceElevated: string;
  surfaceSelected: string;
  textOnAccent: string;
  borderDefault: string;
  borderStrong: string;
  accentPrimary: string;
  accentPressed: string;
  accentSubtle: string;
  success: string;
  disabledSurface: string;
  disabledText: string;
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
  backgroundPrimary: '#11100F',
  backgroundSecondary: '#171513',
  surfacePrimary: '#1F1B18',
  surfaceElevated:'#27221E',
  surfaceSelected: 'rgba(94,126,146,0.18)',
  textOnAccent: '#0B0D0F',
  borderDefault: '#342E2A',
  borderStrong: '#5E7E92',
  accentPrimary: '#5E7E92',
  accentPressed: '#7898AB',
  accentSubtle: 'rgba(94,126,146,0.18)',
  success: '#9DB2A0',
  disabledSurface: '#2A2623',
  disabledText: '#928C85',
  bg:          '#11100F',
  surface:     '#11100F',
  card:        '#1F1B18',
  cardElevated:'#27221E',
  border:      '#342E2A',
  separator:   '#342E2A',
  text:        '#F5F0E8',
  textPrimary: '#F5F0E8',
  textSecondary:'#D8D0C6',
  textMuted:   '#C3BBB1',
  textDim:     '#928C85',
  textSubtle:  '#726C65',
  primary:     '#5E7E92',
  primaryDim:  'rgba(94,126,146,0.18)',
  onPrimary:   '#F7F1E8',
  positive:    '#9DB2A0',
  positiveDim: 'rgba(157,178,160,0.16)',
  warning:     '#DCC0A7',
  warningDim:  'rgba(220,192,167,0.17)',
  critical:    '#8A332D',
  criticalDim: 'rgba(138,51,45,0.2)',
  neutral:     '#928C85',
  danger:      '#8A332D',
  cardAlt:     '#171513',
  accent:      '#9DB2A0',
  accentDim:   'rgba(157,178,160,0.16)',
  icon:         '#D8D0C6',
  overlay:      'rgba(0,0,0,0.54)',
  skeletonBase: '#1F1B18',
  skeletonHighlight: '#342E2A',
  chartGrid:    'rgba(146,140,133,0.16)',
  chartAxis:    '#928C85',
  chartSeriesPrimary: '#5E7E92',
  chartSeriesSecondary: '#9DB2A0',
};

export const lightColors: Palette = {
  backgroundPrimary: '#ECE6DD',
  backgroundSecondary: '#E1D9CF',
  surfacePrimary: '#F7F1E8',
  surfaceElevated:'#FFF9F0',
  surfaceSelected: '#D8E0E1',
  textOnAccent: '#FFFFFF',
  borderDefault: '#B6AAA0',
  borderStrong: '#5E7E92',
  accentPrimary: '#36586E',
  accentPressed: '#2F5068',
  accentSubtle: '#D8E0E1',
  success: '#4F735D',
  disabledSurface: '#D8D0C6',
  disabledText: '#69655F',
  bg:          '#ECE6DD',
  surface:     '#ECE6DD',
  card:        '#F7F1E8',
  cardElevated:'#FFF9F0',
  border:      '#B6AAA0',
  separator:   '#B6AAA0',
  text:        '#0a0a0a',
  textPrimary: '#0a0a0a',
  textSecondary:'#4D433E',
  textMuted:   '#4D433E',
  textDim:     '#69655F',
  textSubtle:  '#69655F',
  primary:     '#36586E',
  primaryDim:  '#D8E0E1',
  onPrimary:   '#FFFFFF',
  positive:    '#4F735D',
  positiveDim: '#DDE7DE',
  warning:     '#765331',
  warningDim:  '#EFE1D2',
  critical:    '#8A332D',
  criticalDim: '#EBD8D5',
  neutral:     '#69655F',
  danger:      '#8A332D',
  cardAlt:     '#ECE6DD',
  accent:      '#7C927E',
  accentDim:   '#DDE7DE',
  icon:         '#4D433E',
  overlay:      'rgba(17,17,17,0.32)',
  skeletonBase: '#E1D9CF',
  skeletonHighlight: '#F7F1E8',
  chartGrid:    'rgba(94,126,146,0.18)',
  chartAxis:    '#5E7E92',
  chartSeriesPrimary: '#36586E',
  chartSeriesSecondary: '#7C927E',
};

// Backwards-compatible export for older imports. Keep this aligned with the
// logo-led StrideOS palette so legacy usage cannot reintroduce drift.
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
