import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
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

const VARIANT_BG: Record<Variant, string> = {
  primary:   colors.primary,
  secondary: colors.border,
  danger:    colors.danger,
};

export default function Button({ label, onPress, variant = 'primary', disabled = false, style }: Props) {
  const bg = disabled ? colors.border : VARIANT_BG[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor: bg }, style]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
