import { ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '../theme/useColors';
import { AppLogo }   from '../components/ui/AppLogo';
import { spacing }   from '../theme/spacing';
import { FontSize, FontWeight } from '../theme/tokens';
import { LAYOUT }   from '../constants/layout';

type Props = {
  title:        string;
  meta?:        string;
  rightAction?: ReactNode;
};

export default function AppHeader({ title, meta, rightAction }: Props) {
  const c           = useColors();
  const isDashboard = title === 'Today';

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
          {isDashboard
            ? <AppLogo size="sm" />
            : <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{title}</Text>
          }
          {rightAction && <View style={styles.action}>{rightAction}</View>}
        </View>
        {meta ? <Text style={[styles.meta, { color: c.textDim }]}>{meta}</Text> : null}
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
    fontSize:   FontSize.hero,
    fontWeight: FontWeight.black,
    flex:       1,
  },
  action: {
    marginLeft: spacing.md,
  },
  meta: {
    fontSize:  FontSize.sm,
    marginTop: 4,
  },
});
