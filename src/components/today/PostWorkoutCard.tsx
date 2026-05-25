import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import Card from '../ui/Card';
import Button from '../ui/Button';
import NumericRating from '../ui/NumericRating';

import { useCheckInStore } from '../../store/checkInStore';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';

type Props = {
  completionKey: string;
};

export default function PostWorkoutCard({ completionKey }: Props) {
  const { submitPostWorkout, getPostWorkoutNote } = useCheckInStore();

  const existing = getPostWorkoutNote(completionKey);

  const [rpe,   setRpe]   = useState(existing?.rpe   ?? 6);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  // Once saved, show a locked summary view.
  if (existing) {
    return (
      <Card>
        <Text style={styles.title}>Workout Log</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryValue}>{existing.rpe}</Text>
            <Text style={styles.summaryLabel}>RPE</Text>
          </View>
          {existing.notes.length > 0 && (
            <Text style={styles.summaryNotes} numberOfLines={3}>
              {existing.notes}
            </Text>
          )}
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.title}>Post-Workout</Text>
      <Text style={styles.subtitle}>How did it go?</Text>

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Rate of Perceived Exertion</Text>
        <NumericRating
          value={rpe}
          onChange={setRpe}
          color={rpe >= 8 ? colors.critical : rpe >= 5 ? colors.warning : colors.positive}
        />
        <Text style={styles.ratingHint}>1 = very easy  ·  10 = maximum effort</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it feel? Any issues?"
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={3}
          autoCapitalize="sentences"
          returnKeyType="default"
          style={styles.notesInput}
        />
      </View>

      <Button
        label="Save Log"
        onPress={() => submitPostWorkout(completionKey, rpe, notes)}
        style={{ marginTop: spacing.xs }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color:        colors.text,
    fontSize:     FontSize.xl,
    fontWeight:   FontWeight.black,
    marginBottom: 4,
  },
  subtitle: {
    color:        colors.textDim,
    fontSize:     FontSize.sm,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  ratingHint: {
    color:     colors.textSubtle,
    fontSize:  10,
    marginTop: spacing.xs,
  },
  notesInput: {
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    color:             colors.text,
    fontSize:          FontSize.base,
    minHeight:         80,
    textAlignVertical: 'top',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.lg,
  },
  summaryMetric: {
    alignItems: 'center',
    minWidth:   56,
  },
  summaryValue: {
    color:      colors.text,
    fontSize:   36,
    fontWeight: FontWeight.black,
    lineHeight: 40,
  },
  summaryLabel: {
    color:         colors.textDim,
    fontSize:      10,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop:     2,
  },
  summaryNotes: {
    flex:       1,
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    lineHeight: 20,
    paddingTop: spacing.xs,
  },
});
