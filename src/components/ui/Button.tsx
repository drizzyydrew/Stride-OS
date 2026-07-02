import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { Radius, FontWeight } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  label:     string;
  onPress:   () => void;
  variant?:  Variant;
  disabled?: boolean;
  style?:    ViewStyle;
};

function variantBg(variant: Variant, colors: ThemeColors): string {
  if (variant === 'primary')   return colors.primary;
  if (variant === 'secondary') return colors.border;
  return colors.danger;
}

export default function Button({ label, onPress, variant = 'primary', disabled = false, style }: Props) {
  const colors = useThemeColors();
  const s      = useMemo(() => createStyles(colors), [colors]);

  const bg = disabled ? colors.border : variantBg(variant, colors);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.button, { backgroundColor: bg }, style]}
    >
      <Text style={s.label}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      padding:      spacing.lg,
      borderRadius: Radius.md,
      alignItems:   'center',
    },
    label: {
      color:      colors.text,
      fontWeight: FontWeight.black,
      fontSize:   15,
    },
  });
}
