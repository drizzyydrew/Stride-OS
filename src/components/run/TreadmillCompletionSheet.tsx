// ─── Treadmill Completion Correction Sheet ───────────────────────────────────
//
// Shown when ending an indoor/treadmill run. Lets the athlete reconcile
// StrideOS's confirmed-speed distance estimate against what the treadmill's
// own display showed, or enter a different value outright. The original
// estimate is always preserved (see resolveFinalDistance in treadmill.ts).

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { DistanceSource } from '../../types/activity';
import type { FinalDistanceChoice, FinalDistanceResult } from '../../utils/treadmill';
import { resolveFinalDistance } from '../../utils/treadmill';
import { milesToKm } from '../../utils/units';

export type TreadmillCompletionSheetProps = {
  visible: boolean;
  estimateMiles: number;
  // 'confirmed_speed_estimate' when at least one speed was confirmed during
  // the run; 'prescribed_estimate' when the estimate falls back to the
  // planned pace/duration because the athlete never confirmed a speed.
  estimateSource?: DistanceSource;
  imperial: boolean;
  onCancel: () => void;
  onResolve: (result: FinalDistanceResult) => void;
};

export default function TreadmillCompletionSheet({
  visible,
  estimateMiles,
  estimateSource = 'confirmed_speed_estimate',
  imperial,
  onCancel,
  onResolve,
}: TreadmillCompletionSheetProps) {
  const C = useColors();
  const [choice, setChoice] = useState<FinalDistanceChoice>('use_estimate');
  const [displayInput, setDisplayInput] = useState('');
  const unit = imperial ? 'mi' : 'km';
  const estimateDisplay = imperial ? estimateMiles : (milesToKm(estimateMiles) ?? 0);

  function toMiles(displayValue: number): number {
    return imperial ? displayValue : displayValue / 1.609344;
  }

  function submit() {
    if (choice === 'use_estimate') {
      onResolve(resolveFinalDistance({ estimateMiles, choice: 'use_estimate', estimateSource }));
      return;
    }
    const parsed = parseFloat(displayInput);
    const enteredMiles = Number.isFinite(parsed) && parsed > 0 ? toMiles(parsed) : null;
    onResolve(resolveFinalDistance({ estimateMiles, enteredMiles, choice, estimateSource }));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.title, { color: C.text }]}>Confirm treadmill distance</Text>
          <Text style={[s.copy, { color: C.textMuted }]}>
            {estimateSource === 'prescribed_estimate'
              ? `You never confirmed a speed, so StrideOS estimated ${estimateDisplay.toFixed(2)} ${unit} from the planned pace and duration instead. Use that, or enter what the treadmill display showed.`
              : `StrideOS estimated ${estimateDisplay.toFixed(2)} ${unit} from your confirmed speed changes. Use that, or enter what the treadmill display showed.`}
          </Text>

          <Pressable
            style={[s.option, { borderColor: choice === 'use_estimate' ? C.primary : C.border, backgroundColor: choice === 'use_estimate' ? C.primaryDim : C.cardAlt }]}
            onPress={() => setChoice('use_estimate')}
          >
            <Text style={[s.optionTitle, { color: C.text }]}>Use StrideOS estimate</Text>
            <Text style={[s.optionValue, { color: C.textMuted }]}>{estimateDisplay.toFixed(2)} {unit}</Text>
          </Pressable>

          <Pressable
            style={[s.option, { borderColor: choice === 'use_display' ? C.primary : C.border, backgroundColor: choice === 'use_display' ? C.primaryDim : C.cardAlt }]}
            onPress={() => setChoice('use_display')}
          >
            <Text style={[s.optionTitle, { color: C.text }]}>Use treadmill display</Text>
            {choice === 'use_display' ? (
              <TextInput
                style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.card }]}
                value={displayInput}
                onChangeText={setDisplayInput}
                keyboardType="decimal-pad"
                placeholder={`Distance shown (${unit})`}
                placeholderTextColor={C.textMuted}
                autoFocus
              />
            ) : (
              <Text style={[s.optionValue, { color: C.textMuted }]}>Enter what the machine showed</Text>
            )}
          </Pressable>

          <Pressable
            style={[s.option, { borderColor: choice === 'manual_entry' ? C.primary : C.border, backgroundColor: choice === 'manual_entry' ? C.primaryDim : C.cardAlt }]}
            onPress={() => setChoice('manual_entry')}
          >
            <Text style={[s.optionTitle, { color: C.text }]}>Enter another value</Text>
            {choice === 'manual_entry' ? (
              <TextInput
                style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.card }]}
                value={displayInput}
                onChangeText={setDisplayInput}
                keyboardType="decimal-pad"
                placeholder={`Distance (${unit})`}
                placeholderTextColor={C.textMuted}
                autoFocus
              />
            ) : (
              <Text style={[s.optionValue, { color: C.textMuted }]}>Type a different distance</Text>
            )}
          </Pressable>

          <View style={s.actions}>
            <Pressable style={[s.btn, { backgroundColor: C.cardAlt }]} onPress={onCancel}>
              <Text style={[s.btnText, { color: C.text }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[s.btn, { backgroundColor: C.primary }]} onPress={submit}>
              <Text style={[s.btnText, { color: C.onPrimary }]}>Save Run</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  copy: { fontSize: FontSize.sm, lineHeight: 18 },
  option: { borderWidth: 1, borderRadius: Radius.md, padding: spacing.sm, gap: 4 },
  optionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  optionValue: { fontSize: FontSize.sm },
  input: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, fontSize: FontSize.base, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, borderRadius: Radius.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  btnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
