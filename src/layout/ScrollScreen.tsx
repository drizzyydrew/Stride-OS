import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { LAYOUT } from '../constants/layout';

type Props = {
  children:     ReactNode;
  style?:       ViewStyle;
  contentStyle?: ViewStyle;
};

export default function ScrollScreen({ children, style, contentStyle }: Props) {
  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop:    spacing.sm,
    paddingBottom: LAYOUT.screenPadBottom,
    alignItems:    'center',
  },
  inner: {
    width:             '100%',
    maxWidth:          LAYOUT.maxContentWidth,
    paddingHorizontal: LAYOUT.screenPadH,
  },
});
