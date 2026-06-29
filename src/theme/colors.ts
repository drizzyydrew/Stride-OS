export type ThemeMode = 'light' | 'dark';

export type Palette = {
  bg: string;
  card: string;
  border: string;
  text: string;
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
};

export const darkColors: Palette = {
  bg:          '#14160F',
  card:        '#1E2018',
  border:      '#4B5240',
  text:        '#F3F1E9',
  textMuted:   '#D4D7C9',
  textDim:     '#B8BFA8',
  textSubtle:  '#9EA78C',
  primary:     '#C7D0A8',
  primaryDim:  '#262A1E',
  onPrimary:   '#14160F',
  positive:    '#98B06B',
  positiveDim: '#22281A',
  warning:     '#D9A857',
  warningDim:  '#33270F',
  critical:    '#CE7E6D',
  criticalDim: '#33190F',
  neutral:     '#A9AD98',
  danger:      '#C06A52',
  cardAlt:     '#262A1E',
  accent:      '#DCC0A7',
  accentDim:   'rgba(220,192,167,0.15)',
};

export const lightColors: Palette = {
  bg:          '#EDE9DF',
  card:        '#F8F5EE',
  border:      '#DCD5C6',
  text:        '#2B2A24',
  textMuted:   '#6E7261',
  textDim:     '#8A8F79',
  textSubtle:  '#B4B2A4',
  primary:     '#8B927C',
  primaryDim:  '#E4E6DB',
  onPrimary:   '#FBFAF6',
  positive:    '#6E8B3D',
  positiveDim: '#E7EDD9',
  warning:     '#B9842B',
  warningDim:  '#F4E9D4',
  critical:    '#B85A48',
  criticalDim: '#F2DED9',
  neutral:     '#6E7261',
  danger:      '#B05036',
  cardAlt:     '#EFE7DA',
  accent:      '#C29A6E',
  accentDim:   'rgba(194,154,110,0.16)',
};

export const strideColors: Palette = {
  bg:          '#0B0F14',
  card:        '#151C24',
  border:      '#1E293B',
  text:        '#FFFFFF',
  textMuted:   '#8B9AAF',
  textDim:     '#5F6B7A',
  textSubtle:  '#334155',
  primary:     '#2563EB',
  primaryDim:  '#0C1A3D',
  onPrimary:   '#FFFFFF',
  positive:    '#4ADE80',
  positiveDim: '#052E16',
  warning:     '#F59E0B',
  warningDim:  '#451A03',
  critical:    '#F87171',
  criticalDim: '#450A0A',
  neutral:     '#8B9AAF',
  danger:      '#DC2626',
  cardAlt:     '#1E293B',
  accent:      '#60A5FA',
  accentDim:   'rgba(96,165,250,0.15)',
};

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
