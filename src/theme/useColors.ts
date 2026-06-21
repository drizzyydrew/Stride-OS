import { getColors, type Palette } from './colors';
import { useThemeStore } from '../store/themeStore';

export function useColors(): Palette {
  const mode = useThemeStore((s) => s.mode);
  return getColors(mode);
}
