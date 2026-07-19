import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import OnboardingShell from '../../src/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { colors }  from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';
import type { GoalType } from '../../src/store/onboardingStore';
import type { TrainingGoalType, RacePriority } from '../../src/types/plan';
import type { RaceDistance } from '../../src/types/training';
import { toYMD, parseYMD } from '../../src/utils/calendarEngine';
import { formatYMDForDisplay } from '../../src/utils/dateFormatting';
import MultiColumnPickerSheet from '../../src/components/ui/MultiColumnPickerSheet';

const GOAL_TYPES: { key: TrainingGoalType; label: string; desc: string }[] = [
  { key: 'general_running',  label: 'General Running',        desc: 'Build aerobic fitness and consistency — no race on the calendar.' },
  { key: 'general_strength', label: 'General Strength',       desc: 'Strength-first program, with running to support it.' },
  { key: 'race_prep',        label: 'Race Preparation',       desc: 'Train toward a specific race with a periodized build.' },
  { key: 'hybrid',           label: 'Hybrid — Run + Lift',    desc: 'Balance meaningful mileage with real strength work.' },
];

const RACE_DISTANCES: { key: RaceDistance; label: string }[] = [
  { key: '5k',            label: '5K' },
  { key: '10k',           label: '10K' },
  { key: 'half_marathon', label: 'Half Marathon' },
  { key: 'marathon',      label: 'Marathon' },
];

const PRIORITIES: { key: RacePriority; label: string }[] = [
  { key: 'A',        label: 'A — Goal Race' },
  { key: 'B',        label: 'B — Secondary' },
  { key: 'tune_up',  label: 'Tune-Up' },
];

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const YEARS = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() + index);

function partsFromYMD(value: string): { month: number; day: number; year: number } {
  const parsed = isValidYMD(value) ? parseYMD(value) : new Date();
  return {
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
    year: parsed.getFullYear(),
  };
}

function ymdFromParts(values: Record<string, string | number>): string {
  const month = Number(values.month);
  const day = Number(values.day);
  const year = Number(values.year);
  return toYMD(new Date(year, month - 1, day));
}

function isValidYMD(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseYMD(s);
  return !Number.isNaN(d.getTime());
}

function isTodayOrFuture(s: string): boolean {
  const d = parseYMD(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

// Maps the new plan-spine goal type to the legacy GoalType so downstream
// code that still reads onboardingData.primaryGoal keeps working.
function toLegacyGoal(goalType: TrainingGoalType, raceDistance: RaceDistance): GoalType {
  if (goalType === 'race_prep') return raceDistance;
  return 'general_fitness';
}

export default function GoalScreen() {
  const { data, updateData } = useOnboardingStore();
  const [selected, setSelected]   = useState<TrainingGoalType>(data.goalType);
  const [goalLabel, setGoalLabel] = useState(data.goalRaceLabel);

  const [raceName, setRaceName]         = useState(data.raceName);
  const [raceDistance, setRaceDistance] = useState<RaceDistance>(data.raceDistance);
  const [raceDate, setRaceDate]         = useState(data.raceDate);
  const [racePriority, setRacePriority] = useState<RacePriority>(data.racePriority);
  const [raceDateError, setRaceDateError] = useState('');
  const [raceNameError, setRaceNameError] = useState('');

  const [programStartDate, setProgramStartDate] = useState(data.programStartDate || toYMD(new Date()));
  const [startDateError, setStartDateError] = useState('');
  const [datePickerFor, setDatePickerFor] = useState<null | 'race' | 'start'>(null);

  function handleNext() {
    setRaceDateError('');
    setRaceNameError('');
    setStartDateError('');

    const startDate = programStartDate.trim();
    if (!isValidYMD(startDate)) {
      setStartDateError('Choose a valid date as MM-DD-YYYY.');
      return;
    }

    let raceDateFinal = '';
    if (selected === 'race_prep') {
      if (!raceName.trim()) {
        setRaceNameError('Give your race a name.');
        return;
      }
      if (!isValidYMD(raceDate)) {
        setRaceDateError('Choose a valid date as MM-DD-YYYY.');
        return;
      }
      if (!isTodayOrFuture(raceDate)) {
        setRaceDateError('Race date must be today or in the future.');
        return;
      }
      raceDateFinal = raceDate;
    }

    updateData({
      primaryGoal:      toLegacyGoal(selected, raceDistance),
      goalRaceLabel:    goalLabel,
      goalType:         selected,
      raceName:         selected === 'race_prep' ? raceName.trim() : '',
      raceDistance,
      raceDate:         raceDateFinal,
      racePriority,
      programStartDate: startDate,
    });
    router.push('/onboarding/experience');
  }

  return (
    <OnboardingShell
      step={1}
      title="What's your primary goal?"
      subtitle="We'll build your training system around this focus."
      onNext={handleNext}
      onBack={() => router.back()}
    >
      <View style={styles.goals}>
        {GOAL_TYPES.map(g => (
          <Pressable
            key={g.key}
            style={[styles.goal, selected === g.key && styles.goalActive]}
            onPress={() => setSelected(g.key)}
          >
            <Text style={[styles.goalLabel, selected === g.key && styles.goalLabelActive]}>
              {g.label}
            </Text>
            <Text style={styles.goalDesc}>{g.desc}</Text>
          </Pressable>
        ))}
      </View>

      {selected === 'race_prep' && (
        <View style={styles.raceSection}>
          <View style={styles.customRow}>
            <Text style={styles.customLabel}>RACE NAME</Text>
            <TextInput
              style={styles.input}
              value={raceName}
              onChangeText={setRaceName}
              placeholder="e.g. Portland Marathon"
              placeholderTextColor={colors.textSubtle}
            />
            {raceNameError ? <Text style={styles.errorText}>{raceNameError}</Text> : null}
          </View>

          <View style={styles.customRow}>
            <Text style={styles.customLabel}>DISTANCE</Text>
            <View style={styles.pillRow}>
              {RACE_DISTANCES.map(d => (
                <Pressable
                  key={d.key}
                  style={[styles.pill, raceDistance === d.key && styles.pillActive]}
                  onPress={() => setRaceDistance(d.key)}
                >
                  <Text style={[styles.pillText, raceDistance === d.key && styles.pillTextActive]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.customRow}>
            <Text style={styles.customLabel}>RACE DATE (MM-DD-YYYY)</Text>
            <Pressable
              style={styles.dateButton}
              onPress={() => setDatePickerFor('race')}
              accessibilityRole="button"
              accessibilityLabel="Choose race date"
            >
              <Text style={styles.dateText}>{formatYMDForDisplay(raceDate) || formatYMDForDisplay(toYMD(new Date()))}</Text>
            </Pressable>
            {raceDateError ? <Text style={styles.errorText}>{raceDateError}</Text> : null}
          </View>

          <View style={styles.customRow}>
            <Text style={styles.customLabel}>PRIORITY</Text>
            <View style={styles.pillRow}>
              {PRIORITIES.map(p => (
                <Pressable
                  key={p.key}
                  style={[styles.pill, racePriority === p.key && styles.pillActive]}
                  onPress={() => setRacePriority(p.key)}
                >
                  <Text style={[styles.pillText, racePriority === p.key && styles.pillTextActive]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {selected !== 'race_prep' && (
        <View style={styles.customRow}>
          <Text style={styles.customLabel}>GOAL RACE OR MILESTONE (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={goalLabel}
            onChangeText={setGoalLabel}
            placeholder="e.g. Sub 4-hour marathon, Spring 5K PR"
            placeholderTextColor={colors.textSubtle}
          />
        </View>
      )}

      <View style={styles.customRow}>
        <Text style={styles.customLabel}>PROGRAM START DATE</Text>
        <Pressable
          style={styles.dateButton}
          onPress={() => setDatePickerFor('start')}
          accessibilityRole="button"
          accessibilityLabel="Choose program start date"
        >
          <Text style={styles.dateText}>{formatYMDForDisplay(programStartDate)}</Text>
        </Pressable>
        {startDateError ? <Text style={styles.errorText}>{startDateError}</Text> : null}
        <Text style={styles.note}>Defaults to today. Set a future date if you want your plan to start later.</Text>
      </View>

      <MultiColumnPickerSheet
        visible={datePickerFor !== null}
        title={datePickerFor === 'race' ? 'Race Date' : 'Program Start Date'}
        columns={(() => {
          const selectedDate = datePickerFor === 'race' ? raceDate || toYMD(new Date()) : programStartDate;
          const parts = partsFromYMD(selectedDate);
          return [
            { key: 'month', title: 'Month', values: MONTHS, selectedValue: parts.month, formatValue: value => String(value).padStart(2, '0') },
            { key: 'day', title: 'Day', values: DAYS, selectedValue: parts.day, formatValue: value => String(value).padStart(2, '0') },
            { key: 'year', title: 'Year', values: YEARS, selectedValue: parts.year },
          ];
        })()}
        onClose={() => setDatePickerFor(null)}
        onConfirm={values => {
          const next = ymdFromParts(values);
          if (datePickerFor === 'race') setRaceDate(next);
          if (datePickerFor === 'start') setProgramStartDate(next);
          setDatePickerFor(null);
        }}
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  goals: {
    gap: spacing.sm,
  },
  goal: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             2,
  },
  goalActive: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  goalLabel: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  goalLabelActive: {
    color: colors.primary,
  },
  goalDesc: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  raceSection: {
    gap: spacing.md,
  },
  customRow: {
    gap: spacing.xs,
  },
  customLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.base,
    padding:         spacing.md,
  },
  dateButton: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    minHeight:       52,
    justifyContent:  'center',
    padding:         spacing.md,
  },
  dateText: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  note: {
    color:    colors.textSubtle,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  errorText: {
    color:    colors.critical,
    fontSize: FontSize.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      Radius.sm,
    backgroundColor:   colors.border,
  },
  pillActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  pillText: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  pillTextActive: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
});
