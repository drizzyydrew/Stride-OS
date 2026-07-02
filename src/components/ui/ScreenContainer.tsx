import { ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';

type Props = {
  children: ReactNode;
};

export default function ScreenContainer({ children }: Props) {
  const colors = useThemeColors();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
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
