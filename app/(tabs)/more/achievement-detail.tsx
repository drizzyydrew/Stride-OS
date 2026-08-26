import { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import AchievementBadge from '../../../src/components/achievements/AchievementBadge';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import ShareStudio, {
  SHARE_STUDIO_FORMATS,
  SHARE_STUDIO_VARIANTS,
  type ShareStudioFormat,
  type ShareStudioVariant,
} from '../../../src/components/share/ShareStudio';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { shareCardUnavailableReason, shareReportCard } from '../../../src/lib/shareCard';
import { useAchievementStore } from '../../../src/store/achievementStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { useAssessmentStore } from '../../../src/store/assessmentStore';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import {
  achievementFamilyLabel,
  achievementShareAllowed,
  evaluateAchievementSystem,
} from '../../../src/utils/achievementSystem';

function shortDate(timeMs: number | undefined): string {
  if (!timeMs) return '';
  return new Date(timeMs).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function AchievementDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const activities = useActivityStore(state => state.activities);
  const awarded = useAchievementStore(state => state.awarded);
  const units = useSettingsStore(state => state.units);
  const readinessHistory = useReadinessStore(state => state.history);
  const assessmentResults = useAssessmentStore(state => state.results);
  const weekPlan = useWeekPlan();
  const { weekSessions } = useScheduledSessions(weekPlan);
  const [variant, setVariant] = useState<ShareStudioVariant>('minimal_card');
  const [format, setFormat] = useState<ShareStudioFormat>('square');
  const [shareMessage, setShareMessage] = useState<string | null>(shareCardUnavailableReason());
  const shareRef = useRef<View>(null);
  const achievements = useMemo(() => evaluateAchievementSystem({
    activities,
    awarded,
    units,
    scheduledSessions: weekSessions,
    readinessHistory,
    assessmentResults,
  }), [activities, assessmentResults, awarded, readinessHistory, units, weekSessions]);
  const achievement = achievements.find(item => item.id === id);
  const relatedActivity = achievement?.achievedActivityId
    ? activities.find(activity => activity.id === achievement.achievedActivityId)
    : undefined;

  async function shareAchievement() {
    if (!achievement || !achievementShareAllowed(achievement)) return;
    try {
      setShareMessage(null);
      const result = await shareReportCard(shareRef, {
        fileName: `strideos-achievement-${achievement.id}-${variant}-${format}`,
        message: `StrideOS achievement: ${achievement.title}`,
      });
      setShareMessage(result.status === 'shared' ? 'Achievement PNG created.' : result.reason);
    } catch (error) {
      Alert.alert('Share unavailable', error instanceof Error ? error.message : 'StrideOS could not create this achievement image.');
    }
  }

  if (!achievement) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
        <ScreenHeader eyebrow="ACHIEVEMENT" title="Not Found" onBack={() => router.back()} />
        <View style={s.empty}>
          <Text style={[s.body, { color: C.textMuted }]}>This achievement is not in the canonical registry.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const shareEnabled = achievementShareAllowed(achievement);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader eyebrow={achievementFamilyLabel(achievement.family).toUpperCase()} title={achievement.title} onBack={() => router.back()} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.content}>
        <View style={[s.hero, { backgroundColor: C.card, borderColor: achievement.state === 'locked' ? C.border : C.primary }]}>
          <AchievementBadge id={achievement.id} category={achievement.category} earned={achievement.state !== 'locked'} size="large" />
          <Text style={[s.title, { color: C.text }]}>{achievement.title}</Text>
          <Text style={[s.body, { color: C.textMuted }]}>{achievement.description}</Text>
          <Text style={[s.state, { color: achievement.state === 'locked' ? C.textMuted : C.primary }]}>
            {achievement.state === 'locked' ? achievement.displayRemaining : `Earned ${shortDate(achievement.achievedDate)}`}
          </Text>
          <View style={[s.progressTrack, { backgroundColor: C.cardAlt }]}>
            <View style={[s.progressFill, { width: `${Math.round(achievement.progressPercentage * 100)}%` as `${number}%`, backgroundColor: C.primary }]} />
          </View>
          <Text style={[s.progressText, { color: C.textMuted }]}>
            {achievement.displayProgress} / {achievement.displayTarget}
          </Text>
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>UNLOCK CRITERIA</Text>
          <Text style={[s.body, { color: C.text }]}>{achievement.criteria}</Text>
          {relatedActivity ? (
            <Text style={[s.body, { color: C.textMuted }]}>Related activity: {new Date(relatedActivity.startTime).toLocaleDateString()}</Text>
          ) : null}
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>SHARE STUDIO</Text>
          {!shareEnabled ? <Text style={[s.body, { color: C.textMuted }]}>Sharing unlocks after this achievement is earned.</Text> : null}
          <View style={s.variantGrid}>
            {SHARE_STUDIO_VARIANTS.map(item => {
              const active = item.id === variant;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.variant, { backgroundColor: active ? C.primaryDim : C.cardAlt, borderColor: active ? C.primary : C.border, opacity: shareEnabled ? 1 : 0.5 }]}
                  disabled={!shareEnabled}
                  onPress={() => setVariant(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: !shareEnabled }}
                >
                  <Text style={[s.variantLabel, { color: C.text }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.variantGrid}>
            {SHARE_STUDIO_FORMATS.map(item => {
              const active = item.id === format;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.variant, { backgroundColor: active ? C.primaryDim : C.cardAlt, borderColor: active ? C.primary : C.border, opacity: shareEnabled ? 1 : 0.5 }]}
                  disabled={!shareEnabled}
                  onPress={() => setFormat(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: !shareEnabled }}
                >
                  <Text style={[s.variantLabel, { color: C.text }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <ShareStudio achievement={achievement} activity={relatedActivity} units={units} variant={variant} format={format} canvasRef={shareRef} />
          <TouchableOpacity
            style={[s.sharePrimary, { backgroundColor: shareEnabled ? C.primary : C.cardAlt }]}
            disabled={!shareEnabled}
            onPress={shareAchievement}
            accessibilityLabel={`Create ${achievement.title} share PNG`}
          >
            <Ionicons name="image-outline" size={17} color={shareEnabled ? C.onPrimary : C.textDim} />
            <Text style={[s.sharePrimaryText, { color: shareEnabled ? C.onPrimary : C.textDim }]}>Create Share PNG</Text>
          </TouchableOpacity>
          {shareMessage ? <Text style={[s.shareMessage, { color: C.textMuted }]}>{shareMessage}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 120, gap: 12 },
  empty: { flex: 1, padding: 24 },
  hero: { borderWidth: 1, borderRadius: 16, padding: 18, alignItems: 'center', gap: 10 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '900', textAlign: 'center' },
  body: { fontSize: 13, lineHeight: 20 },
  state: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  progressTrack: { width: '100%', height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variant: { minWidth: 86, minHeight: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  variantLabel: { fontSize: 12, fontWeight: '900' },
  sharePrimary: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  sharePrimaryText: { fontSize: 14, fontWeight: '900' },
  shareMessage: { fontSize: 12, lineHeight: 17 },
});
