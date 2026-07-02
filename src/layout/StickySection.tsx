import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { useThemeColors } from '../theme/ThemeContext';
import { LAYOUT } from '../constants/layout';

type Props = {
  children: ReactNode;
  style?:   ViewStyle;
  noBorder?: boolean;
};

// Non-scrolling section rendered between AppHeader and ScrollScreen.
// Useful for pinned summary cards, filter rows, or week-level context.
export default function StickySection({ children, style, noBorder = false }: Props) {
  const colors = useThemeColors();

  return (
    <View style={[styles.section, { backgroundColor: colors.bg, borderBottomColor: colors.border }, noBorder && styles.noBorder, style]}>
      <View style={styles.inner}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingBottom:     LAYOUT.headerPadV,
    borderBottomWidth: 1,
    alignItems:        'center',
  },
  inner: {
    width:             '100%',
    maxWidth:          LAYOUT.maxContentWidth,
    paddingHorizontal: LAYOUT.screenPadH,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
});
