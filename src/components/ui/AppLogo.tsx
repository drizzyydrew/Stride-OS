import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

import { useColors } from '../../theme/useColors';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  size?:        Size;
  accentColor?: string;
  dark?:        boolean;
};

const CONFIG: Record<Size, { chevH: number; fontSz: number; tag: boolean }> = {
  sm: { chevH:  28, fontSz:  0, tag: false },
  md: { chevH:  40, fontSz: 26, tag: false },
  lg: { chevH: 120, fontSz: 52, tag:  true },
};

const CHEVRON_PATHS = [
  'M60 50 L120 110 L60 170',
  'M130 50 L190 110 L130 170',
  'M200 50 L260 110 L200 170',
];

const OS_ACCENT = '#5E7E92';

export function AppLogo({ size = 'md', accentColor, dark }: Props) {
  const c   = useColors();
  const cfg = CONFIG[size];

  const accent   = accentColor ?? OS_ACCENT;
  const textCol  = dark ? '#2B2A24' : c.text;
  const scale    = cfg.chevH / 220;
  const chevW    = 300 * scale;
  const strokeW  = Math.round(30 * scale);

  const chevColors = [c.primary, '#DCC0A7', accent];

  return (
    <View style={styles.wrapper}>
      <Svg width={chevW} height={cfg.chevH} viewBox="0 0 300 220">
        <G fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeW}>
          {CHEVRON_PATHS.map((d, i) => (
            <Path key={i} d={d} stroke={chevColors[i]} />
          ))}
        </G>
      </Svg>

      {cfg.fontSz > 0 && (
        <View style={styles.wordRow}>
          <Text
            style={[styles.stride, { color: textCol, fontSize: cfg.fontSz }]}
            allowFontScaling={false}
          >
            Stride
          </Text>
          <Text
            style={[styles.os, { color: accent, fontSize: cfg.fontSz }]}
            allowFontScaling={false}
          >
            OS
          </Text>
        </View>
      )}

      {cfg.tag && (
        <Text style={[styles.tagline, { color: c.textDim }]}>
          MOVE NOW · AGE GRACEFULLY
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 8,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
  },
  stride: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontWeight: '700',
    lineHeight: undefined,
  },
  os: {
    fontFamily: 'CormorantGaramond_700Bold',
    fontWeight: '700',
  },
  tagline: {
    fontFamily:    'DMSans_400Regular',
    fontSize:       11,
    fontWeight:    '500',
    letterSpacing:  1.8,
  },
});
