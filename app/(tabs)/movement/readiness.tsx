// ─── Running/Walking Readiness — Hub ──────────────────────────────────────────
//
// Explains the assessment, lets the athlete pick an activity focus, shows past
// assessments, and starts a new one. See docs/movement-readiness-evidence.md
// for the product stance and language rules every screen here must follow.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import type { Palette } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import { LAYOUT } from '../../../src/constants/layout';
import { useMovementStore } from '../../../src/store/movementStore';
import type { ReadinessCategory } from '../../../src/types/movementReadiness';
import { dionImagesForReadinessStep, DION_ASSESSMENT_IMAGES } from '../../../src/constants/dionImages';
import DionInstructionCard from '../../../src/components/movement/DionInstructionCard';

type ReadinessStepKey = 'squat_side' | 'single_leg_squat' | 'split_stance_lunge' | 'knee_to_wall' | 'heel_raise' | 'gait_side_view' | 'symptom_review';

const STEP_OVERVIEW: { key: ReadinessStepKey; label: string; detail: string }[] = [
  { key: 'squat_side',         label: 'Bodyweight Squat',       detail: 'Lateral video, 3–5 controlled reps' },
  { key: 'single_leg_squat',   label: 'Single-Leg Squat',       detail: 'Frontal video, automatic assessment first, then confirm' },
  { key: 'split_stance_lunge', label: 'Split-Stance Lunge',     detail: 'Lateral video, 3–5 controlled reps per side' },
  { key: 'knee_to_wall',       label: 'Knee-to-Wall Test',      detail: 'Manual left/right centimeters' },
  { key: 'heel_raise',         label: 'Single-Leg Heel Raise',  detail: 'Manual left/right rep counts' },
  { key: 'gait_side_view',     label: 'Gait',                   detail: 'Lateral video, 10–15 seconds' },
  { key: 'symptom_review',     label: 'Symptom Review',         detail: 'Optional intensity, location, and notes' },
];

const CATEGORY_META: Record<ReadinessCategory, { label: string; colorKey: keyof Palette }> = {
  good:            { label: 'Good',                       colorKey: 'positive' },
  monitor:         { label: 'Monitor',                     colorKey: 'warning' },
  needs_attention: { label: 'Needs attention',              colorKey: 'critical' },
  manual_review:   { label: 'Manual review recommended',    colorKey: 'textDim' },
};

function CategoryChip({ category }: { category: ReadinessCategory }) {
  const C = useColors();
  const meta = CATEGORY_META[category];
  const color = C[meta.colorKey] as string;
  return (
    <View style={[chipStyles.chip, { backgroundColor: color + '22' }]}>
      <Text style={[chipStyles.txt, { color }]}>{meta.label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  txt:  { fontSize: 11, fontWeight: FontWeight.bold },
});

export default function ReadinessHubScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(C), [C]);
  const [focus, setFocus] = useState<'running' | 'walking'>('running');
  const assessments = useMovementStore(s => s.readinessAssessments);
  const sorted = useMemo(() => [...assessments].sort((a, b) => b.createdAt - a.createdAt), [assessments]);

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </Pressable>
        <View style={{ marginLeft: 10 }}>
          <Text style={s.eyebrow}>MOVEMENT LAB</Text>
          <Text style={s.title}>Running/Walking Readiness</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: LAYOUT.screenPadBottom, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <DionInstructionCard dion={DION_ASSESSMENT_IMAGES.readiness_bodyweight_squat} variant="compact" />
          <Text style={s.explain}>
            A seven-step battery of video, manual, and reflection checks across squat pattern, single-leg control,
            split-stance mechanics, ankle mobility, calf capacity, and gait — built specifically around running and
            walking readiness. It is not a generic mobility score.
          </Text>
          <Text style={s.stance}>
            Findings may be associated with training-relevant movement patterns and are estimated from video or
            manual entry. StrideOS uses them to guide training decisions, not to diagnose injury — manual review is
            recommended whenever a result is unclear.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>ACTIVITY FOCUS</Text>
          <Text style={s.focusHint}>
            Choose whichever matches today's training. This changes only the gait step (Easy Running Gait vs.
            Walking Gait) — every other step in the battery stays the same.
          </Text>
          <View style={s.toggleRow}>
            {(['running', 'walking'] as const).map(opt => (
              <Pressable
                key={opt}
                style={[s.toggleBtn, focus === opt && s.toggleBtnActive]}
                onPress={() => setFocus(opt)}
              >
                <Text style={[s.toggleTxt, focus === opt && s.toggleTxtActive]}>
                  {opt === 'running' ? 'Running' : 'Walking'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.label}>SEVEN-STEP OVERVIEW</Text>
          <View style={{ gap: spacing.sm }}>
            {STEP_OVERVIEW.map((step, i) => {
              const dion = step.key === 'symptom_review'
                ? DION_ASSESSMENT_IMAGES.symptom_review
                : dionImagesForReadinessStep(step.key, focus);
              const label = step.key === 'gait_side_view'
                ? (focus === 'walking' ? 'Walking Gait' : 'Easy Running Gait')
                : step.label;
              return (
                <View key={step.key} style={s.stepRow}>
                  <View style={s.stepNumBadge}>
                    <Text style={s.stepNumTxt}>{i + 1}</Text>
                  </View>
                  <DionInstructionCard dion={dion} variant="compact" />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={s.stepLabel}>{label}</Text>
                    <Text style={s.stepDetail}>{step.detail}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <Pressable
          style={s.startBtn}
          onPress={() => router.push({ pathname: '/(tabs)/movement/readiness-test', params: { focus } } as never)}
        >
          <Ionicons name="play-circle" size={20} color={C.onPrimary} />
          <Text style={s.startBtnTxt}>Start Assessment</Text>
        </Pressable>

        <Text style={s.sectionLabel}>PAST ASSESSMENTS</Text>
        {sorted.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="body-outline" size={32} color={C.textSubtle} />
            <Text style={s.emptyTxt}>No assessments yet. Start one above.</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {sorted.map(a => (
              <Pressable
                key={a.id}
                style={s.assessmentCard}
                onPress={() => router.push({ pathname: '/(tabs)/movement/readiness-report', params: { id: a.id } } as never)}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.assessmentTitle}>
                    {a.activityFocus === 'running' ? 'Running' : 'Walking'} readiness
                  </Text>
                  <Text style={s.assessmentDate}>
                    {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <CategoryChip category={a.overall} />
                <Ionicons name="chevron-forward" size={18} color={C.textSubtle} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    },
    eyebrow: { color: C.textDim, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
    title:   { color: C.text, fontSize: 20, fontWeight: FontWeight.black },
    card: {
      backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
      padding: spacing.md, gap: spacing.sm,
    },
    explain: { color: C.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
    stance:  { color: C.primary, fontSize: FontSize.xs, fontStyle: 'italic', lineHeight: 17 },
    label: { color: C.textDim, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
    focusHint: { color: C.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    stepNumBadge: {
      width: 20, height: 20, borderRadius: 10, backgroundColor: C.primaryDim,
      alignItems: 'center', justifyContent: 'center',
    },
    stepNumTxt: { color: C.primary, fontSize: 11, fontWeight: FontWeight.black },
    stepLabel: { color: C.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    stepDetail: { color: C.textMuted, fontSize: FontSize.xs, lineHeight: 15 },
    toggleRow: { flexDirection: 'row', gap: spacing.sm },
    toggleBtn: {
      flex: 1, paddingVertical: spacing.sm, borderRadius: Radius.sm,
      alignItems: 'center', backgroundColor: C.border,
    },
    toggleBtnActive: { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary },
    toggleTxt: { color: C.textDim, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    toggleTxtActive: { color: C.primary },
    startBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
      backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: spacing.md,
    },
    startBtnTxt: { color: C.onPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    sectionLabel: { color: C.textMuted, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6, marginTop: spacing.xs },
    empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    emptyTxt: { color: C.textSubtle, fontSize: FontSize.sm },
    assessmentCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: spacing.md,
    },
    assessmentTitle: { color: C.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    assessmentDate:  { color: C.textSubtle, fontSize: FontSize.xs },
  });
}
