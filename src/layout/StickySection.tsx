import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { LAYOUT } from '../constants/layout';

type Props = {
  children: ReactNode;
  style?:   ViewStyle;
  noBorder?: boolean;
};

// Non-scrolling section rendered between AppHeader and ScrollScreen.
// Useful for pinned summary cards, filter rows, or week-level context.
export default function StickySection({ children, style, noBorder = false }: Props) {
  return (
    <View style={[styles.section, noBorder && styles.noBorder, style]}>
      <View style={styles.inner}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor:   colors.bg,
    paddingBottom:     LAYOUT.headerPadV,
    borderBottomWidth: 1,
    borderBottomColor: '#0D1520',
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
