import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAthleteStore } from '../../../src/store/athleteStore';

import ScreenLayout from '../../../src/layout/ScreenLayout';
import Card from '../../../src/components/ui/Card';
import FieldInput from '../../../src/components/ui/FieldInput';
import FieldStepper from '../../../src/components/ui/FieldStepper';
import FieldPicker from '../../../src/components/ui/FieldPicker';

import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight } from '../../../src/theme/tokens';
import type { ProgressionLevel } from '../../../src/types/training';

const PROGRESSION_OPTIONS: { value: ProgressionLevel; label: string }[] = [
  { value: 'beginner',     label: 'Beginner'     },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced'     },
];

const GOAL_RACE_OPTIONS = [
  'Sub 5 Marathon',
  'Half Marathon',
  '10K Race',
  '5K Race',
];

export default function ProfileScreen() {
  const {
    athleteName,
    goalRace,
    weeklyMileage,
    currentWeek,
    progressionLevel,
    sleepHours,
    restingHRDelta,
    setAthleteName,
    setGoalRace,
    setWeeklyMileage,
    setCurrentWeek,
    setProgressionLevel,
    setSleepHours,
    setRestingHRDelta,
  } = useAthleteStore();

  // Text fields use local state and commit to store on blur
  // to avoid triggering re-calculations on every keystroke.
  const [localName, setLocalName] = useState(athleteName);
  const [localRace, setLocalRace] = useState(goalRace);

  return (
    <ScreenLayout title="Profile">

      {/* ── Identity ─────────────────────────────── */}
      <SectionLabel label="Identity" />
      <Card>
        <View style={styles.fields}>
          <FieldInput
            label="Athlete Name"
            value={localName}
            onChange={setLocalName}
            onBlur={() => setAthleteName(localName.trim() || athleteName)}
            placeholder="Your name"
          />
          <FieldInput
            label="Goal Race"
            value={localRace}
            onChange={setLocalRace}
            onBlur={() => setGoalRace(localRace.trim() || goalRace)}
            placeholder="e.g. Sub 4 Marathon"
            autoCapitalize="words"
          />
        </View>
      </Card>

      {/* ── Training Plan ─────────────────────────── */}
      <SectionLabel label="Training Plan" />
      <Card>
        <View style={styles.fields}>
          <FieldStepper
            label="Weekly Mileage"
            display={`${weeklyMileage.toFixed(1)} mi`}
            onIncrease={() => setWeeklyMileage(+(weeklyMileage + 0.5).toFixed(1))}
            onDecrease={() => setWeeklyMileage(+(Math.max(5, weeklyMileage - 0.5)).toFixed(1))}
          />
          <FieldStepper
            label="Current Week"
            display={`Week ${currentWeek}`}
            onIncrease={() => setCurrentWeek(currentWeek + 1)}
            onDecrease={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
          />
          <FieldPicker
            label="Progression Level"
            value={progressionLevel}
            options={PROGRESSION_OPTIONS}
            onChange={setProgressionLevel}
          />
        </View>
      </Card>

      {/* ── Physiology ───────────────────────────── */}
      <SectionLabel label="Physiology" />
      <Card>
        <View style={styles.fields}>
          <FieldStepper
            label="Sleep Hours"
            display={`${sleepHours.toFixed(1)} hrs`}
            onIncrease={() => setSleepHours(+(Math.min(14, sleepHours + 0.5)).toFixed(1))}
            onDecrease={() => setSleepHours(+(Math.max(0, sleepHours - 0.5)).toFixed(1))}
          />
          <FieldStepper
            label="Resting HR Delta"
            display={`${restingHRDelta >= 0 ? '+' : ''}${restingHRDelta} bpm`}
            onIncrease={() => setRestingHRDelta(Math.min(30, restingHRDelta + 1))}
            onDecrease={() => setRestingHRDelta(Math.max(-10, restingHRDelta - 1))}
          />
        </View>
      </Card>

    </ScreenLayout>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  sectionLabel: {
    color:         colors.textDim,
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
    marginTop:     spacing.sm,
  },
  fields: {
    gap: spacing.xl,
  },
});
