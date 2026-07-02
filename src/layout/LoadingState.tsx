import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '../theme/ThemeContext';
import { spacing } from '../theme/spacing';
import { FontSize } from '../theme/tokens';

type Props = {
  message?: string;
};

export default function LoadingState({ message }: Props) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.lg,
  },
  message: {
    fontSize: FontSize.sm,
  },
});
