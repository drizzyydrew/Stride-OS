// ─── Theme Provider ─────────────────────────────────────────────────────────
//
// Supplies the active `ThemeColors` object to the component tree based on the
// device color scheme (§2.7: "Light and dark are equally first-class").
// Components read colors via `useThemeColors()` — never by importing
// `lightColors` / `darkColors` directly — so every screen reacts live when
// the user switches appearance.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './colors';

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  mode:   ThemeMode;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode:   'dark',
  colors: darkColors,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'light' ? 'light' : 'dark';

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    colors: mode === 'light' ? lightColors : darkColors,
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The current theme mode ('light' | 'dark'), reactive to system changes. */
export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext).mode;
}

/** The current semantic color set — the only source of color in the app. */
export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

export type { ThemeColors } from './colors';
export { zoneTint } from './colors';
