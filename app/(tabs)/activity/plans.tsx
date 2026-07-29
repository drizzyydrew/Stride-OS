import { useMemo, useState } from 'react';
import {
  Modal,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useBeginnerPlanStore } from '../../../src/store/beginnerPlanStore';
import { useTrainingPlanStore } from '../../../src/store/trainingPlanStore';
import { useTrainingPreferencesStore } from '../../../src/store/trainingPreferencesStore';
import { useColors } from '../../../src/theme/useColors';
import type { BeginnerCompletionGoal, BeginnerPlanGoal, BeginnerPlanReadinessInput } from '../../../src/types/beginnerPlan';
import {
  BEGINNER_PLAN_DEFINITIONS,
  generateBeginnerPlan,
  recommendBeginnerPlanDuration,
} from '../../../src/utils/beginnerPlans';
import { displayLabel } from '../../../src/utils/displayLabels';
import { formatYMDForDisplay } from '../../../src/utils/dateFormatting';
import MultiColumnPickerSheet from '../../../src/components/ui/MultiColumnPickerSheet';

const GOALS = Object.values(BEGINNER_PLAN_DEFINITIONS);

const CONTINUOUS_RUN_DISTANCE_OPTIONS = [
  { label: 'Not yet', meters: 0 },
  { label: '¼ mile', meters: 400 },
  { label: '½ mile', meters: 800 },
  { label: '1 mile', meters: 1609 },
  { label: '2 miles', meters: 3219 },
  { label: '5K or more', meters: 5000 },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const YEARS = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() + index);

function dateParts(value: string) {
  const fallback = today();
  const [year, month, day] = (value || fallback).split('-').map(Number);
  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    month: Number.isFinite(month) ? month : new Date().getMonth() + 1,
    day: Number.isFinite(day) ? day : new Date().getDate(),
  };
}

export default function TrainingPathsScreen() {
  const C = useColors();
  const router = useRouter();
  const enduranceMode = useTrainingPreferencesStore(state => state.primaryEnduranceMode);
  const activePlan = useBeginnerPlanStore(state => state.activePlan);
  const setActivePlan = useBeginnerPlanStore(state => state.setActivePlan);
  const clearFuturePlan = useBeginnerPlanStore(state => state.clearFuturePlan);
  const repeatWeek = useBeginnerPlanStore(state => state.repeatWeek);
  const setActivePresetGoal = useTrainingPlanStore(state => state.setActivePresetGoal);
  const clearActivePresetGoal = useTrainingPlanStore(state => state.clearActivePresetGoal);
  const [selectedGoal, setSelectedGoal] = useState<BeginnerPlanGoal>('couch_to_5k');
  const [targetDate, setTargetDate] = useState('');
  const [startingLevel, setStartingLevel] = useState<BeginnerPlanReadinessInput['startingLevel']>('walking');
  const [completionGoal, setCompletionGoal] = useState<BeginnerCompletionGoal>('complete_distance');
  const [continuousRunDistanceMeters, setContinuousRunDistanceMeters] = useState(0);
  const [acknowledgeVisible, setAcknowledgeVisible] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [targetPickerVisible, setTargetPickerVisible] = useState(false);

  const input = useMemo<BeginnerPlanReadinessInput>(() => ({
    goal: selectedGoal,
    startingLevel,
    continuousWalkMinutes: startingLevel === 'inactive' ? 10 : 35,
    continuousRunMinutes: startingLevel === 'running' ? 30 : startingLevel === 'run_walk' ? 5 : 0,
    continuousRunDistanceMeters,
    recentConsistentWeeks: startingLevel === 'inactive' ? 0 : 4,
    availableDaysPerWeek: 4,
    hasCurrentSymptoms: false,
    crossTrainingExperience: false,
    requestedTargetDate: targetDate.trim() || undefined,
    startDate: today(),
    completionGoal,
  }), [completionGoal, continuousRunDistanceMeters, selectedGoal, startingLevel, targetDate]);
  const recommendation = useMemo(() => recommendBeginnerPlanDuration(input), [input]);

  function activate(acknowledgedAt?: number) {
    const plan = generateBeginnerPlan(input, enduranceMode, acknowledgedAt);
    setActivePlan(plan);
    setActivePresetGoal({
      goal: selectedGoal,
      planId: plan.id,
      selectedAt: Date.now(),
      targetDate: plan.targetDate,
      acceleratedAcknowledgedAt: acknowledgedAt,
    });
    setAcknowledgeVisible(false);
    setAcknowledged(false);
  }

  function choosePlan() {
    if (recommendation.accelerated) {
      setAcknowledgeVisible(true);
      return;
    }
    activate();
  }

  function removeGoal() {
    clearFuturePlan();
    clearActivePresetGoal();
  }

  function currentPlanWeekNumber(): number | null {
    if (!activePlan) return null;
    const start = Date.parse(`${activePlan.startDate}T00:00:00.000Z`);
    const current = Date.parse(`${today()}T00:00:00.000Z`);
    const week = Math.floor((current - start) / (7 * 86_400_000)) + 1;
    return week >= 1 && week < activePlan.durationWeeks ? week : null;
  }

  function previewRepeatWeek() {
    const week = currentPlanWeekNumber();
    if (!week) {
      Alert.alert('Repeat unavailable', 'A current week with a future week is required.');
      return;
    }
    Alert.alert(
      `Repeat week ${week}?`,
      `Preview: week ${week + 1} will use week ${week}’s duration, run/walk ratio, strength, and recovery pattern. The original week ${week + 1} prescription will remain in the adaptation audit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm repeat', onPress: () => repeatWeek(week) },
      ],
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader
        eyebrow="TRAINING PATHS"
        title="Choose a Training Goal"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={s.content}>
        {activePlan ? (
          <View style={[s.activeCard, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
            <Text style={[s.eyebrow, { color: C.primary }]}>ACTIVE TRAINING PATH</Text>
            <Text style={[s.cardTitle, { color: C.text }]}>{BEGINNER_PLAN_DEFINITIONS[activePlan.goal].title}</Text>
            <Text style={[s.body, { color: C.textMuted }]}>
              {activePlan.durationWeeks} weeks · target {formatYMDForDisplay(activePlan.targetDate)} · {displayLabel(activePlan.primaryEnduranceMode)}
            </Text>
            <Text style={[s.helper, { color: C.textMuted }]}>
              Goal: {activePlan.completionGoal === 'run_continuously' ? 'Run continuously' : 'Complete the distance'}
            </Text>
            <TouchableOpacity onPress={previewRepeatWeek} style={s.removeButton}>
              <Text style={[s.removeText, { color: C.primary }]}>Preview repeating this week</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={removeGoal} style={s.removeButton}>
              <Text style={[s.removeText, { color: C.critical }]}>End future goal programming</Text>
            </TouchableOpacity>
            <Text style={[s.helper, { color: C.textMuted }]}>Completed activities, analytics, readiness, and history are preserved.</Text>
          </View>
        ) : null}

        <View style={s.planGrid}>
          {GOALS.map(goal => {
            const selected = goal.goal === selectedGoal;
            return (
              <TouchableOpacity
                key={goal.goal}
                onPress={() => setSelectedGoal(goal.goal)}
                style={[s.planCard, {
                  backgroundColor: selected ? C.primaryDim : C.card,
                  borderColor: selected ? C.primary : C.border,
                }]}
              >
                <Ionicons name="flag-outline" size={21} color={selected ? C.primary : C.textMuted} />
                <Text style={[s.planTitle, { color: C.text }]}>{goal.title}</Text>
                <Text style={[s.helper, { color: C.textMuted }]}>Usually {goal.baselineRecommendedWeeks}+ weeks</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>{BEGINNER_PLAN_DEFINITIONS[selectedGoal].title}</Text>
          <Text style={[s.body, { color: C.textMuted }]}>
            Choose the destination for the adaptive engine. StrideOS will build the first schedule from your current capacity, history, readiness, and training preferences.
          </Text>
          <Text style={[s.label, { color: C.textDim }]}>CURRENT STARTING POINT</Text>
          <View style={s.pills}>
            {(['inactive', 'walking', 'run_walk', 'running'] as const).map(level => (
              <TouchableOpacity
                key={level}
                onPress={() => setStartingLevel(level)}
                style={[s.pill, { backgroundColor: startingLevel === level ? C.primaryDim : C.cardAlt, borderColor: startingLevel === level ? C.primary : C.border }]}
              >
                <Text style={[s.pillText, { color: startingLevel === level ? C.primary : C.textMuted }]}>{displayLabel(level)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.label, { color: C.textDim }]}>GOAL STYLE</Text>
          <View style={s.pills}>
            {([
              ['complete_distance', 'Complete the distance'],
              ['run_continuously', 'Run continuously'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setCompletionGoal(value)}
                style={[s.pill, { backgroundColor: completionGoal === value ? C.primaryDim : C.cardAlt, borderColor: completionGoal === value ? C.primary : C.border }]}
              >
                <Text style={[s.pillText, { color: completionGoal === value ? C.primary : C.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.label, { color: C.textDim }]}>WHAT IS THE FARTHEST YOU CAN CURRENTLY RUN WITHOUT STOPPING?</Text>
          <View style={s.pills}>
            {CONTINUOUS_RUN_DISTANCE_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.label}
                onPress={() => setContinuousRunDistanceMeters(option.meters)}
                style={[s.pill, { backgroundColor: continuousRunDistanceMeters === option.meters ? C.primaryDim : C.cardAlt, borderColor: continuousRunDistanceMeters === option.meters ? C.primary : C.border }]}
                accessibilityRole="button"
                accessibilityState={{ selected: continuousRunDistanceMeters === option.meters }}
              >
                <Text style={[s.pillText, { color: continuousRunDistanceMeters === option.meters ? C.primary : C.textMuted }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.label, { color: C.textDim }]}>REQUESTED TARGET DATE · OPTIONAL</Text>
          <TouchableOpacity
            style={[s.input, { backgroundColor: C.cardAlt, borderColor: recommendation.accelerated ? C.warning : C.border, justifyContent: 'center' }]}
            onPress={() => setTargetPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Choose requested target date"
          >
            <Text style={{ color: targetDate ? C.text : C.textMuted, fontSize: 14, fontWeight: '800' }}>
              {targetDate ? formatYMDForDisplay(targetDate) : `Recommended: ${formatYMDForDisplay(recommendation.earliestSupportedTargetDate)}`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>RECOMMENDATION</Text>
          <Text style={[s.recommended, { color: C.text }]}>{recommendation.recommendedWeeks} weeks</Text>
          <Text style={[s.body, { color: C.textMuted }]}>Earliest supported target: {formatYMDForDisplay(recommendation.earliestSupportedTargetDate)}</Text>
          <Text style={[s.label, { color: C.textDim }]}>WHY THIS TIMELINE</Text>
          {recommendation.reasoning.slice(0, 2).map(reason => <Text key={reason} style={[s.bullet, { color: C.textMuted }]}>• {reason}</Text>)}
          {recommendation.continuousRunEligibility?.requiresFiveKContinuous ? (
            <View style={[s.noteBox, { borderColor: recommendation.continuousRunEligibility.eligible ? C.primary : C.warning, backgroundColor: C.cardAlt }]}>
              <Text style={[s.label, { color: C.textDim, marginTop: 0 }]}>BEFORE A CONTINUOUS HALF OR MARATHON</Text>
              <Text style={[s.helper, { color: C.text }]}>
                {recommendation.continuousRunEligibility.recommendation}
              </Text>
              {!recommendation.continuousRunEligibility.eligible
                ? (
                  <>
                    <Text style={[s.label, { color: C.textDim }]}>YOUR OPTIONS</Text>
                    {recommendation.continuousRunEligibility.alternatives.slice(0, 3).map(alternative => (
                      <Text key={alternative} style={[s.bullet, { color: C.textMuted }]}>• {alternative}</Text>
                    ))}
                  </>
                )
                : null}
            </View>
          ) : null}
          <Text style={[s.helper, { color: C.textMuted }]}>
            The plan may hold or extend when adherence, readiness, recovery, or symptoms do not support progression. Completion and injury prevention cannot be guaranteed.
          </Text>
        </View>
        <TouchableOpacity onPress={choosePlan} style={[s.primaryButton, { backgroundColor: C.primary }]}>
          <Text style={[s.primaryText, { color: C.onPrimary }]}>Start This Training Path</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={acknowledgeVisible} transparent animationType="fade" onRequestClose={() => setAcknowledgeVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.cardTitle, { color: C.text }]}>Faster than recommended</Text>
            <Text style={[s.body, { color: C.textMuted }]}>
              This requested timeline is faster than StrideOS recommends. Faster progression may increase fatigue, symptoms, or recovery problems. The plan cannot guarantee completion or prevent injury, and it may still reduce or delay sessions based on readiness or symptoms. Medical concerns require an appropriate clinician.
            </Text>
            <TouchableOpacity style={s.ackRow} onPress={() => setAcknowledged(value => !value)}>
              <Switch value={acknowledged} onValueChange={setAcknowledged} trackColor={{ true: C.primary }} />
              <Text style={[s.ackText, { color: C.text }]}>I understand and want to continue with the accelerated target.</Text>
            </TouchableOpacity>
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setAcknowledgeVisible(false)} style={[s.secondaryButton, { borderColor: C.border }]}>
                <Text style={[s.primaryText, { color: C.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={!acknowledged} onPress={() => activate(Date.now())} style={[s.primaryButton, { flex: 1, backgroundColor: C.primary, opacity: acknowledged ? 1 : 0.4 }]}>
                <Text style={[s.primaryText, { color: C.onPrimary }]}>Confirm Timeline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <MultiColumnPickerSheet
        visible={targetPickerVisible}
        title="Target Date"
        columns={(() => {
          const parts = dateParts(targetDate || recommendation.earliestSupportedTargetDate);
          return [
            { key: 'month', title: 'Month', values: MONTHS, selectedValue: parts.month, formatValue: value => String(value).padStart(2, '0') },
            { key: 'day', title: 'Day', values: DAYS, selectedValue: parts.day, formatValue: value => String(value).padStart(2, '0') },
            { key: 'year', title: 'Year', values: YEARS, selectedValue: parts.year },
          ];
        })()}
        onClose={() => setTargetPickerVisible(false)}
        onConfirm={values => {
          setTargetDate(`${values.year}-${String(values.month).padStart(2, '0')}-${String(values.day).padStart(2, '0')}`);
          setTargetPickerVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  content: { paddingHorizontal: 18, paddingBottom: 110 },
  activeCard: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 20, fontFamily: 'CormorantGaramond_700Bold', marginTop: 5 },
  body: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  helper: { fontSize: 11, lineHeight: 16, marginTop: 7 },
  removeButton: { marginTop: 10, minHeight: 36, justifyContent: 'center' },
  removeText: { fontSize: 12, fontWeight: '900' },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  planCard: { width: '48%', minHeight: 115, borderWidth: 1, borderRadius: 16, padding: 14 },
  planTitle: { fontSize: 14, fontWeight: '900', marginTop: 9 },
  card: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12 },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 15, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  pillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14 },
  noteBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12 },
  recommended: { fontSize: 37, fontWeight: '900', marginTop: 7 },
  bullet: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  primaryButton: { minHeight: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 13, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', borderWidth: 1, borderRadius: 22, padding: 18 },
  ackRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 16 },
  ackText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secondaryButton: { flex: 1, minHeight: 52, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
