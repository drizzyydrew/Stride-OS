import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

import { useColors } from '../../theme/useColors';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  size?:        Size;
  accentColor?: string;
  dark?:        boolean;
  textColor?:   string;
};

const CONFIG: Record<Size, { chevH: number; fontSz: number; fullLockup: boolean }> = {
  sm: { chevH:  28, fontSz:  0, fullLockup: false },
  md: { chevH:  40, fontSz: 26, fullLockup: true },
  lg: { chevH: 120, fontSz: 52, fullLockup: true },
};

const ICON_CHEVRON_PATHS = [
  'M60 50 L120 110 L60 170',
  'M130 50 L190 110 L130 170',
  'M200 50 L260 110 L200 170',
];
const LOCKUP_CHEVRON_PATHS = [
  'M42 50 L102 110 L42 170',
  'M112 50 L172 110 L112 170',
  'M182 50 L242 110 L182 170',
  'M252 50 L312 110 L252 170',
  'M322 50 L382 110 L322 170',
];

const OS_ACCENT = '#5E7E92';
const SAGE2 = '#9DB2A0';
const SAND = '#DCC0A7';
const BROWN = '#6E8BA0';

export function AppLogo({ size = 'md', accentColor, dark, textColor }: Props) {
  const c   = useColors();
  const cfg = CONFIG[size];

  const accent   = accentColor ?? OS_ACCENT;
  const textCol  = textColor ?? (dark ? '#2B2A24' : c.text);
  const scale    = cfg.chevH / 220;
  const viewW    = cfg.fullLockup ? 424 : 300;
  const chevW    = viewW * scale;
  const strokeW  = Math.round(30 * scale);

  const chevPaths = cfg.fullLockup ? LOCKUP_CHEVRON_PATHS : ICON_CHEVRON_PATHS;
  const chevColors = cfg.fullLockup
    ? [c.primary, SAGE2, SAND, accent, BROWN]
    : [c.primary, SAND, accent];

  return (
    <View style={styles.wrapper}>
      <Svg width={chevW} height={cfg.chevH} viewBox={`0 0 ${viewW} 220`}>
        <G fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeW}>
          {chevPaths.map((d, i) => (
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
});
