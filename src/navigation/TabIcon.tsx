import { useEffect } from 'react';
import { ColorValue, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme/colors';
import { FontWeight } from '../theme/tokens';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  name:    IoniconsName;
  label:   string;
  focused: boolean;
  color:   ColorValue;
};

export default function TabIcon({ name, label, focused, color }: Props) {
  const scale   = useSharedValue(focused ? 1 : 0.88);
  const opacity = useSharedValue(focused ? 1 : 0.65);

  useEffect(() => {
    scale.value   = withTiming(focused ? 1 : 0.88,   { duration: 180 });
    opacity.value = withTiming(focused ? 1 : 0.65, { duration: 180 });
  }, [focused]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Ionicons name={name} size={22} color={color} />
      <View style={[styles.dot, { opacity: focused ? 1 : 0 }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap:        2,
    paddingTop: 2,
  },
  dot: {
    width:           3,
    height:          3,
    borderRadius:    1.5,
    backgroundColor: colors.primary,
    marginTop:       1,
  },
  label: {
    fontSize:      9,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.2,
    marginTop:     2,
  },
});
