// ─── Treadmill Live Panel ────────────────────────────────────────────────────
//
// Rendered by the primary Running tab (training/index.tsx) instead of the
// map/GPS stats whenever environment === 'indoor' and a run is active. No
// GPS, no map, no route — distance is estimated from confirmed treadmill
// speed segments (src/utils/treadmill.ts), correctable at completion.

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { RichWorkout } from '../../types/workout';
import type { DistanceSource } from '../../types/activity';
import { estimateDistanceMiles, type TreadmillSegment } from '../../utils/treadmill';
import { flattenWorkoutSteps, totalRemainingMinutes, clampStepIndex } from '../../utils/workoutSteps';
import {
  formatPaceSec,
  formatSpeed,
  kmhToMph,
  milesToKm,
  mphToKmh,
  paceSecPerMileToSecPerKm,
  paceToSpeedPerUnit,
  speedToPaceSecPerUnit,
} from '../../utils/units';

export type TreadmillPanelProps = {
  elapsedLabel: string;
  imperial: boolean;
  plannedWorkout: RichWorkout | null;
  currentStepIndex: number;
  onAdvanceStep: () => void;
  segments: TreadmillSegment[];
  currentSpeedMph: number | null;
  manualDistanceMiles: number | null;
  distanceSource: DistanceSource | null;
  onConfirmSpeed: (mph: number) => void;
  onSetManualDistance: (miles: number) => void;
  heartRateBpm: number | null;
  zoneLabel: string;
  zoneDetail: string;
  zoneTone: 'in' | 'near' | 'out' | 'unknown';
  isPaused: boolean;
};

export default function TreadmillPanel({
  elapsedLabel,
  imperial,
  plannedWorkout,
  currentStepIndex,
  onAdvanceStep,
  segments,
  currentSpeedMph,
  manualDistanceMiles,
  distanceSource,
  onConfirmSpeed,
  onSetManualDistance,
  heartRateBpm,
  zoneLabel,
  zoneDetail,
  zoneTone,
  isPaused,
}: TreadmillPanelProps) {
  const C = useColors();
  const [now, setNow] = useState(() => Date.now());
  const [speedModalOpen, setSpeedModalOpen] = useState(false);
  const [speedInput, setSpeedInput] = useState('');
  const [distanceModalOpen, setDistanceModalOpen] = useState(false);
  const [distanceInput, setDistanceInput] = useState('');

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const estimateMiles = estimateDistanceMiles(segments, now);
  const usingManual = distanceSource === 'manual_entry' && manualDistanceMiles != null;
  const liveDistanceMiles = usingManual ? (manualDistanceMiles as number) : estimateMiles;
  const distanceDisplay = imperial ? liveDistanceMiles : (milesToKm(liveDistanceMiles) ?? 0);
  const distUnit = imperial ? 'mi' : 'km';

  const steps = plannedWorkout ? flattenWorkoutSteps(plannedWorkout) : [];
  const stepIndex = clampStepIndex(steps, currentStepIndex);
  const currentStep = steps[stepIndex] ?? null;
  const remainingMinutes = steps.length ? totalRemainingMinutes(steps, stepIndex) : null;

  // Target pace comes from the same paceRange already shown elsewhere for
  // this workout — never fabricated per-step. Speed is derived from it.
  const paceRange = plannedWorkout?.paceRange ?? null;
  const targetPaceMinSec = paceRange ? (imperial ? paceRange.minSecPerMi : paceSecPerMileToSecPerKm(paceRange.minSecPerMi)) : null;
  const targetPaceMaxSec = paceRange ? (imperial ? paceRange.maxSecPerMi : paceSecPerMileToSecPerKm(paceRange.maxSecPerMi)) : null;
  const targetSpeedMin = paceRange ? paceToSpeedPerUnit(imperial ? paceRange.maxSecPerMi : (paceSecPerMileToSecPerKm(paceRange.maxSecPerMi) ?? 0)) : null;
  const targetSpeedMax = paceRange ? paceToSpeedPerUnit(imperial ? paceRange.minSecPerMi : (paceSecPerMileToSecPerKm(paceRange.minSecPerMi) ?? 0)) : null;

  const currentSpeedDisplay = currentSpeedMph == null
    ? null
    : imperial ? currentSpeedMph : mphToKmh(currentSpeedMph);
  const currentPaceSec = currentSpeedMph == null ? null : speedToPaceSecPerUnit(imperial ? currentSpeedMph : (mphToKmh(currentSpeedMph) ?? 0));

  function openSpeedModal() {
    setSpeedInput(currentSpeedDisplay != null ? String(Math.round(currentSpeedDisplay * 10) / 10) : '');
    setSpeedModalOpen(true);
  }

  function confirmSpeed() {
    const parsed = parseFloat(speedInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setSpeedModalOpen(false);
      return;
    }
    const mph = imperial ? parsed : (kmhToMph(parsed) ?? 0);
    onConfirmSpeed(mph);
    setSpeedModalOpen(false);
  }

  function openDistanceModal() {
    setDistanceInput(distanceDisplay > 0 ? String(Math.round(distanceDisplay * 100) / 100) : '');
    setDistanceModalOpen(true);
  }

  function confirmDistance() {
    const parsed = parseFloat(distanceInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDistanceModalOpen(false);
      return;
    }
    const miles = imperial ? parsed : (parsed / 1.609344);
    onSetManualDistance(miles);
    setDistanceModalOpen(false);
  }

  return (
    <View style={[s.root, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
      <View style={s.headerRow}>
        <Ionicons name="walk-outline" size={16} color={C.textMuted} />
        <Text style={[s.headerLabel, { color: C.textDim }]}>TREADMILL · INDOOR</Text>
      </View>

      <View style={s.primaryRow}>
        <View>
          <Text style={[s.primaryValue, { color: C.text }]}>{elapsedLabel}</Text>
          <Text style={[s.metricLabel, { color: C.textMuted }]}>Time</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.primaryValue, { color: C.accent }]}>
            {distanceDisplay.toFixed(2)}<Text style={s.primaryUnit}> {distUnit}</Text>
          </Text>
          <Text style={[s.metricLabel, { color: C.textMuted }]}>
            {usingManual ? 'Manual distance' : 'Estimated (confirmed speed)'}
          </Text>
        </View>
      </View>

      {currentStep ? (
        <View style={[s.stepCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.stepHeaderRow}>
            <Text style={[s.stepLabel, { color: C.text }]}>{currentStep.label}</Text>
            <Text style={[s.stepCount, { color: C.textMuted }]}>{stepIndex + 1}/{steps.length}</Text>
          </View>
          <Text style={[s.stepInstructions, { color: C.textSubtle }]} numberOfLines={2}>{currentStep.instructions}</Text>
          <View style={s.stepMetaRow}>
            <Text style={[s.stepMeta, { color: C.textMuted }]}>
              {currentStep.durationMinutes != null ? `${currentStep.durationMinutes} min` : 'Duration varies'}
            </Text>
            {remainingMinutes != null ? (
              <Text style={[s.stepMeta, { color: C.textMuted }]}>{remainingMinutes} min remaining</Text>
            ) : null}
          </View>
          {stepIndex < steps.length - 1 ? (
            <Pressable style={[s.smallBtn, { borderColor: C.border }]} onPress={onAdvanceStep} accessibilityRole="button" accessibilityLabel="Advance to next workout step">
              <Text style={[s.smallBtnText, { color: C.text }]}>Next Step</Text>
              <Ionicons name="chevron-forward" size={14} color={C.text} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {paceRange ? (
        <View style={s.targetRow}>
          <View>
            <Text style={[s.metricLabel, { color: C.textMuted }]}>TARGET PACE</Text>
            <Text style={[s.targetValue, { color: C.text }]}>
              {formatPaceSec(targetPaceMaxSec)}–{formatPaceSec(targetPaceMinSec)} {imperial ? '/mi' : '/km'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.metricLabel, { color: C.textMuted }]}>TARGET SPEED</Text>
            <Text style={[s.targetValue, { color: C.text }]}>
              {formatSpeed(targetSpeedMin)}–{formatSpeed(targetSpeedMax)} {imperial ? 'mph' : 'km/h'}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={[s.speedCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <View>
          <Text style={[s.metricLabel, { color: C.textMuted }]}>CURRENT SPEED</Text>
          <Text style={[s.speedValue, { color: C.text }]}>
            {currentSpeedDisplay != null ? formatSpeed(currentSpeedDisplay) : '--'} {imperial ? 'mph' : 'km/h'}
          </Text>
          <Text style={[s.stepMeta, { color: C.textMuted }]}>
            {currentPaceSec != null ? `${formatPaceSec(currentPaceSec)} ${imperial ? '/mi' : '/km'}` : 'Not confirmed yet'}
          </Text>
        </View>
        <Pressable
          style={[s.confirmBtn, { backgroundColor: C.primary }]}
          onPress={openSpeedModal}
          accessibilityRole="button"
          accessibilityLabel="Confirm or adjust treadmill speed"
        >
          <Text style={[s.confirmBtnText, { color: C.onPrimary }]}>{currentSpeedMph == null ? 'Confirm Speed' : 'Speed Changed?'}</Text>
        </Pressable>
      </View>

      <Pressable style={[s.manualDistanceRow, { borderColor: C.border }]} onPress={openDistanceModal} accessibilityRole="button" accessibilityLabel="Enter live distance manually">
        <Text style={[s.smallBtnText, { color: C.textMuted }]}>Enter distance manually</Text>
        <Ionicons name="create-outline" size={14} color={C.textMuted} />
      </Pressable>

      {heartRateBpm ? (
        <View style={[s.statusChip, { backgroundColor: zoneTone === 'in' ? C.positive + '22' : zoneTone === 'near' ? C.warning + '22' : zoneTone === 'out' ? C.critical + '22' : C.cardAlt, borderColor: zoneTone === 'in' ? C.positive : zoneTone === 'near' ? C.warning : zoneTone === 'out' ? C.critical : C.border }]}>
          <Text style={[s.statusChipText, { color: C.text }]}>{heartRateBpm} bpm · {zoneLabel} · {zoneDetail}</Text>
        </View>
      ) : null}

      {/* Speed confirm/adjust modal */}
      <Modal visible={speedModalOpen} transparent animationType="fade" onRequestClose={() => setSpeedModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.modalTitle, { color: C.text }]}>Confirm treadmill speed</Text>
            <Text style={[s.modalCopy, { color: C.textMuted }]}>
              Enter the speed shown on the treadmill display ({imperial ? 'mph' : 'km/h'}).
            </Text>
            <TextInput
              style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.cardAlt }]}
              value={speedInput}
              onChangeText={setSpeedInput}
              keyboardType="decimal-pad"
              placeholder={imperial ? 'e.g. 6.0' : 'e.g. 9.7'}
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <View style={s.modalActions}>
              <Pressable style={[s.modalBtn, { backgroundColor: C.cardAlt }]} onPress={() => setSpeedModalOpen(false)}>
                <Text style={[s.modalBtnText, { color: C.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, { backgroundColor: C.primary }]} onPress={confirmSpeed}>
                <Text style={[s.modalBtnText, { color: C.onPrimary }]}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual distance entry modal */}
      <Modal visible={distanceModalOpen} transparent animationType="fade" onRequestClose={() => setDistanceModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.modalTitle, { color: C.text }]}>Enter live distance</Text>
            <Text style={[s.modalCopy, { color: C.textMuted }]}>
              Overrides the confirmed-speed estimate with a manual reading ({distUnit}).
            </Text>
            <TextInput
              style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.cardAlt }]}
              value={distanceInput}
              onChangeText={setDistanceInput}
              keyboardType="decimal-pad"
              placeholder={`e.g. ${imperial ? '2.10' : '3.40'}`}
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <View style={s.modalActions}>
              <Pressable style={[s.modalBtn, { backgroundColor: C.cardAlt }]} onPress={() => setDistanceModalOpen(false)}>
                <Text style={[s.modalBtnText, { color: C.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, { backgroundColor: C.primary }]} onPress={confirmDistance}>
                <Text style={[s.modalBtnText, { color: C.onPrimary }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { borderRadius: Radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
  primaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  primaryValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.black },
  primaryUnit: { fontSize: FontSize.sm, fontWeight: '400' as any },
  metricLabel: { fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.4 },
  stepCard: { borderRadius: Radius.md, borderWidth: 1, padding: spacing.sm, gap: 6 },
  stepHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  stepCount: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  stepInstructions: { fontSize: FontSize.sm },
  stepMetaRow: { flexDirection: 'row', gap: spacing.sm },
  stepMeta: { fontSize: FontSize.xs },
  smallBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 6, marginTop: 2 },
  smallBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between' },
  targetValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  speedCard: { borderRadius: Radius.md, borderWidth: 1, padding: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  speedValue: { fontSize: FontSize.xl, fontWeight: FontWeight.black },
  confirmBtn: { borderRadius: Radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  confirmBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  manualDistanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: spacing.xs },
  statusChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: Radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalCopy: { fontSize: FontSize.sm },
  input: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: FontSize.lg },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalBtn: { flex: 1, borderRadius: Radius.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  modalBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
