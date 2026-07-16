import { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useBeginnerPlanStore } from '../../../src/store/beginnerPlanStore';
import { useTrainingPlanStore } from '../../../src/store/trainingPlanStore';
import { useTrainingPreferencesStore } from '../../../src/store/trainingPreferencesStore';
import { useColors } from '../../../src/theme/useColors';
import type { BeginnerPlanGoal, BeginnerPlanReadinessInput } from '../../../src/types/beginnerPlan';
import {
  BEGINNER_PLAN_DEFINITIONS,
  generateBeginnerPlan,
  recommendBeginnerPlanDuration,
} from '../../../src/utils/beginnerPlans';

const GOALS = Object.values(BEGINNER_PLAN_DEFINITIONS);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PresetPlansScreen() {
  const C = useColors();
  const router = useRouter();
  const enduranceMode = useTrainingPreferencesStore(state => state.primaryEnduranceMode);
  const activePlan = useBeginnerPlanStore(state => state.activePlan);
  const setActivePlan = useBeginnerPlanStore(state => state.setActivePlan);
  const clearFuturePlan = useBeginnerPlanStore(state => state.clearFuturePlan);
  const setActivePresetGoal = useTrainingPlanStore(state => state.setActivePresetGoal);
  const clearActivePresetGoal = useTrainingPlanStore(state => state.clearActivePresetGoal);
  const [selectedGoal, setSelectedGoal] = useState<BeginnerPlanGoal>('couch_to_5k');
  const [targetDate, setTargetDate] = useState('');
  const [startingLevel, setStartingLevel] = useState<BeginnerPlanReadinessInput['startingLevel']>('walking');
  const [acknowledgeVisible, setAcknowledgeVisible] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const input = useMemo<BeginnerPlanReadinessInput>(() => ({
    goal: selectedGoal,
    startingLevel,
    continuousWalkMinutes: startingLevel === 'inactive' ? 10 : 35,
    continuousRunMinutes: startingLevel === 'running' ? 30 : startingLevel === 'run_walk' ? 5 : 0,
    recentConsistentWeeks: startingLevel === 'inactive' ? 0 : 4,
    availableDaysPerWeek: 4,
    hasCurrentSymptoms: false,
    crossTrainingExperience: false,
    requestedTargetDate: targetDate.trim() || undefined,
    startDate: today(),
  }), [selectedGoal, startingLevel, targetDate]);
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

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconButton}><Ionicons name="chevron-back" size={24} color={C.text} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>PRESET TRAINING PLANS</Text>
          <Text style={[s.title, { color: C.text }]}>Build Your Endurance Base</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {activePlan ? (
          <View style={[s.activeCard, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
            <Text style={[s.eyebrow, { color: C.primary }]}>ACTIVE PRESET GOAL PLAN</Text>
            <Text style={[s.cardTitle, { color: C.text }]}>{BEGINNER_PLAN_DEFINITIONS[activePlan.goal].title}</Text>
            <Text style={[s.body, { color: C.textMuted }]}>
              {activePlan.durationWeeks} weeks · target {activePlan.targetDate} · {activePlan.primaryEnduranceMode.replace(/_/g, ' ')}
            </Text>
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
            Adaptive walking, run/walk, strength, recovery, and fueling progression. Continuous running is not required.
          </Text>
          <Text style={[s.label, { color: C.textDim }]}>CURRENT STARTING POINT</Text>
          <View style={s.pills}>
            {(['inactive', 'walking', 'run_walk', 'running'] as const).map(level => (
              <TouchableOpacity
                key={level}
                onPress={() => setStartingLevel(level)}
                style={[s.pill, { backgroundColor: startingLevel === level ? C.primaryDim : C.cardAlt, borderColor: startingLevel === level ? C.primary : C.border }]}
              >
                <Text style={[s.pillText, { color: startingLevel === level ? C.primary : C.textMuted }]}>{level.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.label, { color: C.textDim }]}>REQUESTED TARGET DATE · OPTIONAL</Text>
          <TextInput
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder={recommendation.earliestSupportedTargetDate}
            placeholderTextColor={C.textMuted}
            style={[s.input, { color: C.text, backgroundColor: C.cardAlt, borderColor: recommendation.accelerated ? C.warning : C.border }]}
          />
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>RECOMMENDATION</Text>
          <Text style={[s.recommended, { color: C.text }]}>{recommendation.recommendedWeeks} weeks</Text>
          <Text style={[s.body, { color: C.textMuted }]}>Earliest supported target: {recommendation.earliestSupportedTargetDate}</Text>
          {recommendation.reasoning.slice(0, 3).map(reason => <Text key={reason} style={[s.bullet, { color: C.textMuted }]}>• {reason}</Text>)}
          <Text style={[s.helper, { color: C.textMuted }]}>
            The plan may hold or extend when adherence, readiness, recovery, or symptoms do not support progression. Completion and injury prevention cannot be guaranteed.
          </Text>
        </View>
        <TouchableOpacity onPress={choosePlan} style={[s.primaryButton, { backgroundColor: C.primary }]}>
          <Text style={[s.primaryText, { color: C.onPrimary }]}>Use This Preset Plan</Text>
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 28, fontFamily: 'CormorantGaramond_700Bold' },
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
