import type { TextStyle } from 'react-native';

export const spacingTokens = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space8: 32,
} as const;

export const radiusTokens = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const typographyTokens = {
  sizes: {
    metricHero: 52,
    metricPrimary: 28,
    metricSecondary: 20,
    cardTitle: 15,
    rowLabel: 13,
    metricLabel: 11,
    helper: 13,
    button: 13,
    body: 13,
    caption: 12,
    sectionTitle: 18,
    screenTitle: 28,
  },
  lineHeights: {
    tight: 1.05,
    normal: 1.2,
    body: 1.35,
  },
  weights: {
    regular: '400',
    medium: '600',
    bold: '700',
    black: '800',
  },
  variants: {
    tabular: ['tabular-nums'] as TextStyle['fontVariant'],
  },
} as const;

export const elevationTokens = {
  none: {
    boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
  },
  sm: {
    boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
  },
  md: {
    boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
  },
  lg: {
    boxShadow: '0 0 8px rgba(94, 126, 146, 0.18)',
  },
} as const;

export const motionTokens = {
  duration: {
    quick: 160,
    base: 200,
    slow: 320,
  },
  scale: {
    press: 0.98,
  },
  easing: {
    standard: 'ease-in-out',
  },
} as const;

// Backwards-compatible exports for the existing app surface.
export const Radius = {
  sm: radiusTokens.sm,
  md: radiusTokens.md,
  lg: radiusTokens.lg,
} as const;

export const FontSize = {
  xs: typographyTokens.sizes.metricLabel,
  sm: typographyTokens.sizes.helper,
  base: typographyTokens.sizes.body,
  md: typographyTokens.sizes.button,
  lg: typographyTokens.sizes.sectionTitle,
  xl: typographyTokens.sizes.metricSecondary,
  xxl: typographyTokens.sizes.metricPrimary,
  hero: typographyTokens.sizes.screenTitle,
  display: typographyTokens.sizes.metricHero,
} as const;

export const FontWeight = {
  medium: typographyTokens.weights.medium,
  bold: typographyTokens.weights.bold,
  black: typographyTokens.weights.black,
} as const;
