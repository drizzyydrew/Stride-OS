import React, { createContext, type ReactNode } from 'react';

import { useThemeStore } from '../store/themeStore';
import { getTheme, type AppTheme } from './theme';

const ThemeContext = createContext<AppTheme>(getTheme('dark'));

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const mode = useThemeStore((s) => s.mode);
  return (
    <ThemeContext.Provider value={getTheme(mode)}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): AppTheme {
  return React.use(ThemeContext);
}
