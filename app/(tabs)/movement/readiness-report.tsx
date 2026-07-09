// ─── Running/Walking Readiness — Report ───────────────────────────────────────
//
// Renders a saved ReadinessAssessment: overall category, per-domain findings
// (with left/right values and a noise-floor label), capture-quality summary,
// key findings, recommended mobility work, gentle training-modification
// suggestions, an "Ask AI Coach" handoff, and the standard disclaimers.
//
// Evidence contract: docs/movement-readiness-evidence.md — every string here
// either comes straight from the readiness engine (already evidence-checked)
// or is one of the fixed disclaimer lines below.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import type { Palette } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import { LAYOUT } from '../../../src/constants/layout';
import { useMovementStore } from '../../../src/store/movementStore';
import { getMobilityWorkout } from '../../../src/constants/mobilityBank';
import type { DomainResult, ReadinessCategory, ReadinessDomain } from '../../../src/types/movementReadiness';

const CATEGORY_META: Record<ReadinessCategory, { label: string; colorKey: keyof Palette }> = {
  good:            { label: 'Good',                     colorKey: 'positive' },
  monitor:         { label: 'Monitor',                   colorKey: 'warning' },
  needs_attention: { label: 'Needs attention',            colorKey: 'critical' },
  manual_review:   { label: 'Manual review recommended',  colorKey: 'textDim' },
};

const DOMAIN_LABEL: Record<ReadinessDomain, string> = {
  ankle_mobility:       'Ankle Mobility',
  hip_mobility:         'Hip Mobility',
  squat_pattern:        'Squat Pattern',
  single_leg_control:   'Single-Leg Control',
  calf_capacity:        'Calf Capacity',
  trunk_pelvic_control: 'Trunk/Pelvic Control',
  symmetry:             'Symmetry',
  capture_quality:      'Capture Quality',
};

function CategoryChip({ category, large }: { category: ReadinessCategory; large?: boolean }) {
  const C = useColors();
  const meta = CATEGORY_META[category];
  const color = C[meta.colorKey] as string;
  return (
    <View style={[chipStyles.chip, large && chipStyles.chipLarge, { backgroundColor: color + '22' }]}>
      <Text style={[chipStyles.txt, large && chipStyles.txtLarge, { color }]}>{meta.label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  chipLarge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md },
  txt: { fontSize: 11, fontWeight: FontWeight.bold },
  txtLarge: { fontSize: FontSize.base },
});

function DomainCard({ domain }: { domain: DomainResult }) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const hasSides = domain.leftValue !== undefined || domain.rightValue !== undefined;

  return (
    <View style={s.domainCard}>
      <View style={s.domainHeaderRow}>
        <Text style={s.domainTitle}>{DOMAIN_LABEL[domain.domain]}</Text>
        <CategoryChip category={domain.category} />
      </View>
      {hasSides && (
        <View style={s.sidesRow}>
          <Text style={s.sideValue}>L {domain.leftValue ?? '—'}{domain.unit ?? ''}</Text>
          <Text style={s.sideValue}>R {domain.rightValue ?? '—'}{domain.unit ?? ''}</Text>
          <Text style={s.noiseFloor}>differences this small are within measurement noise</Text>
        </View>
      )}
      <Text style={s.domainNote}>{domain.note}</Text>
      <Text style={s.confidenceLabel}>Confidence: {domain.confidence}</Text>
    </View>
  );
}

export default function ReadinessReportScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(C), [C]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const assessment = useMovementStore(st => st.readinessAssessments.find(a => a.id === id));

  if (!assessment) {
    return (
      <View style={s.root}>
        <View style={[s.header, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </Pressable>
        </View>
        <Text style={s.explain}>Assessment not found.</Text>
      </View>
    );
  }

  const recommendedWorkouts = assessment.recommendedMobilityWorkoutIds
    .map(wId => getMobilityWorkout(wId))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));

  function askCoach() {
    const workoutTitles = recommendedWorkouts.map(w => w.title).join(', ');
    const message = `I just completed a ${assessment!.activityFocus} readiness assessment. Overall result: ${CATEGORY_META[assessment!.overall].label}. ` +
      `Key findings: ${assessment!.keyFindings.length ? assessment!.keyFindings.join(' ') : 'none flagged.'} ` +
      `${workoutTitles ? `Recommended mobility work: ${workoutTitles}. ` : ''}` +
      'Can you help me understand what this means for my training?';
    router.push({ pathname: '/(tabs)/coach', params: { ask: message } } as never);
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </Pressable>
        <View style={{ marginLeft: 10 }}>
          <Text style={s.eyebrow}>READINESS REPORT</Text>
          <Text style={s.title}>{assessment.activityFocus === 'running' ? 'Running' : 'Walking'} Readiness</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: LAYOUT.screenPadBottom, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.overallCard}>
          <Text style={s.overallDate}>
            {new Date(assessment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <CategoryChip category={assessment.overall} large />
        </View>

        {assessment.painReported && (
          <View style={s.painCard}>
            <Ionicons name="medkit-outline" size={18} color={C.critical} />
            <Text style={s.painTxt}>
              Pain was reported during this assessment. Consult a clinician for pain or injury concerns —
              StrideOS does not interpret pain.
            </Text>
          </View>
        )}

        <Text style={s.sectionLabel}>DOMAINS</Text>
        <View style={{ gap: spacing.sm }}>
          {assessment.domainResults.map(d => <DomainCard key={d.domain} domain={d} />)}
        </View>

        <Text style={s.sectionLabel}>CAPTURE QUALITY</Text>
        <View style={s.card}>
          <Text style={s.explain}>{assessment.captureQualitySummary}</Text>
        </View>

        <Text style={s.sectionLabel}>KEY FINDINGS</Text>
        <View style={s.card}>
          {assessment.keyFindings.length > 0 ? (
            assessment.keyFindings.map((f, i) => <Text key={i} style={s.bullet}>•  {f}</Text>)
          ) : (
            <Text style={s.explain}>Nothing notable to flag from this assessment.</Text>
          )}
        </View>

        {recommendedWorkouts.length > 0 && (
          <>
            <Text style={s.sectionLabel}>RECOMMENDED MOBILITY WORK</Text>
            <View style={{ gap: spacing.sm }}>
              {recommendedWorkouts.map(w => (
                <Pressable
                  key={w.id}
                  style={s.workoutCard}
                  onPress={() => router.push({ pathname: '/(tabs)/strength/mobility-workout', params: { id: w.id } } as never)}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.workoutTitle}>{w.title}</Text>
                    <Text style={s.workoutPurpose}>{w.purpose}</Text>
                    <Text style={s.workoutRationale}>{w.evidenceRationale}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.textSubtle} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {assessment.trainingModificationSuggestions.length > 0 && (
          <>
            <Text style={s.sectionLabel}>TRAINING MODIFICATION SUGGESTIONS</Text>
            <View style={s.card}>
              {assessment.trainingModificationSuggestions.map((sug, i) => <Text key={i} style={s.bullet}>•  {sug}</Text>)}
            </View>
          </>
        )}

        <Pressable style={s.coachBtn} onPress={askCoach}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.onPrimary} />
          <Text style={s.coachBtnTxt}>Ask AI Coach about this assessment</Text>
        </Pressable>

        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerTxt}>
            StrideOS uses movement findings to guide training decisions, not to diagnose injury. Angles and
            counts here are estimates, not clinical measurements. Camera angle and lighting affect results.
            If you have pain or an injury concern, consult a qualified clinician.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    eyebrow: { color: C.textDim, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
    title: { color: C.text, fontSize: 20, fontWeight: FontWeight.black },
    overallCard: {
      backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
      padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
    },
    overallDate: { color: C.textSubtle, fontSize: FontSize.xs },
    painCard: {
      flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
      backgroundColor: C.criticalDim, borderRadius: 12, borderWidth: 1, borderColor: C.critical + '44', padding: spacing.md,
    },
    painTxt: { color: C.critical, fontSize: FontSize.xs, lineHeight: 18, flex: 1 },
    sectionLabel: { color: C.textMuted, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6, marginTop: spacing.xs },
    card: {
      backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
      padding: spacing.md, gap: spacing.xs,
    },
    explain: { color: C.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
    bullet: { color: C.textMuted, fontSize: FontSize.sm, lineHeight: 20 },

    domainCard: {
      backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
      padding: spacing.md, gap: spacing.xs,
    },
    domainHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    domainTitle: { color: C.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    sidesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    sideValue: { color: C.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    noiseFloor: { color: C.textSubtle, fontSize: 10, fontStyle: 'italic' },
    domainNote: { color: C.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
    confidenceLabel: { color: C.textSubtle, fontSize: 10 },

    workoutCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: spacing.md,
    },
    workoutTitle: { color: C.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    workoutPurpose: { color: C.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
    workoutRationale: { color: C.textSubtle, fontSize: 10, lineHeight: 15, marginTop: 2 },

    coachBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
      backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: spacing.md,
    },
    coachBtnTxt: { color: C.onPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },

    disclaimerBox: { paddingHorizontal: spacing.sm },
    disclaimerTxt: { color: C.textSubtle, fontSize: 10, lineHeight: 15 },
  });
}
