// ─── Assessment Card ──────────────────────────────────────────────────────────
//
// UI for a single movement/strength field test.
// Shows: test instructions, left/right NumberInput (or bilateral), interpret
// result inline, retest due date, evidence confidence badge.
//
// All calculation logic lives in assessmentEngine.ts + assessmentStore.ts.
// This component only renders — no scoring logic here.

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import NumberInput from '../ui/NumberInput';
import { colors }  from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { AssessmentTestDef, AssessmentRating, AssessmentConfidence, AssessmentSide } from '../../types/assessment';

// ─── Props ────────────────────────────────────────────────────────────────────

export type AssessmentCardProps = {
  def:          AssessmentTestDef;
  latestResult: {
    value:          number;
    side?:          AssessmentSide;
    rating:         AssessmentRating;
    confidence:     AssessmentConfidence;
    interpretation: string;
    date:           string;
  } | null;
  onSave: (value: number, side: AssessmentSide | undefined) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingColor(r: AssessmentRating): string {
  if (r === 'above_expected') return colors.positive;
  if (r === 'expected')       return colors.warning;
  return colors.critical;
}

function ratingLabel(r: AssessmentRating): string {
  if (r === 'above_expected') return 'Above Expected';
  if (r === 'expected')       return 'Expected';
  return 'Below Expected';
}

function confidenceColor(c: AssessmentConfidence): string {
  if (c === 'high')     return colors.positive;
  if (c === 'moderate') return colors.warning;
  return colors.textDim;
}

function unitLabel(unit: AssessmentTestDef['unit']): string {
  if (unit === 'reps')      return 'reps';
  if (unit === 'seconds')   return 'sec';
  return '/ 5';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssessmentCard({ def, latestResult, onSave }: AssessmentCardProps) {
  const isBilateral    = def.sides === 'bilateral';
  const isQuality      = def.unit === 'quality_1_5';

  const [expanded,   setExpanded]   = useState(false);
  const [inputMode,  setInputMode]  = useState(false);
  const [valueLeft,  setValueLeft]  = useState(latestResult?.value ?? (isQuality ? 3 : 0));
  const [valueRight, setValueRight] = useState(latestResult?.value ?? (isQuality ? 3 : 0));

  const maxVal  = isQuality ? 5 : def.unit === 'seconds' ? 600 : 100;
  const step    = isQuality ? 1 : def.unit === 'seconds' ? 5 : 1;

  function handleSave() {
    if (isBilateral) {
      onSave(valueLeft, 'bilateral');
    } else {
      onSave(valueLeft, 'left');
      if (!isBilateral) onSave(valueRight, 'right');
    }
    setInputMode(false);
  }

  return (
    <View style={s.card}>
      {/* Header row */}
      <Pressable style={s.header} onPress={() => setExpanded(v => !v)}>
        <View style={s.headerLeft}>
          <Text style={s.testName}>{def.label}</Text>
          <View style={s.badgeRow}>
            <View style={[s.confBadge, { backgroundColor: confidenceColor(def.confidence) + '22' }]}>
              <Text style={[s.confTxt, { color: confidenceColor(def.confidence) }]}>
                {def.confidence} evidence
              </Text>
            </View>
            <Text style={s.retestHint}>Retest every {def.retestWeeks}w</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          {latestResult ? (
            <View style={[s.ratingBadge, { backgroundColor: ratingColor(latestResult.rating) + '22' }]}>
              <Text style={[s.ratingTxt, { color: ratingColor(latestResult.rating) }]}>
                {ratingLabel(latestResult.rating)}
              </Text>
            </View>
          ) : (
            <Text style={s.noData}>Not tested</Text>
          )}
          <Text style={s.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {/* Description */}
      <Text style={s.desc}>{def.description}</Text>

      {/* Latest result summary */}
      {latestResult && !inputMode && (
        <View style={s.resultRow}>
          <View style={s.resultItem}>
            <Text style={s.resultLabel}>{isBilateral ? 'SCORE' : 'LAST RESULT'}</Text>
            <Text style={s.resultValue}>
              {latestResult.value} <Text style={s.resultUnit}>{unitLabel(def.unit)}</Text>
            </Text>
          </View>
          <View style={s.resultItem}>
            <Text style={s.resultLabel}>DATE</Text>
            <Text style={s.resultValue}>{latestResult.date}</Text>
          </View>
          <Pressable style={s.retestBtn} onPress={() => setInputMode(true)}>
            <Text style={s.retestTxt}>Retest</Text>
          </Pressable>
        </View>
      )}

      {/* No result yet */}
      {!latestResult && !inputMode && (
        <View style={s.noResultRow}>
          <Text style={s.noResultTxt}>No test on record</Text>
          <Pressable style={s.testNowBtn} onPress={() => setInputMode(true)}>
            <Text style={s.testNowTxt}>Test Now</Text>
          </Pressable>
        </View>
      )}

      {/* Input mode */}
      {inputMode && (
        <View style={s.inputSection}>
          {isBilateral ? (
            <NumberInput
              label="Score"
              value={valueLeft}
              onChangeValue={setValueLeft}
              min={0} max={maxVal} step={step}
              unit={unitLabel(def.unit)}
              decimalPlaces={0}
            />
          ) : (
            <View style={s.sidesRow}>
              <View style={s.sideInput}>
                <NumberInput
                  label="Left"
                  value={valueLeft}
                  onChangeValue={setValueLeft}
                  min={0} max={maxVal} step={step}
                  unit={unitLabel(def.unit)}
                  decimalPlaces={0}
                  compact
                />
              </View>
              <View style={s.sideInput}>
                <NumberInput
                  label="Right"
                  value={valueRight}
                  onChangeValue={setValueRight}
                  min={0} max={maxVal} step={step}
                  unit={unitLabel(def.unit)}
                  decimalPlaces={0}
                  compact
                />
              </View>
            </View>
          )}
          <View style={s.inputActions}>
            <Pressable style={s.cancelBtn} onPress={() => setInputMode(false)}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveTxt}>Save Result</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Expanded details */}
      {expanded && (
        <View style={s.expandedBody}>
          {/* Instructions */}
          <Text style={s.expandLabel}>INSTRUCTIONS</Text>
          {def.instructions.map((step, i) => (
            <View key={i} style={s.stepRow}>
              <Text style={s.stepNum}>{i + 1}</Text>
              <Text style={s.stepTxt}>{step}</Text>
            </View>
          ))}

          {/* Normative context */}
          <Text style={[s.expandLabel, { marginTop: spacing.md }]}>REFERENCE RANGES</Text>
          <View style={s.normRow}>
            <View style={s.normItem}>
              <Text style={s.normLabel}>BELOW EXPECTED</Text>
              <Text style={[s.normValue, { color: colors.critical }]}>
                {'< '}{def.normRanges.default.below} {unitLabel(def.unit)}
              </Text>
            </View>
            <View style={s.normItem}>
              <Text style={s.normLabel}>EXPECTED</Text>
              <Text style={[s.normValue, { color: colors.warning }]}>
                {def.normRanges.default.below}–{def.normRanges.default.above}
              </Text>
            </View>
            <View style={s.normItem}>
              <Text style={s.normLabel}>ABOVE EXPECTED</Text>
              <Text style={[s.normValue, { color: colors.positive }]}>
                {'≥ '}{def.normRanges.default.above}
              </Text>
            </View>
          </View>

          {/* Evidence note */}
          <View style={s.evidenceBox}>
            <Text style={s.evidenceLabel}>EVIDENCE NOTE</Text>
            <Text style={s.evidenceTxt}>{def.evidenceNote}</Text>
          </View>

          {/* Interpretation if available */}
          {latestResult && (
            <View style={s.interpretBox}>
              <Text style={s.interpretTxt}>{latestResult.interpretation}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
  },
  header: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    justifyContent:    'space-between',
    padding:           spacing.lg,
    gap:               spacing.md,
  },
  headerLeft: { flex: 1, gap: spacing.xs },
  headerRight: { alignItems: 'flex-end', gap: spacing.xs },
  testName: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  badgeRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  confBadge:  { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 20 },
  confTxt:    { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  retestHint: { color: colors.textMuted, fontSize: FontSize.xs },
  ratingBadge:{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 20 },
  ratingTxt:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  noData:     { color: colors.textMuted, fontSize: FontSize.xs },
  chevron:    { color: colors.textDim, fontSize: FontSize.xs },

  desc: {
    color:             colors.textMuted,
    fontSize:          FontSize.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.md,
    lineHeight:        19,
  },

  resultRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.md,
    gap:               spacing.md,
  },
  resultItem:  { flex: 1, gap: 2 },
  resultLabel: { color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.5 },
  resultValue: { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  resultUnit:  { color: colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  retestBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    backgroundColor:   colors.primaryDim,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.primary,
  },
  retestTxt: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  noResultRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.md,
  },
  noResultTxt: { color: colors.textMuted, fontSize: FontSize.sm },
  testNowBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    backgroundColor:   colors.primaryDim,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.primary,
  },
  testNowTxt: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  inputSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.md,
    gap:               spacing.md,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    paddingTop:        spacing.md,
  },
  sidesRow: { flexDirection: 'row', gap: spacing.md },
  sideInput: { flex: 1 },
  inputActions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex:              1,
    paddingVertical:   spacing.sm,
    borderRadius:      Radius.sm,
    backgroundColor:   colors.border,
    alignItems:        'center',
  },
  cancelTxt: { color: colors.textMuted, fontSize: FontSize.sm },
  saveBtn: {
    flex:              2,
    paddingVertical:   spacing.sm,
    borderRadius:      Radius.sm,
    backgroundColor:   colors.primary,
    alignItems:        'center',
  },
  saveTxt: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  expandedBody: {
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    padding:           spacing.lg,
    gap:               spacing.sm,
  },
  expandLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    marginBottom:  spacing.xs,
  },
  stepRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum: {
    color:           colors.primary,
    fontSize:        FontSize.sm,
    fontWeight:      FontWeight.bold,
    width:           20,
    textAlign:       'center',
  },
  stepTxt: { flex: 1, color: colors.text, fontSize: FontSize.sm, lineHeight: 19 },

  normRow:  { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  normItem: {
    flex:              1,
    backgroundColor:   colors.bg,
    borderRadius:      Radius.sm,
    padding:           spacing.sm,
    gap:               2,
  },
  normLabel: { color: colors.textMuted, fontSize: 9, fontWeight: FontWeight.black, letterSpacing: 0.4 },
  normValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  evidenceBox: {
    marginTop:       spacing.md,
    backgroundColor: colors.bg,
    borderRadius:    Radius.sm,
    padding:         spacing.md,
    gap:             spacing.xs,
  },
  evidenceLabel: { color: colors.textMuted, fontSize: 9, fontWeight: FontWeight.black, letterSpacing: 0.4 },
  evidenceTxt:   { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },

  interpretBox: {
    marginTop:       spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft:     spacing.md,
  },
  interpretTxt: { color: colors.text, fontSize: FontSize.sm, lineHeight: 19 },
});
