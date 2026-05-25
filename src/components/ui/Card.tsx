import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Radius } from '../../theme/tokens';

type Props = {
  children: ReactNode;
  style?:   ViewStyle;
};

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    Radius.lg,
    padding:         spacing.xl,
    marginBottom:    spacing.cardGap,
  },
});
