// ─── Override / Acknowledgement Modal ────────────────────────────────────────
//
// Shown when the athlete chooses to train against a rest/reduce recommendation.
// Requires explicit acknowledgement before opening LogWorkoutModal.
// Stores OverrideRecord in customWorkoutStore for coaching trend analysis.
//
// Flow: readiness warning → checkbox acknowledge → optional reason → Confirm
//       → calls onConfirmed(overrideId) so parent can open LogWorkoutModal

import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMemo, useState } from 'react';

import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { CustomWorkoutCategory } from '../../types/customWorkout';

// ─── Props ────────────────────────────────────────────────────────────────────

export type OverrideModalProps = {
  visible:       boolean;
  onClose:       () => void;
  onConfirmed:   (overrideId: string) => void;   // ID of the created OverrideRecord
  fatigueScore:  number;
  recoveryScore: number;
  addOverride: (
    partial: {
      date:           string;
      acknowledged:   true;
      readinessScore: number;
      fatigueScore:   number;
      category:       CustomWorkoutCategory;
      reason?:        string;
    },
  ) => string;   // returns generated id from customWorkoutStore.addOverride
};

// ─── Readiness signal helpers ─────────────────────────────────────────────────

function readinessLabel(fatigue: number, recovery: number): string {
  if (fatigue > 75 || recovery < 35) return 'Very High Risk';
  if (fatigue > 60 || recovery < 50) return 'High Risk';
  return 'Elevated Risk';
}

function readinessColor(fatigue: number, recovery: number, colors: ThemeColors): string {
  if (fatigue > 75 || recovery < 35) return colors.critical;
  if (fatigue > 60 || recovery < 50) return colors.warning;
  return colors.warning;
}

function readinessMessage(fatigue: number, recovery: number): string {
  if (fatigue > 75) {
    return `Your fatigue score is ${fatigue}/100 — your body is carrying substantial training stress. Training hard now increases injury risk and delays recovery.`;
  }
  if (recovery < 35) {
    return `Your recovery score is ${recovery}/100 — your body has not adequately recovered from prior stress. Hard training in this state compounds fatigue without producing adaptation.`;
  }
  if (fatigue > 60) {
    return `Your fatigue score is ${fatigue}/100 and recovery is ${recovery}/100. The system recommends rest or easy work today. Proceed only if you have a specific training reason.`;
  }
  return `Current readiness signals suggest reduced training load today. Training at high intensity carries elevated injury and over-training risk.`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: CustomWorkoutCategory; label: string }[] = [
  { key: 'running',        label: 'Running'        },
  { key: 'strength',       label: 'Strength'       },
  { key: 'cross_training', label: 'Cross-training' },
  { key: 'mobility',       label: 'Mobility'       },
  { key: 'other',          label: 'Other'          },
];

export default function OverrideModal({
  visible, onClose, onConfirmed,
  fatigueScore, recoveryScore,
  addOverride,
}: OverrideModalProps) {
  const colors = useThemeColors();
  const s      = useMemo(() => createStyles(colors), [colors]);

  const [acknowledged, setAcknowledged] = useState(false);
  const [reason,       setReason]       = useState('');
  const [category,     setCategory]     = useState<CustomWorkoutCategory>('running');

  const riskLabel  = readinessLabel(fatigueScore, recoveryScore);
  const riskColor  = readinessColor(fatigueScore, recoveryScore, colors);
  const riskMsg    = readinessMessage(fatigueScore, recoveryScore);

  function handleConfirm() {
    if (!acknowledged) return;
    const today = new Date().toISOString().split('T')[0]!;
    const id = addOverride({
      date:           today,
      acknowledged:   true,
      readinessScore: recoveryScore,
      fatigueScore,
      category,
      reason:         reason.trim() || undefined,
    });
    resetForm();
    onConfirmed(id);
  }

  function resetForm() {
    setAcknowledged(false);
    setReason('');
    setCategory('running');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={handleClose}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
          <Text style={s.title}>Override Readiness</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Risk banner */}
          <View style={[s.riskBanner, { borderColor: riskColor }]}>
            <View style={[s.riskBadge, { backgroundColor: riskColor + '22' }]}>
              <Text style={[s.riskBadgeTxt, { color: riskColor }]}>{riskLabel}</Text>
            </View>
            <Text style={s.riskMsg}>{riskMsg}</Text>
          </View>

          {/* Readiness meters */}
          <View style={s.metersRow}>
            <View style={s.meter}>
              <Text style={s.meterLabel}>FATIGUE</Text>
              <Text style={[s.meterValue, { color: fatigueScore > 60 ? colors.critical : colors.warning }]}>
                {fatigueScore}
              </Text>
              <Text style={s.meterUnit}>/100</Text>
            </View>
            <View style={s.meterDivider} />
            <View style={s.meter}>
              <Text style={s.meterLabel}>RECOVERY</Text>
              <Text style={[s.meterValue, { color: recoveryScore < 50 ? colors.critical : colors.warning }]}>
                {recoveryScore}
              </Text>
              <Text style={s.meterUnit}>/100</Text>
            </View>
          </View>

          {/* Category */}
          <View style={s.section}>
            <Text style={s.sLabel}>TRAINING CATEGORY</Text>
            <View style={s.catGrid}>
              {CATEGORIES.map(c => (
                <Pressable
                  key={c.key}
                  style={[s.catBtn, category === c.key && s.catBtnActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={[s.catTxt, category === c.key && s.catTxtActive]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Reason */}
          <View style={s.section}>
            <Text style={s.sLabel}>REASON FOR TRAINING (OPTIONAL)</Text>
            <TextInput
              style={s.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. race tomorrow, travel constraints, specific training need"
              placeholderTextColor={colors.textSubtle}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={s.reasonHint}>This is stored for future coaching analysis.</Text>
          </View>

          {/* Acknowledgement checkbox */}
          <View style={s.section}>
            <Pressable style={s.checkRow} onPress={() => setAcknowledged(v => !v)}>
              <View style={[s.checkbox, acknowledged && s.checkboxChecked]}>
                {acknowledged && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.checkLabel}>
                I understand today's readiness risk and choose to train anyway.
              </Text>
            </Pressable>
          </View>

          {/* Confirm */}
          <View style={s.section}>
            <Pressable
              style={[s.confirmBtn, !acknowledged && s.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!acknowledged}
            >
              <Text style={[s.confirmTxt, !acknowledged && s.confirmTxtDisabled]}>
                Continue to Log Workout
              </Text>
            </Pressable>
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { color: colors.textMuted, fontSize: FontSize.base, width: 56 },
  title:  { color: colors.text,      fontSize: FontSize.base, fontWeight: FontWeight.bold },
  scroll: { flex: 1 },

  riskBanner: {
    margin:       spacing.lg,
    borderRadius: Radius.md,
    borderWidth:  1,
    padding:      spacing.lg,
    gap:          spacing.md,
    backgroundColor: colors.card,
  },
  riskBadge: {
    alignSelf:    'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius: 20,
  },
  riskBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  riskMsg:      { color: colors.text, fontSize: FontSize.sm, lineHeight: 20 },

  metersRow: {
    flexDirection:     'row',
    marginHorizontal:  spacing.lg,
    marginBottom:      spacing.md,
    backgroundColor:   colors.card,
    borderRadius:      Radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingVertical:   spacing.lg,
  },
  meter: { flex: 1, alignItems: 'center', gap: 2 },
  meterDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  meterLabel: { color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
  meterValue: { fontSize: FontSize.xxl,  fontWeight: FontWeight.black },
  meterUnit:  { color: colors.textMuted, fontSize: FontSize.xs },

  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  catBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      20,
    backgroundColor:   colors.card,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  catBtnActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  catTxt:       { color: colors.textDim, fontSize: FontSize.sm },
  catTxtActive: { color: colors.primary, fontWeight: FontWeight.bold },

  reasonInput: {
    backgroundColor:   colors.card,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.border,
    color:             colors.text,
    fontSize:          FontSize.sm,
    padding:           spacing.md,
    minHeight:         80,
  },
  reasonHint: { color: colors.textMuted, fontSize: FontSize.xs },

  checkRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.md,
  },
  checkbox: {
    width:           22,
    height:          22,
    borderRadius:    Radius.sm,
    borderWidth:     2,
    borderColor:     colors.textDim,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       2,
    flexShrink:      0,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.text, fontSize: 13, fontWeight: FontWeight.bold },
  checkLabel: { flex: 1, color: colors.text, fontSize: FontSize.sm, lineHeight: 20 },

  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius:    Radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  confirmBtnDisabled: { backgroundColor: colors.border },
  confirmTxt:         { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  confirmTxtDisabled: { color: colors.textDim },
  });
}
