import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme';
import Icon, { type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

type Props = {
  label:     string;
  onPress:   () => void;
  variant?:  Variant;
  size?:     Size;
  icon?:     IconName;
  disabled?: boolean;
  style?:    StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  style,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const bg = getBackground(variant, disabled, theme);
  const fg = getForeground(variant, disabled, theme);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        sizeStyles[size],
        {
          backgroundColor: bg,
          borderColor: variant === 'primary' || variant === 'danger'
            ? bg
            : variant === 'secondary'
              ? theme.colors.primary
              : theme.colors.border,
          opacity: disabled ? 0.58 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !disabled ? theme.motion.scale.press : 1 }],
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
      {size !== 'icon' ? <Text style={[styles.label, { color: fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

function getBackground(variant: Variant, disabled: boolean, theme: ReturnType<typeof useTheme>) {
  if (disabled) return theme.colors.disabledSurface;
  if (variant === 'primary') return theme.colors.primary;
  if (variant === 'danger') return theme.colors.danger;
  if (variant === 'tertiary') return 'transparent';
  return 'transparent';
}

function getForeground(variant: Variant, disabled: boolean, theme: ReturnType<typeof useTheme>) {
  if (disabled) return theme.colors.disabledText;
  if (variant === 'primary') return theme.colors.onPrimary;
  if (variant === 'danger') return '#FFFFFF';
  if (variant === 'secondary' || variant === 'tertiary') return theme.colors.primary;
  return theme.colors.text;
}

const styles = StyleSheet.create({
  button: {
    minHeight:      44,
    paddingHorizontal: 16,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    flexDirection:  'row',
    gap:            8,
    borderWidth:    1,
  },
  label: {
    fontWeight: '700',
    fontSize:   13,
  },
});

const sizeStyles = StyleSheet.create({
  sm: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  md: {
    minHeight: 44,
    paddingHorizontal: 16,
  },
  lg: {
    minHeight: 48,
    paddingHorizontal: 20,
  },
  icon: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
    borderRadius: 999,
  },
});
