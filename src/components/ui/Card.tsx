import { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme';

type Props = {
  children: ReactNode;
  style?:   StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'outlined' | 'muted';
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

export default function Card({
  children,
  style,
  variant = 'default',
  padding = 'lg',
}: Props) {
  const theme = useTheme();
  const paddingValue = padding === 'none'
    ? 0
    : theme.spacing[padding === 'lg' ? 'xl' : padding];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variant === 'muted' ? theme.colors.cardAlt : theme.colors.card,
          borderColor: theme.colors.border,
          padding: paddingValue,
          boxShadow: variant === 'elevated' ? theme.elevation.md.boxShadow : theme.elevation.none.boxShadow,
        },
        variant === 'outlined' && styles.outlined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    marginBottom: 18,
    borderCurve: 'continuous',
  },
  outlined: {
    borderWidth: 1,
  },
});
