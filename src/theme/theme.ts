import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from 'expo-router';

import { darkColors, lightColors, type Palette, type ThemeMode } from './colors';
import { spacing } from './spacing';
import {
  elevationTokens,
  motionTokens,
  radiusTokens,
  spacingTokens,
  typographyTokens,
} from './tokens';

export type AppTheme = {
  mode: ThemeMode;
  colors: Palette;
  spacing: typeof spacing;
  space: typeof spacingTokens;
  radius: typeof radiusTokens;
  typography: typeof typographyTokens;
  elevation: typeof elevationTokens;
  motion: typeof motionTokens;
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: darkColors,
  spacing,
  space: spacingTokens,
  radius: radiusTokens,
  typography: typographyTokens,
  elevation: elevationTokens,
  motion: motionTokens,
};

export const lightTheme: AppTheme = {
  mode: 'light',
  colors: lightColors,
  spacing,
  space: spacingTokens,
  radius: radiusTokens,
  typography: typographyTokens,
  elevation: elevationTokens,
  motion: motionTokens,
};

export function getTheme(mode: ThemeMode): AppTheme {
  return mode === 'light' ? lightTheme : darkTheme;
}

export function getNavigationTheme(mode: ThemeMode) {
  const base = mode === 'light' ? NavigationLightTheme : NavigationDarkTheme;
  const theme = getTheme(mode);

  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.bg,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.critical,
    },
  };
}
