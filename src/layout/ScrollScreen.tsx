import { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { LAYOUT, responsiveContentWidth } from '../constants/layout';

type Props = {
  children:      ReactNode;
  style?:        ViewStyle;
  contentStyle?: ViewStyle;
};

export default function ScrollScreen({ children, style, contentStyle }: Props) {
  const { width } = useWindowDimensions();
  const maxWidth   = responsiveContentWidth(width);

  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.inner, { maxWidth }]}>
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
    paddingHorizontal: LAYOUT.screenPadH,
  },
});
