import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '../ui/Button';
import FieldStepper from '../ui/FieldStepper';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';

export type WorkoutLogData = {
  actualDurationMinutes: number;
  actualDistanceMiles:   number;
  rpe:                   number;
  notes:                 string;
};

type Props = {
  plannedDurationMinutes: number;
  plannedDistanceMiles:   number;
  onSave:                 (data: WorkoutLogData) => void;
  onCancel:               () => void;
};

export default function WorkoutLogForm({
  plannedDurationMinutes,
  plannedDistanceMiles,
  onSave,
  onCancel,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [duration, setDuration] = useState(plannedDurationMinutes);
  const [distance, setDistance] = useState(
    parseFloat(plannedDistanceMiles.toFixed(1)),
  );
  const [rpe,   setRpe]   = useState(5);
  const [notes, setNotes] = useState('');

  const distStr   = distance.toFixed(1);
  const durationStr = `${duration} min`;
  const rpeStr    = `${rpe} / 10`;

  function handleSave() {
    onSave({ actualDurationMinutes: duration, actualDistanceMiles: distance, rpe, notes });
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Log Workout</Text>
      <Text style={styles.subheading}>How did the session actually go?</Text>

      <View style={styles.field}>
        <FieldStepper
          label="Actual Duration"
          display={durationStr}
          onIncrease={() => setDuration(d => Math.min(300, d + 5))}
          onDecrease={() => setDuration(d => Math.max(5,   d - 5))}
        />
      </View>

      <View style={styles.field}>
        <FieldStepper
          label="Actual Distance (mi)"
          display={distStr}
          onIncrease={() => setDistance(d => parseFloat((d + 0.1).toFixed(1)))}
          onDecrease={() => setDistance(d => parseFloat((Math.max(0, d - 0.1)).toFixed(1)))}
        />
      </View>

      <View style={styles.field}>
        <FieldStepper
          label="Perceived Effort (RPE)"
          display={rpeStr}
          onIncrease={() => setRpe(r => Math.min(10, r + 1))}
          onDecrease={() => setRpe(r => Math.max(1,  r - 1))}
        />
        <Text style={styles.rpeHint}>
          {rpe <= 3 ? 'Very easy — barely breaking a sweat' :
           rpe <= 5 ? 'Moderate — controlled and sustainable' :
           rpe <= 7 ? 'Hard — pushing but manageable' :
           rpe <= 9 ? 'Very hard — at your limit' :
           'Maximal — all-out effort'}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.inputLabel}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it feel? Any issues?"
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={3}
          style={styles.notesInput}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.actions}>
        <Button label="Save Workout" onPress={handleSave} />
        <Button label="Cancel" onPress={onCancel} variant="secondary" style={{ marginTop: spacing.sm }} />
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
  },
  heading: {
    color:        colors.text,
    fontSize:     24,
    fontWeight:   FontWeight.black,
    marginBottom: spacing.xs,
  },
  subheading: {
    color:        colors.textMuted,
    fontSize:     FontSize.base,
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.xl,
  },
  rpeHint: {
    color:     colors.textDim,
    fontSize:  FontSize.sm,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  inputLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  notesInput: {
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    color:             colors.text,
    fontSize:          FontSize.base,
    fontWeight:        FontWeight.medium,
    textAlignVertical: 'top',
    minHeight:         80,
  },
  actions: {
    marginTop: spacing.xl,
  },
  });
}
