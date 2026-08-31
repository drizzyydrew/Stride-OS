import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAchievementStore } from '../../store/achievementStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useColors } from '../../theme/useColors';
import { ACHIEVEMENT_SYSTEM_REGISTRY, achievementFamilyLabel } from '../../utils/achievementSystem';
import AchievementBadge from './AchievementBadge';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export default function AchievementUnlockModal() {
  const C = useColors();
  const router = useRouter();
  const units = useSettingsStore(state => state.units);
  const nextAward = useAchievementStore(state => state.unlockQueue[0]);
  const dismissNextUnlock = useAchievementStore(state => state.dismissNextUnlock);
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  const floatY = useSharedValue(0);

  const definition = nextAward
    ? ACHIEVEMENT_SYSTEM_REGISTRY.find(item => item.id === nextAward.id)
    : undefined;

  useEffect(() => {
    if (!nextAward) return undefined;
    opacity.value = 0;
    scale.value = reduceMotion ? 1 : 0.96;
    floatY.value = 0;
    opacity.value = withTiming(1, { duration: 260, easing: EASE_OUT });
    scale.value = withTiming(1, { duration: 520, easing: EASE_OUT });
    if (!reduceMotion) {
      floatY.value = withRepeat(
        withSequence(
          withTiming(-9, { duration: 1050, easing: EASE_IN_OUT }),
          withTiming(0, { duration: 1050, easing: EASE_IN_OUT }),
        ),
        -1,
        true,
      );
    }
    return () => {
      cancelAnimation(floatY);
    };
  }, [floatY, nextAward, opacity, reduceMotion, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: floatY.value },
      { scale: scale.value },
    ],
  }));

  if (!nextAward || !definition) return null;

  const title = definition.title;
  const family = achievementFamilyLabel(definition.family);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={dismissNextUnlock}
    >
      <View style={s.backdrop} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissNextUnlock} accessibilityLabel="Close achievement unlock" />
        <Animated.View style={[s.card, { backgroundColor: C.card, borderColor: C.primary }, cardStyle]}>
          <Text style={[s.eyebrow, { color: C.primary }]}>NEW BADGE UNLOCKED</Text>
          <Text style={[s.title, { color: C.text }]} numberOfLines={2} adjustsFontSizeToFit>{title}</Text>
          <Text style={[s.copy, { color: C.textMuted }]}>New badge unlocked.</Text>
          <View style={s.badgeWrap}>
            <AchievementBadge
              id={definition.id}
              category={definition.category}
              earned
              size="large"
              unitSystem={units}
            />
          </View>
          <Text style={[s.family, { color: C.textDim }]}>{family.toUpperCase()}</Text>
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.secondary, { borderColor: C.border }]}
              onPress={dismissNextUnlock}
              accessibilityRole="button"
              accessibilityLabel="Close achievement unlock"
            >
              <Text style={[s.secondaryText, { color: C.text }]}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primary, { backgroundColor: C.primary }]}
              onPress={() => {
                const id = definition.id;
                dismissNextUnlock();
                router.push({ pathname: '/(tabs)/more/achievement-detail', params: { id } } as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Share ${title}`}
            >
              <Text style={[s.primaryText, { color: C.onPrimary }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(0,0,0,0.74)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'CormorantGaramond_700Bold',
    textAlign: 'center',
  },
  copy: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  badgeWrap: {
    marginTop: 4,
  },
  family: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  primary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '900',
  },
});
