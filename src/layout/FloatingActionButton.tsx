import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useThemeColors } from '../theme/ThemeContext';
import { LAYOUT } from '../constants/layout';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon:    IoniconsName;
  onPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function FloatingActionButton({ icon, onPress }: Props) {
  const colors = useThemeColors();
  const scale  = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }, animStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.9, { damping: 12 }); }}
      onPressOut={() => { scale.value = withSpring(1,   { damping: 12 }); }}
    >
      <Ionicons name={icon} size={24} color={colors.text} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    width:           LAYOUT.fabSize,
    height:          LAYOUT.fabSize,
    borderRadius:    LAYOUT.fabSize / 2,
    alignItems:      'center',
    justifyContent:  'center',
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.45,
    shadowRadius:    12,
    elevation:       10,
  },
});
