import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import FeatureTourTarget from '../../../src/components/featureTour/FeatureTourTarget';
import { useFeatureTour } from '../../../src/components/featureTour/FeatureTourProvider';
import ReportStatPill from '../../../src/components/report/ReportStatPill';
import ShareCardAchievementFocus from '../../../src/components/report/ShareCardAchievementFocus';
import ShareCardCleanSummary from '../../../src/components/report/ShareCardCleanSummary';
import ShareCardDataFocus from '../../../src/components/report/ShareCardDataFocus';
import ShareCardShoeReport from '../../../src/components/report/ShareCardShoeReport';
import { LAYOUT } from '../../../src/constants/layout';
import { shareCardUnavailableReason, shareReportCard } from '../../../src/lib/shareCard';
import { useActivityStore } from '../../../src/store/activityStore';
import { useGearStore } from '../../../src/store/gearStore';
import { useSettingsStore, type UnitSystem } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import {
  buildStrideReport,
  buildStrideReportSharePayload,
  formatReportDistance,
  formatReportDuration,
  formatReportElevation,
  strideReportHighlightsForUnits,
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
  { id: 'shoe_report', label: 'Shoe Report', description: 'Gear mileage without private notes' },
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

function SharePreview({ variant, report, units }: { variant: StrideReportShareVariant; report: StrideReport; units: UnitSystem }) {
  if (variant === 'data_focus') return <ShareCardDataFocus report={report} units={units} />;
  if (variant === 'achievement_focus') return <ShareCardAchievementFocus report={report} units={units} />;
  if (variant === 'shoe_report') return <ShareCardShoeReport report={report} units={units} />;
  return <ShareCardCleanSummary report={report} units={units} />;
}

export default function StrideReportScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  useFeatureTour('stride-report');
  const [period, setPeriod] = useState<StrideReportPeriod>('weekly');
  const [variant, setVariant] = useState<StrideReportShareVariant>('clean_summary');
  const [shareMessage, setShareMessage] = useState<string | null>(shareCardUnavailableReason());
  const activities = useActivityStore(state => state.activities);
  const shoes = useGearStore(state => state.shoes);
  const units = useSettingsStore(state => state.units);
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
  const sharePayload = useMemo(() => buildStrideReportSharePayload(report, variant, units), [report, units, variant]);
  const displayHighlights = useMemo(() => strideReportHighlightsForUnits(report, units), [report, units]);

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
          title="Stride Report"
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
        <FeatureTourTarget targetId="stride-report.range" style={s.segmentRow}>
          {PERIODS.map(item => (
            <PeriodButton
              key={item.id}
              active={period === item.id}
              label={item.label}
              onPress={() => setPeriod(item.id)}
            />
          ))}
        </FeatureTourTarget>

        <View style={[s.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>{report.range.label.toUpperCase()}</Text>
          <Text style={[s.title, { color: C.text }]}>
            {formatReportDistance(report.totals.distanceMiles, units)} · {formatReportDuration(report.totals.trainingMinutes)}
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
          <ReportStatPill label="Runs" value={`${report.totals.runs}`} detail={report.totals.averageRunMiles === null ? 'No qualifying runs' : `${formatReportDistance(report.totals.averageRunMiles, units)} avg`} />
          <ReportStatPill label="Elevation" value={formatReportElevation(report.totals.elevationGainMeters, units)} detail={report.totals.averageElevationGainMeters === null ? 'Outdoor elevation only' : `${formatReportElevation(report.totals.averageElevationGainMeters, units)} avg`} />
          <ReportStatPill label="Strength" value={`${report.totals.strengthSessions}`} detail={`${report.totals.crossTrainingSessions} cross-training`} />
        </View>

        <FeatureTourTarget targetId="stride-report.highlights" style={[s.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>HIGHLIGHTS</Text>
          {displayHighlights.length > 0 ? displayHighlights.slice(0, 6).map(item => (
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
        </FeatureTourTarget>

        <View style={[s.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>SHOE REPORT</Text>
          {report.shoeReport.mostUsed ? (
            <View style={[s.highlightRow, { borderBottomColor: C.separator }]}>
              <View style={s.highlightCopy}>
                <Text style={[s.highlightLabel, { color: C.text }]}>Most Used</Text>
                <Text style={[s.highlightDetail, { color: C.textMuted }]}>
                  {formatReportDistance(report.shoeReport.mostUsed.periodDistanceMiles, units)} across {report.shoeReport.mostUsed.periodRuns} run{report.shoeReport.mostUsed.periodRuns === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={[s.highlightValue, { color: C.primary }]}>{report.shoeReport.mostUsed.label}</Text>
            </View>
          ) : (
            <Text style={[s.copy, { color: C.textMuted }]}>No assigned running shoes in this period yet.</Text>
          )}
          {report.shoeReport.highestElevation ? (
            <View style={[s.highlightRow, { borderBottomColor: C.separator }]}>
              <View style={s.highlightCopy}>
                <Text style={[s.highlightLabel, { color: C.text }]}>Highest-Elevation Shoe</Text>
                <Text style={[s.highlightDetail, { color: C.textMuted }]}>
                  {formatReportElevation(report.shoeReport.highestElevation.periodElevationGainMeters, units)} across {report.shoeReport.highestElevation.periodRuns} run{report.shoeReport.highestElevation.periodRuns === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={[s.highlightValue, { color: C.primary }]}>{report.shoeReport.highestElevation.label}</Text>
            </View>
          ) : null}
          {report.shoeReport.currentRotation.length > 0 ? (
            <>
              <Text style={[s.sectionTitleSmall, { color: C.text }]}>Current Rotation</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shoeCardRow}>
                {report.shoeReport.currentRotation.map(summary => (
                  <View key={summary.shoeId ?? 'unassigned'} style={[s.shoeCard, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
                    <Text style={[s.shoeCardTitle, { color: C.text }]} numberOfLines={2}>{summary.label}</Text>
                    <Text style={[s.highlightDetail, { color: C.textMuted }]}>{formatReportDistance(summary.periodDistanceMiles, units)} period</Text>
                    <Text style={[s.highlightDetail, { color: C.textMuted }]}>{formatReportDistance(summary.lifetimeDistanceMiles, units)} lifetime</Text>
                    {summary.reminderStatus ? <Text style={[s.highlightDetail, { color: C.textMuted }]}>{summary.reminderStatus}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}
          {report.shoeReport.unassigned ? (
            <Text style={[s.copy, { color: C.textMuted }]}>
              Unassigned: {formatReportDistance(report.shoeReport.unassigned.periodDistanceMiles, units)} across {report.shoeReport.unassigned.periodRuns} run{report.shoeReport.unassigned.periodRuns === 1 ? '' : 's'}.
            </Text>
          ) : null}
          <Text style={[s.copy, { color: C.textMuted }]}>Shoe photos and private notes are excluded from shared reports by default.</Text>
        </View>

        <FeatureTourTarget targetId="stride-report.share">
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
        </FeatureTourTarget>

        <View ref={cardRef} collapsable={false} style={s.previewWrap}>
          <SharePreview variant={variant} report={report} units={units} />
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
  sectionTitleSmall: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
  },
  shoeCardRow: {
    gap: 10,
    paddingRight: 18,
    paddingBottom: 4,
  },
  shoeCard: {
    width: 172,
    minHeight: 118,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  shoeCardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    marginBottom: 4,
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
