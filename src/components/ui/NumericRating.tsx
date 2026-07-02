import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';

type Props = {
  value:    number;
  onChange: (v: number) => void;
  min?:     number;
  max?:     number;
  color?:   string;
};

export default function NumericRating({
  value,
  onChange,
  min   = 1,
  max   = 10,
  color,
}: Props) {
  const colors       = useThemeColors();
  const styles       = useMemo(() => createStyles(colors), [colors]);
  const activeColor  = color ?? colors.primary;
  const numbers      = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <View style={styles.row}>
      {numbers.map(n => {
        const selected = n === value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            hitSlop={4}
            style={[
              styles.btn,
              { backgroundColor: selected ? activeColor : colors.border },
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {n}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap:           3,
    },
    btn: {
      flex:           1,
      height:         40,
      borderRadius:   Radius.sm,
      alignItems:     'center',
      justifyContent: 'center',
    },
    label: {
      color:      colors.textDim,
      fontSize:   FontSize.sm,
      fontWeight: FontWeight.bold,
    },
    labelSelected: {
      color: colors.text,
    },
  });
}
