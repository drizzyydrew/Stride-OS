import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import Button from '../ui/Button';
import FieldStepper from '../ui/FieldStepper';
import NumericRating from '../ui/NumericRating';

import { useAthleteStore } from '../../store/athleteStore';
import { useCheckInStore } from '../../store/checkInStore';

import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';

export default function PreCheckInCard() {
  const { sleepHours, restingHRDelta, setSleepHours, setRestingHRDelta } = useAthleteStore();
  const { submitPreCheckIn } = useCheckInStore();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Pre-populate from stored athlete values so the user is adjusting, not re-entering.
  const [sleep,      setSleep]      = useState(sleepHours);
  const [hrDelta,    setHrDelta]    = useState(restingHRDelta);
  const [soreness,   setSoreness]   = useState(3);
  const [motivation, setMotivation] = useState(7);

  function handleSubmit() {
    // Write sleep + HR to athleteStore — triggers recalculateRecovery immediately.
    setSleepHours(sleep);
    setRestingHRDelta(hrDelta);
    // Persist check-in data (soreness + motivation stay local to checkInStore).
    submitPreCheckIn({ sleepHours: sleep, hrDelta, soreness, motivation });
  }

  return (
    <Card>
      <Text style={styles.title}>Morning Check-in</Text>
      <Text style={styles.subtitle}>How are you feeling today?</Text>

      <View style={styles.stepperGroup}>
        <FieldStepper
          label="Sleep Last Night"
          display={`${sleep.toFixed(1)} hrs`}
          onIncrease={() => setSleep(v => Math.min(12, v + 0.5))}
          onDecrease={() => setSleep(v => Math.max(0,  v - 0.5))}
        />

        <View style={styles.divider} />

        <FieldStepper
          label="Resting HR Delta"
          display={hrDelta === 0 ? 'Normal' : `+${hrDelta} bpm`}
          onIncrease={() => setHrDelta(v => Math.min(20, v + 1))}
          onDecrease={() => setHrDelta(v => Math.max(0,  v - 1))}
        />
      </View>

      <View style={styles.ratingGroup}>
        <Text style={styles.ratingLabel}>Soreness</Text>
        <NumericRating
          value={soreness}
          onChange={setSoreness}
          color={soreness >= 7 ? colors.critical : soreness >= 4 ? colors.warning : colors.positive}
        />
        <Text style={styles.ratingHint}>1 = fresh  ·  10 = very sore</Text>
      </View>

      <View style={styles.ratingGroup}>
        <Text style={styles.ratingLabel}>Motivation</Text>
        <NumericRating
          value={motivation}
          onChange={setMotivation}
          color={motivation >= 7 ? colors.positive : motivation >= 4 ? colors.warning : colors.critical}
        />
        <Text style={styles.ratingHint}>1 = dreading it  ·  10 = fired up</Text>
      </View>

      <Button
        label="Ready to Train"
        onPress={handleSubmit}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  stepperGroup: {
    gap:          spacing.lg,
    marginBottom: spacing.xl,
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
  },
  ratingGroup: {
    marginBottom: spacing.lg,
  },
  ratingLabel: {
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
  });
}
