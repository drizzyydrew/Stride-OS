// ─── NumberInput ──────────────────────────────────────────────────────────────
//
// Combined numeric field: text input (primary) + stepper buttons (convenience).
// Replaces all pure-stepper inputs per requirement: "never make steppers the only method."
//
// Usage:
//   <NumberInput label="Sleep" value={sleepHours} onChangeValue={setSleepHours}
//     min={0} max={12} step={0.5} unit="hrs" decimalPlaces={1} />

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';

type Props = {
  label:          string;
  value:          number;
  onChangeValue:  (n: number) => void;
  min?:           number;
  max?:           number;
  step?:          number;
  unit?:          string;
  decimalPlaces?: number;     // how many decimals to show/accept
  placeholder?:   string;
  compact?:       boolean;    // less vertical padding
};

export default function NumberInput({
  label,
  value,
  onChangeValue,
  min = 0,
  max = 9999,
  step = 1,
  unit,
  decimalPlaces = 0,
  placeholder,
  compact = false,
}: Props) {
  const colors = useThemeColors();
  const s      = useMemo(() => createStyles(colors), [colors]);

  function clamp(n: number): number {
    return Math.min(max, Math.max(min, n));
  }

  function handleText(raw: string) {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const parsed  = parseFloat(cleaned);
    if (!Number.isNaN(parsed)) {
      onChangeValue(clamp(+parsed.toFixed(decimalPlaces)));
    } else if (cleaned === '' || cleaned === '.') {
      // allow partial input — don't update value mid-type
    }
  }

  function inc() { onChangeValue(clamp(+(value + step).toFixed(decimalPlaces))); }
  function dec() { onChangeValue(clamp(+(value - step).toFixed(decimalPlaces))); }

  const displayVal = decimalPlaces > 0 ? value.toFixed(decimalPlaces) : String(value);
  const displayUnit = unit ? ` ${unit}` : '';

  return (
    <View style={s.wrapper}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.row, compact && s.rowCompact]}>
        <Pressable onPress={dec} style={s.btn} hitSlop={8}>
          <Text style={s.btnTxt}>−</Text>
        </Pressable>

        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={displayVal}
            onChangeText={handleText}
            keyboardType="decimal-pad"
            placeholder={placeholder ?? label}
            placeholderTextColor={colors.textSubtle}
            selectTextOnFocus
            returnKeyType="done"
          />
          {unit ? <Text style={s.unit}>{unit}</Text> : null}
        </View>

        <Pressable onPress={inc} style={s.btn} hitSlop={8}>
          <Text style={s.btnTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    label: {
      color:         colors.textMuted,
      fontSize:      10,
      fontWeight:    FontWeight.black,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    row: {
      flexDirection:  'row',
      alignItems:     'center',
      gap:            spacing.sm,
      backgroundColor: colors.card,
      borderRadius:   10,
      padding:        spacing.md,
      borderWidth:    1,
      borderColor:    colors.border,
    },
    rowCompact: {
      padding:    spacing.sm,
      borderRadius: Radius.sm,
    },
    inputWrap: {
      flex:          1,
      flexDirection: 'row',
      alignItems:    'center',
      justifyContent:'center',
      gap:           4,
    },
    input: {
      color:      colors.text,
      fontSize:   FontSize.xl,
      fontWeight: FontWeight.black,
      textAlign:  'center',
      minWidth:   48,
    },
    unit: {
      color:    colors.textMuted,
      fontSize: FontSize.sm,
    },
    btn: {
      width:           40,
      height:          40,
      borderRadius:    Radius.sm,
      backgroundColor: colors.border,
      alignItems:      'center',
      justifyContent:  'center',
    },
    btnTxt: {
      color:      colors.text,
      fontSize:   FontSize.md,
      fontWeight: FontWeight.bold,
      lineHeight: 22,
    },
  });
}
