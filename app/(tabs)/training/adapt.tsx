import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { useAdaptationStore } from '../../../src/store/adaptationStore';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius, radiusTokens } from '../../../src/theme/tokens';
import Button from '../../../src/components/ui/Button';
import Card from '../../../src/components/ui/Card';
import { addDays as addCalendarDays, toYMD } from '../../../src/utils/calendarEngine';
import {
  MEDICAL_ADAPTATION_DISCLAIMER,
  adaptationWeekKey,
  alternativesForSession,
  createAdaptationPreview,
  missedWorkoutActions,
  type AdaptationAction,
  type AdaptationReason,
} from '../../../src/utils/adaptationWorkflow';

const WEEK_REASONS: { id: AdaptationReason; label: string }[] = [
  { id: 'illness_symptoms', label: 'Illness' },
  { id: 'pain_or_injury', label: 'Pain or symptoms' },
  { id: 'unusual_fatigue', label: 'Unusual fatigue' },
  { id: 'poor_sleep', label: 'Poor sleep' },
  { id: 'travel', label: 'Travel' },
  { id: 'schedule_conflict', label: 'Schedule conflict' },
  { id: 'weather_or_logistics', label: 'Weather' },
  { id: 'missed_multiple_sessions', label: 'Missed multiple sessions' },
  { id: 'workout_too_difficult', label: 'Workout felt too difficult' },
  { id: 'fewer_training_days', label: 'Fewer training days available' },
  { id: 'move_long_run', label: 'Move long-run day' },
  { id: 'returning_after_time_off', label: 'Returning after time off' },
  { id: 'feeling_good', label: 'Feeling good — keep unchanged' },
  { id: 'only_20_minutes', label: 'Only 20 minutes available' },
  { id: 'treadmill_available', label: 'Treadmill available' },
  { id: 'unsafe_weather', label: 'Unsafe weather' },
  { id: 'no_gym_equipment', label: 'No gym equipment' },
  { id: 'dumbbells_only', label: 'Dumbbells only' },
  { id: 'no_hills_available', label: 'No hills available' },
  { id: 'lower_impact_needed', label: 'Need a lower-impact option' },
  { id: 'no_usual_location', label: 'No usual training location' },
];

const MISSED_REASONS: { id: AdaptationReason; label: string }[] = [
  { id: 'schedule_conflict', label: 'Schedule conflict' },
  { id: 'unusual_fatigue', label: 'Fatigue' },
  { id: 'pain_or_injury', label: 'Pain or symptoms' },
  { id: 'illness_symptoms', label: 'Illness' },
  { id: 'weather_or_logistics', label: 'Weather' },
  { id: 'travel', label: 'Travel' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'equipment_or_location', label: 'Equipment or location issue' },
  { id: 'completed_other_activity', label: 'Completed another activity' },
  { id: 'no_reason', label: 'No reason' },
  { id: 'other', label: 'Other' },
];

const HEALTH_REASONS: { id: AdaptationReason; label: string }[] = [
  { id: 'feeling_good', label: 'Ready' },
  { id: 'low_energy', label: 'A little off' },
  { id: 'unusual_fatigue', label: 'Very fatigued' },
  { id: 'illness_symptoms', label: 'Sick' },
  { id: 'pain_or_injury', label: 'New pain or symptoms' },
  { id: 'returning_after_time_off', label: 'Returning after time off' },
];

const ACTION_LABEL: Record<AdaptationAction, string> = {
  unchanged: 'Keep as planned',
  reduced: 'Reduce volume',
  remove_intensity: 'Remove faster work',
  convert_easy: 'Convert to easy running',
  convert_run_walk: 'Convert to run/walk',
  replace_walk: 'Replace with walking',
  replace_cycling: 'Replace with cycling',
  replace_mobility: 'Replace with mobility',
  treadmill_equivalent: 'Use treadmill equivalent',
  dumbbell_equivalent: 'Use dumbbell option',
  active_recovery: 'Replace with active recovery',
  rest: 'Rest and reassess',
  moved: 'Move within this week',
  rebuild_week: 'Rebuild remainder of week',
  replaced: 'Use recovery alternative',
  removed: 'Skip without replacement',
};

function isMissedMode(mode?: string): boolean { return mode === 'missed'; }
function isHealthMode(mode?: string): boolean { return mode === 'health'; }

export default function AdaptMyWeekScreen() {
  const router = useRouter();
  const { mode, scheduledSessionId, preferredAction } = useLocalSearchParams<{
    mode?: string;
    scheduledSessionId?: string;
    preferredAction?: string;
  }>();
  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const availableDays = useOnboardingStore(state => state.data.availableDays);
  // The adaptation key must match the canonical resolver's calendar-week key,
  // even when the first actual workout is Monday rather than week-start Sunday.
  const weekKey = adaptationWeekKey(toYMD(weekPlan.weekStartDate));
  const setPreview = useAdaptationStore(state => state.setPreview);
  const confirmPreview = useAdaptationStore(state => state.confirmPreview);
  const storedPreview = useAdaptationStore(state => state.previews[weekKey]);
  const [reason, setReason] = useState<AdaptationReason>(
    isHealthMode(mode) ? 'low_energy' : 'schedule_conflict',
  );
  const initial = scheduled.getSessionById(scheduledSessionId ?? '');
  const [selectedId, setSelectedId] = useState(initial?.scheduledSessionId ?? scheduled.weekSessions.find(item => item.status === 'missed')?.scheduledSessionId ?? scheduled.weekSessions[0]?.scheduledSessionId ?? '');
  const session = scheduled.getSessionById(selectedId) ?? null;
  const [action, setAction] = useState<AdaptationAction>(
    preferredAction === 'moved' ? 'moved' : 'reduced',
  );
  const [selectedMoveDate, setSelectedMoveDate] = useState<string | null>(null);
  const reasonChoices = isMissedMode(mode) ? MISSED_REASONS : isHealthMode(mode) ? HEALTH_REASONS : WEEK_REASONS;

  const choices = useMemo(() => {
    if (!session) return [];
    const requests = isMissedMode(mode) ? missedWorkoutActions(session, reason) : alternativesForSession(session, reason);
    return requests.map(request => request.action);
  }, [mode, reason, session]);

  function preview() {
    if (!session) return;
    const weekDates = [...new Set(scheduled.weekSessions.map(item => item.date))].sort();
    const planStartDate = toYMD(weekPlan.weekStartDate);
    const planEnd = new Date(weekPlan.weekStartDate);
    planEnd.setDate(planEnd.getDate() + 6);
    const planEndDate = toYMD(planEnd);
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    const lockedDates = Array.from({ length: 7 }, (_, index) => addCalendarDays(weekPlan.weekStartDate, index))
      .filter(date => !availableDays.includes(dayLabels[date.getDay()]))
      .map(toYMD);
    const nextDay = new Date(`${session.date}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    const moveToDate = action === 'moved' && (selectedMoveDate ?? toYMD(nextDay)) <= planEndDate
      ? selectedMoveDate ?? toYMD(nextDay)
      : undefined;
    if (action === 'moved' && !moveToDate) {
      Alert.alert('Same-week move unavailable', 'This session is already at the end of the displayed week. Cross-week moves are not applied automatically.');
      return;
    }
    const requests = action === 'rebuild_week'
      ? scheduled.weekSessions
        .filter(item => item.date >= session.date && !item.completedActivityId)
        .map(item => ({
          scheduledSessionId: item.scheduledSessionId,
          action: /interval|tempo|threshold|speed/i.test(`${item.subtype} ${item.title}`)
            ? 'convert_easy' as const
            : 'rebuild_week' as const,
          reason,
        }))
      : [{ scheduledSessionId: session.scheduledSessionId, action, reason, moveToDate }];
    const next = createAdaptationPreview(
      weekKey,
      scheduled.canonicalWeekSessions,
      requests,
      Date.now(),
      {
        planStartDate: planStartDate ?? weekDates[0] ?? weekPlan.metadata.startsOn,
        planEndDate,
        lockedDates,
      },
    );
    setPreview(next);
  }

  function confirm() {
    const confirmed = confirmPreview(weekKey);
    if (!confirmed) {
      Alert.alert('Review needed', 'Resolve the schedule conflicts before applying this change.');
      return;
    }
    Alert.alert('Week updated', 'Your confirmed adaptation now appears everywhere your scheduled sessions are shown.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.headerTitle}>{isMissedMode(mode) ? 'Missed Workout' : isHealthMode(mode) ? 'Not Feeling 100%' : 'Adapt My Week'}</Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.title}>{isMissedMode(mode) ? 'What happened?' : 'Choose a session to adapt'}</Text>
          <Text style={styles.copy}>{isMissedMode(mode) ? 'We will not stack a missed hard workout onto the rest of your week.' : 'Review a conservative alternative before making any change.'}</Text>
          <View style={styles.chips}>
            {reasonChoices.map(item => <Pressable key={item.id} onPress={() => { setReason(item.id); if (item.id === 'feeling_good') setAction('unchanged'); }} style={[styles.chip, reason === item.id && styles.chipActive]}><Text style={[styles.chipText, reason === item.id && styles.chipTextActive]}>{item.label}</Text></Pressable>)}
          </View>
        </Card>

        {isHealthMode(mode) && <Card style={styles.notice}><Text style={styles.noticeTitle}>Before changing your workout</Text><Text style={styles.noticeText}>{MEDICAL_ADAPTATION_DISCLAIMER}</Text></Card>}

        <Text style={styles.sectionTitle}>Scheduled session</Text>
        {scheduled.weekSessions.map(item => <Pressable key={item.scheduledSessionId} onPress={() => setSelectedId(item.scheduledSessionId)} style={[styles.session, selectedId === item.scheduledSessionId && styles.sessionActive]}><Text style={styles.sessionTitle}>{item.title}</Text><Text style={styles.sessionMeta}>{item.date} · {item.target}</Text></Pressable>)}

        {session && <>
          <Text style={styles.sectionTitle}>Conservative option</Text>
          <View style={styles.chips}>{choices.map(item => <Pressable key={item} onPress={() => setAction(item)} style={[styles.chip, action === item && styles.chipActive]}><Text style={[styles.chipText, action === item && styles.chipTextActive]}>{ACTION_LABEL[item]}</Text></Pressable>)}</View>
          {action === 'moved' ? (
            <>
              <Text style={styles.sectionTitle}>New date</Text>
              <View style={styles.chips}>
                {Array.from({ length: 7 }, (_, index) => toYMD(addCalendarDays(weekPlan.weekStartDate, index)))
                  .filter(date => date !== session.date)
                  .sort()
                  .map(date => (
                    <Pressable
                      key={date}
                      onPress={() => setSelectedMoveDate(date)}
                      style={[styles.chip, selectedMoveDate === date && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selectedMoveDate === date && styles.chipTextActive]}>{date}</Text>
                    </Pressable>
                  ))}
              </View>
            </>
          ) : null}
          {!isHealthMode(mode) ? <Pressable onPress={() => setAction('rebuild_week')} style={[styles.chip, action === 'rebuild_week' && styles.chipActive, { marginTop: spacing.sm }]}><Text style={[styles.chipText, action === 'rebuild_week' && styles.chipTextActive]}>Rebuild the remainder of the week</Text></Pressable> : null}
          <Text style={styles.limitation}>Moves are safe only within this displayed week. Cross-week rescheduling is intentionally not automated.</Text>
        </>}

        {storedPreview && <Card style={styles.preview}>
          <Text style={styles.title}>Preview — confirm before applying</Text>
          {storedPreview.overlays.map(overlay => <View key={overlay.id} style={styles.previewRow}><Text style={styles.previewAction}>{overlay.action}</Text><Text style={styles.previewText}>{overlay.explanation}</Text><Text style={styles.previewText}>Training intent {overlay.intentPreserved ? 'preserved' : 'changed'}</Text></View>)}
          <Text style={[styles.previewText, { marginTop: spacing.sm }]}>Unchanged: {(storedPreview.unchangedSessionIds ?? []).length} session{(storedPreview.unchangedSessionIds ?? []).length === 1 ? '' : 's'}</Text>
          {storedPreview.conflicts.length > 0 ? storedPreview.conflicts.map(conflict => <Text key={`${conflict.code}:${conflict.sessionIds.join(':')}`} style={styles.conflict}>{conflict.message}</Text>) : <Text style={styles.ok}>No scheduling conflicts found.</Text>}
          <Button label="Apply confirmed change" onPress={confirm} disabled={storedPreview.conflicts.length > 0} style={{ marginTop: spacing.md }} />
        </Card>}
        <Button label="Preview change" onPress={preview} variant="secondary" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg }, back: { color: colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold }, headerTitle: { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold }, content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }, title: { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold }, copy: { color: colors.textMuted, marginTop: spacing.xs, lineHeight: 20 }, sectionTitle: { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold, marginTop: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }, chip: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radiusTokens.pill }, chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.textMuted, fontSize: FontSize.sm }, chipTextActive: { color: colors.onPrimary, fontWeight: FontWeight.bold }, notice: { backgroundColor: colors.border }, noticeTitle: { color: colors.text, fontWeight: FontWeight.bold }, noticeText: { color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 }, session: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md }, sessionActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim }, sessionTitle: { color: colors.text, fontWeight: FontWeight.bold }, sessionMeta: { color: colors.textMuted, marginTop: 4, fontSize: FontSize.sm }, limitation: { color: colors.textMuted, fontSize: FontSize.sm, marginTop: spacing.md, lineHeight: 18 }, preview: { borderColor: colors.primary, borderWidth: 1 }, previewRow: { marginTop: spacing.sm }, previewAction: { color: colors.primary, fontWeight: FontWeight.bold, textTransform: 'capitalize' }, previewText: { color: colors.textMuted, marginTop: 2 }, conflict: { color: '#C2410C', marginTop: spacing.sm }, ok: { color: '#4D7C0F', marginTop: spacing.sm },
});
