import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '../ui/Button';
import NumericRating from '../ui/NumericRating';
import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { typographyTokens } from '../../theme/tokens';
import { useReadinessStore } from '../../store/readinessStore';
import type { ReadinessInputs } from '../../types/readiness';

type Colors = ReturnType<typeof useColors>;

const DEFAULT_INPUTS: ReadinessInputs = {
  sleepQuality:        3,
  energy:              3,
  stress:              3,
  soreness:            3,
  motivation:          3,
  trainingWillingness: 3,
};

// Color ramps for "higher is better" vs. "higher is worse" inputs, on the 1-5 scale.
function goodColor(value: number, C: Colors): string {
  if (value >= 4) return C.positive;
  if (value >= 3) return C.warning;
  return C.critical;
}

function badColor(value: number, C: Colors): string {
  if (value <= 2) return C.positive;
  if (value <= 3) return C.warning;
  return C.critical;
}

function Row({
  label, value, onChange, color, C,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  C: Colors;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: C.textDim }]}>{label}</Text>
      <NumericRating value={value} onChange={onChange} min={1} max={5} color={color} />
    </View>
  );
}

type Props = {
  initialValues?: ReadinessInputs;
  onSaved?:       () => void;
};

export default function ReadinessCheckInCard({ initialValues, onSaved }: Props) {
  const C = useColors();
  const submitReadiness = useReadinessStore(s => s.submitReadiness);
  const [inputs, setInputs] = useState<ReadinessInputs>(initialValues ?? DEFAULT_INPUTS);

  function update<K extends keyof ReadinessInputs>(key: K, value: number) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    submitReadiness(inputs);
    onSaved?.();
  }

  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[styles.title, { color: C.text }]}>Daily Check-In</Text>
      <Text style={[styles.subtitle, { color: C.textMuted }]}>How are you feeling today?</Text>

      <View style={styles.rows}>
        <Row label="Sleep Quality" C={C}
          value={inputs.sleepQuality} onChange={v => update('sleepQuality', v)}
          color={goodColor(inputs.sleepQuality, C)} />
        <Row label="Energy" C={C}
          value={inputs.energy} onChange={v => update('energy', v)}
          color={goodColor(inputs.energy, C)} />
        <Row label="Stress" C={C}
          value={inputs.stress} onChange={v => update('stress', v)}
          color={badColor(inputs.stress, C)} />
        <Row label="Muscle Soreness" C={C}
          value={inputs.soreness} onChange={v => update('soreness', v)}
          color={badColor(inputs.soreness, C)} />
        <Row label="Motivation" C={C}
          value={inputs.motivation} onChange={v => update('motivation', v)}
          color={goodColor(inputs.motivation, C)} />
        <Row label="Training Willingness" C={C}
          value={inputs.trainingWillingness} onChange={v => update('trainingWillingness', v)}
          color={goodColor(inputs.trainingWillingness, C)} />
      </View>

      <Button label="Save Check-In" onPress={handleSave} style={{ marginTop: spacing.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth:  1,
    padding:      16,
    marginBottom: 16,
  },
  title: {
    fontSize:     typographyTokens.sizes.cardTitle,
    fontWeight:   typographyTokens.weights.bold,
    marginBottom: 2,
  },
  subtitle: {
    fontSize:     typographyTokens.sizes.helper,
    marginBottom: spacing.lg,
  },
  rows: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
  rowLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
