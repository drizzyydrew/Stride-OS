import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  label:    string;
  value:    T;
  options:  Option<T>[];
  onChange: (value: T) => void;
};

export default function FieldPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: {
      color:         colors.textMuted,
      fontSize:      11,
      fontWeight:    FontWeight.medium,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom:  spacing.sm,
    },
    row: {
      flexDirection: 'row',
      gap:           spacing.sm,
    },
    pill: {
      flex:            1,
      paddingVertical: spacing.md,
      borderRadius:    Radius.sm,
      backgroundColor: colors.border,
      alignItems:      'center',
    },
    pillActive: {
      backgroundColor: colors.primaryDim,
      borderWidth:     1,
      borderColor:     colors.primary,
    },
    pillText: {
      color:      colors.textDim,
      fontSize:   FontSize.sm,
      fontWeight: FontWeight.medium,
    },
    pillTextActive: {
      color:      colors.text,
      fontWeight: FontWeight.bold,
    },
  });
}
