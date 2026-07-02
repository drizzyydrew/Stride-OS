import { StyleSheet } from 'react-native';
import type { ThemeColors } from './colors';
import { FontSize, FontWeight } from './tokens';

/** Build theme-aware text presets. Call from within a component via the
 *  colors returned by `useThemeColors()` — never at module scope. */
export function createTextStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screenTitle: {
      color:        colors.text,
      fontSize:     FontSize.hero,
      fontWeight:   FontWeight.black,
      marginBottom: 8,
    },
    cardLabel: {
      color:         colors.textMuted,
      fontSize:      FontSize.base,
      fontWeight:    FontWeight.medium,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    sectionLabel: {
      color:         colors.textDim,
      fontSize:      FontSize.xs,
      fontWeight:    FontWeight.bold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    valueHero: {
      color:      colors.text,
      fontSize:   FontSize.display,
      fontWeight: FontWeight.black,
      lineHeight: 52,
    },
    valueLarge: {
      color:      colors.text,
      fontSize:   FontSize.xxl,
      fontWeight: FontWeight.black,
    },
    body: {
      color:      colors.textMuted,
      fontSize:   FontSize.base,
      lineHeight: 21,
    },
    meta: {
      color:    colors.textDim,
      fontSize: FontSize.sm,
    },
    caption: {
      color:    colors.textDim,
      fontSize: 12,
    },
    buttonText: {
      color:      colors.text,
      fontWeight: FontWeight.black,
      fontSize:   15,
    },
  });
}
