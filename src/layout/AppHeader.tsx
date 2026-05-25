import { ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { FontSize, FontWeight } from '../theme/tokens';
import { LAYOUT } from '../constants/layout';

type Props = {
  title:        string;
  meta?:        string;
  rightAction?: ReactNode;
};

export default function AppHeader({ title, meta, rightAction }: Props) {
  const translateY = useSharedValue(-8);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 320 });
    opacity.value    = withTiming(1, { duration: 320 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View style={[styles.header, animStyle]}>
      <View style={styles.inner}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {rightAction && <View style={styles.action}>{rightAction}</View>}
        </View>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop:    LAYOUT.headerPadV,
    paddingBottom: spacing.md,
    alignItems:    'center',
  },
  inner: {
    width:             '100%',
    maxWidth:          LAYOUT.maxContentWidth,
    paddingHorizontal: LAYOUT.screenPadH,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  title: {
    color:      colors.text,
    fontSize:   FontSize.hero,
    fontWeight: FontWeight.black,
    flex:       1,
  },
  action: {
    marginLeft: spacing.md,
  },
  meta: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
});
