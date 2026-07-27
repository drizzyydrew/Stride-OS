import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import ReportStatPill from '../../../src/components/report/ReportStatPill';
import ShareCardAchievementFocus from '../../../src/components/report/ShareCardAchievementFocus';
import ShareCardCleanSummary from '../../../src/components/report/ShareCardCleanSummary';
import ShareCardDataFocus from '../../../src/components/report/ShareCardDataFocus';
import { LAYOUT } from '../../../src/constants/layout';
import { shareCardUnavailableReason, shareReportCard } from '../../../src/lib/shareCard';
import { useActivityStore } from '../../../src/store/activityStore';
import { useGearStore } from '../../../src/store/gearStore';
import { useColors } from '../../../src/theme/useColors';
import {
  buildStrideReport,
  buildStrideReportSharePayload,
  type StrideReport,
  type StrideReportPeriod,
  type StrideReportShareVariant,
} from '../../../src/utils/strideReport';

const PERIODS: Array<{ id: StrideReportPeriod; label: string }> = [
  { id: 'weekly', label: 'Week' },
  { id: 'monthly', label: 'Month' },
  { id: 'yearly', label: 'Year' },
];

const VARIANTS: Array<{ id: StrideReportShareVariant; label: string; description: string }> = [
  { id: 'clean_summary', label: 'Clean', description: 'Simple training recap' },
  { id: 'data_focus', label: 'Data', description: 'Stats without private fields' },
  { id: 'achievement_focus', label: 'Progress', description: 'Healthy progress highlight' },
];

function PeriodButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const C = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        s.segment,
        {
          backgroundColor: active ? C.primary : C.card,
          borderColor: active ? C.primary : C.border,
        },
        pressed && s.pressed,
      ]}
    >
      <Text style={[s.segmentText, { color: active ? C.onPrimary : C.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function SharePreview({ variant, report }: { variant: StrideReportShareVariant; report: StrideReport }) {
  if (variant === 'data_focus') return <ShareCardDataFocus report={report} />;
  if (variant === 'achievement_focus') return <ShareCardAchievementFocus report={report} />;
  return <ShareCardCleanSummary report={report} />;
}

export default function StrideReportScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const [period, setPeriod] = useState<StrideReportPeriod>('weekly');
  const [variant, setVariant] = useState<StrideReportShareVariant>('clean_summary');
  const [shareMessage, setShareMessage] = useState<string | null>(shareCardUnavailableReason());
  const activities = useActivityStore(state => state.activities);
  const shoes = useGearStore(state => state.shoes);
  const cardRef = useRef<View>(null);

  const report = useMemo(
    () => buildStrideReport({
      period,
      activities,
      shoes,
      upcomingFocus: 'Keep the next run controlled and consistent.',
    }),
    [activities, period, shoes],
  );
  const sharePayload = useMemo(() => buildStrideReportSharePayload(report, variant), [report, variant]);

  async function handleShare() {
    setShareMessage(null);
    const result = await shareReportCard(cardRef, {
      fileName: `strideos-${period}-${variant}`,
      message: sharePayload.headline,
    });
    setShareMessage(result.status === 'shared' ? 'Share card created.' : result.reason);
  }

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          eyebrow="STRIDE REPORT"
          title="Training Report"
          onBack={() => router.back()}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: LAYOUT.tabBarHeight + Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.segmentRow}>
          {PERIODS.map(item => (
            <PeriodButton
              key={item.id}
              active={period === item.id}
              label={item.label}
              onPress={() => setPeriod(item.id)}
            />
          ))}
        </View>

        <View style={[s.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>{report.range.label.toUpperCase()}</Text>
          <Text style={[s.title, { color: C.text }]}>
            {report.totals.distanceMiles.toFixed(1)} miles · {Math.round(report.totals.trainingMinutes)} minutes
          </Text>
          <Text style={[s.copy, { color: C.textMuted }]}>
            Retrospective training summary only. Route maps, exact locations, symptoms, readiness details, and private notes are excluded by default.
          </Text>
          {period === 'weekly' && report.upcomingFocus ? (
            <Text style={[s.focusCopy, { color: C.textSecondary }]}>Next focus: {report.upcomingFocus}</Text>
          ) : null}
        </View>

        <View style={s.statGrid}>
          <ReportStatPill label="Active days" value={`${report.totals.activeDays}`} />
          <ReportStatPill label="Runs" value={`${report.totals.runs}`} detail={report.totals.averageRunMiles === null ? 'No qualifying runs' : `${report.totals.averageRunMiles.toFixed(1)} mi avg`} />
          <ReportStatPill label="Elevation" value={`${Math.round(report.totals.elevationGainMeters)} m`} detail={report.totals.averageElevationGainMeters === null ? 'Outdoor elevation only' : `${Math.round(report.totals.averageElevationGainMeters)} m avg`} />
          <ReportStatPill label="Strength" value={`${report.totals.strengthSessions}`} detail={`${report.totals.crossTrainingSessions} cross-training`} />
        </View>

        <View style={[s.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>HIGHLIGHTS</Text>
          {report.highlights.length > 0 ? report.highlights.slice(0, 6).map(item => (
            <View key={`${item.label}-${item.value}`} style={[s.highlightRow, { borderBottomColor: C.separator }]}>
              <View style={s.highlightCopy}>
                <Text style={[s.highlightLabel, { color: C.text }]}>{item.label}</Text>
                {item.detail ? <Text style={[s.highlightDetail, { color: C.textMuted }]}>{item.detail}</Text> : null}
              </View>
              <Text style={[s.highlightValue, { color: C.primary }]}>{item.value}</Text>
            </View>
          )) : (
            <Text style={[s.copy, { color: C.textMuted }]}>No completed training in this period yet.</Text>
          )}
        </View>

        <View>
          <Text style={[s.sectionTitle, { color: C.text }]}>Share card</Text>
          <View style={s.variantGrid}>
            {VARIANTS.map(item => {
              const active = variant === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setVariant(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    s.variant,
                    { backgroundColor: active ? C.primaryDim : C.card, borderColor: active ? C.primary : C.border },
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={[s.variantLabel, { color: C.text }]}>{item.label}</Text>
                  <Text style={[s.variantDescription, { color: C.textMuted }]}>{item.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View ref={cardRef} collapsable={false} style={s.previewWrap}>
          <SharePreview variant={variant} report={report} />
        </View>

        <Pressable
          onPress={handleShare}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.primaryButton,
            { backgroundColor: C.primary },
            pressed && s.pressed,
          ]}
        >
          <Text style={[s.primaryButtonText, { color: C.onPrimary }]}>Create Share Card</Text>
        </Pressable>
        {shareMessage ? <Text style={[s.shareMessage, { color: C.textMuted }]}>{shareMessage}</Text> : null}
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
    gap: 14,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '900',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },
  copy: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  focusCopy: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  highlightCopy: {
    flex: 1,
    minWidth: 0,
  },
  highlightLabel: {
    fontSize: 14,
    fontWeight: '900',
  },
  highlightDetail: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  highlightValue: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  variantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variant: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    flexGrow: 1,
    flexBasis: '31%',
    minWidth: 96,
  },
  variantLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  variantDescription: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  previewWrap: {
    width: '100%',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
  },
  shareMessage: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
