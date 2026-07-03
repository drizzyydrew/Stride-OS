import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';
import { spacing } from '../../theme/spacing';

type Props = {
  children: ReactNode;
};

export default function ScreenContainer({ children }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.safe, { backgroundColor: theme.colors.bg }]}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.bg }]}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding:       spacing.xl,
    paddingTop:    spacing.screenPadTop,
    paddingBottom: spacing.screenPadBottom,
  },
});
