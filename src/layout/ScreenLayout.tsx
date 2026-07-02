import { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, View, ViewStyle } from 'react-native';

import AppHeader from './AppHeader';
import ScrollScreen from './ScrollScreen';
import { useThemeColors } from '../theme/ThemeContext';
import { spacing } from '../theme/spacing';
import { LAYOUT } from '../constants/layout';

type Props = {
  title:          string;
  meta?:          string;
  children:       ReactNode;
  stickyContent?: ReactNode;
  fab?:           ReactNode;
  rightAction?:   ReactNode;
  scrollStyle?:   ViewStyle;
};

// Primary screen composition primitive.
// Replaces the old ScreenContainer + SectionTitle/SectionHeader pattern.
// Hierarchy: SafeAreaView → AppHeader → optional sticky → ScrollScreen → optional FAB.
export default function ScreenLayout({
  title,
  meta,
  children,
  stickyContent,
  fab,
  rightAction,
  scrollStyle,
}: Props) {
  const colors = useThemeColors();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <AppHeader title={title} meta={meta} rightAction={rightAction} />

      {stickyContent ? (
        <View style={[styles.sticky, { borderBottomColor: colors.border }]}>{stickyContent}</View>
      ) : null}

      <ScrollScreen contentStyle={scrollStyle}>{children}</ScrollScreen>

      {fab ? <View style={styles.fab}>{fab}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  sticky: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.md,
    borderBottomWidth: 1,
  },
  fab: {
    position: 'absolute',
    bottom:   LAYOUT.fabBottomOffset,
    right:    LAYOUT.fabRight,
  },
});
