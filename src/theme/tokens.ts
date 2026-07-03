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
  xs: 6,
  sm: 10,
  md: 14,
  lg: 24,
  xl: 28,
  pill: 999,
} as const;

export const typographyTokens = {
  sizes: {
    metricHero: 60,
    metricPrimary: 34,
    metricSecondary: 22,
    cardTitle: 17,
    rowLabel: 15,
    metricLabel: 11,
    helper: 13,
    button: 16,
    body: 14,
    caption: 12,
    screenTitle: 42,
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
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
  },
  md: {
    boxShadow: '0 8px 20px rgba(16, 16, 16, 0.12)',
  },
  lg: {
    boxShadow: '0 16px 36px rgba(16, 16, 16, 0.18)',
  },
} as const;

export const motionTokens = {
  duration: {
    quick: 120,
    base: 180,
    slow: 280,
  },
  scale: {
    press: 0.98,
  },
  easing: {
    standard: 'ease-out',
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
  lg: typographyTokens.sizes.cardTitle + 1,
  xl: typographyTokens.sizes.metricSecondary,
  xxl: typographyTokens.sizes.metricPrimary + 2,
  hero: typographyTokens.sizes.screenTitle,
  display: 48,
} as const;

export const FontWeight = {
  medium: typographyTokens.weights.medium,
  bold: typographyTokens.weights.bold,
  black: typographyTokens.weights.black,
} as const;
