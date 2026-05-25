import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { FontSize, FontWeight } from './tokens';

export const textStyles = StyleSheet.create({
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
