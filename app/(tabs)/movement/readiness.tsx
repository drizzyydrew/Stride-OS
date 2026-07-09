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
          <Text style={s.explain}>
            A short set of video, photo, and manual checks across ankle mobility, hip mobility, squat pattern,
            single-leg control, and calf capacity — built specifically around running and walking gait, durability,
            and training readiness. It is not a generic mobility score.
          </Text>
          <Text style={s.stance}>
            StrideOS uses movement findings to guide training decisions, not to diagnose injury.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>ACTIVITY FOCUS</Text>
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
