import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { Radius } from '../../theme/tokens';

type Props = {
  children: ReactNode;
  style?:   ViewStyle;
};

export default function Card({ children, style }: Props) {
  const colors = useThemeColors();
  return <View style={[styles.card, { backgroundColor: colors.card }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius:    Radius.lg,
    padding:         spacing.xl,
    marginBottom:    spacing.cardGap,
  },
});
