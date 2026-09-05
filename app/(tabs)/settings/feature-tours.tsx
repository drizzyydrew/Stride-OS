import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import FeatureTourTarget from '../../../src/components/featureTour/FeatureTourTarget';
import { LAYOUT } from '../../../src/constants/layout';
import { useFeatureTourStore } from '../../../src/store/featureTourStore';
import { useColors } from '../../../src/theme/useColors';
import { FEATURE_TOURS, type FeatureTourId } from '../../../src/utils/featureTours';

const TOUR_ROUTES: Partial<Record<FeatureTourId, string>> = {
  today: '/(tabs)/dashboard',
  calendar: '/(tabs)/calendar',
  running: '/(tabs)/training',
  strength: '/(tabs)/strength',
  'ai-coach': '/(tabs)/coach',
  gear: '/(tabs)/more/gear',
  'stride-report': '/(tabs)/more/stride-report',
  achievements: '/(tabs)/more/achievements',
  'movement-lab': '/(tabs)/movement',
};

export default function FeatureToursScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const tourStatus = useFeatureTourStore(s => s.tourStatus);
  const requestReplay = useFeatureTourStore(s => s.requestReplay);
  const availableTours = FEATURE_TOURS.filter(tour => TOUR_ROUTES[tour.id]);

  function replayTour(tourId: FeatureTourId) {
    const route = TOUR_ROUTES[tourId];
    if (!route) return;
    requestReplay(tourId);
    router.push(route as never);
  }

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader eyebrow="LEARN STRIDEOS" title="Feature Tours" onBack={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: LAYOUT.tabBarHeight + Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <FeatureTourTarget targetId="feature-tour.help" style={[s.intro, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.introTitle, { color: C.text }]}>Replay walkthroughs anytime</Text>
          <Text style={[s.introCopy, { color: C.textMuted }]}>
            Each tour highlights the real screen so you can learn the section without leaving the product.
          </Text>
        </FeatureTourTarget>
        {availableTours.map(tour => {
          const status = tourStatus[tour.id];
          const seen = status?.completed || status?.skipped;
          return (
            <TouchableOpacity
              key={tour.id}
              style={[s.row, { backgroundColor: C.card, borderColor: C.border }]}
              activeOpacity={0.76}
              onPress={() => replayTour(tour.id)}
              accessibilityRole="button"
              accessibilityLabel={`Replay ${tour.entryLabel} walkthrough`}
              accessibilityHint={tour.description}
            >
              <View style={[s.iconBox, { backgroundColor: seen ? C.primaryDim : C.cardAlt }]}>
                <Ionicons name={seen ? 'refresh-outline' : 'sparkles-outline'} size={19} color={C.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.title, { color: C.text }]}>{tour.entryLabel}</Text>
                <Text style={[s.copy, { color: C.textMuted }]}>{tour.description}</Text>
                <Text style={[s.status, { color: C.textDim }]}>Tap to replay walkthrough</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 12,
  },
  intro: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  introTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  introCopy: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  row: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
  copy: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  status: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
