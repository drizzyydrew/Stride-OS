import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '../ui/Button';
import { ChoicePickerWheel, TwoColumnPickerWheel } from '../ui/PickerWheel';
import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { typographyTokens } from '../../theme/tokens';
import { useReadinessStore } from '../../store/readinessStore';
import { useActivityStore } from '../../store/activityStore';
import type { ReadinessInputs } from '../../types/readiness';

type Colors = ReturnType<typeof useColors>;
type DraftInputs = Partial<ReadinessInputs>;

const HOUR_OPTIONS = Array.from({ length: 15 }, (_, index) => index);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);

const SLEEP_QUALITY_CHOICES = [
  { label: 'Very poor', value: 1, desc: 'Woke frequently or barely felt rested' },
  { label: 'Poor', value: 2, desc: 'Restless and noticeably unrefreshing' },
  { label: 'Fair', value: 3, desc: 'Some interruptions, but reasonably functional' },
  { label: 'Good', value: 4, desc: 'Mostly restful and refreshed' },
  { label: 'Excellent', value: 5, desc: 'Deep, restful, and highly refreshed' },
] as const;

const BODY_CHOICES = [
  { label: 'Very fatigued', value: 1 },
  { label: 'Heavy or sore', value: 2 },
  { label: 'A little stiff', value: 3 },
  { label: 'Good', value: 4 },
  { label: 'Fresh', value: 5 },
] as const;

const ENERGY_CHOICES = [
  { label: 'Very low', value: 1 },
  { label: 'Low', value: 2 },
  { label: 'Normal', value: 3 },
  { label: 'Good', value: 4 },
  { label: 'High', value: 5 },
] as const;

const STRESS_CHOICES = [
  { label: 'Very high', value: 1 },
  { label: 'High', value: 2 },
  { label: 'Moderate', value: 3 },
  { label: 'Low', value: 4 },
  { label: 'Very low', value: 5 },
] as const;

const FACTOR_CHOICES = [
  { label: 'Nothing notable', value: '' },
  { label: 'Limited time', value: 'limited_time' },
  { label: 'Poor sleep', value: 'poor_sleep' },
  { label: 'Work or life stress', value: 'work_or_life_stress' },
  { label: 'Muscle soreness', value: 'muscle_soreness' },
  { label: 'Pain or symptoms', value: 'pain_or_symptoms' },
  { label: 'Illness', value: 'illness' },
  { label: 'Travel', value: 'travel' },
  { label: 'Weather', value: 'weather' },
  { label: 'Other', value: 'other' },
] as const;

function validChoice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5;
}

function validSleepPart(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function formatSleepDuration(hours: unknown, minutes: unknown): string {
  if (!validSleepPart(hours, 0, 14) || !validSleepPart(minutes, 0, 59)) return 'Select sleep duration';
  if (hours === 0 && minutes === 0) return 'Select sleep duration';
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function sleepDraftIsValid(inputs: DraftInputs): inputs is ReadinessInputs {
  return validSleepPart(inputs.sleepHours, 0, 14)
    && validSleepPart(inputs.sleepMinutes, 0, 59)
    && (inputs.sleepHours > 0 || inputs.sleepMinutes > 0)
    && validChoice(inputs.sleepQuality)
    && validChoice(inputs.bodyStatus)
    && validChoice(inputs.energy)
    && validChoice(inputs.stress);
}

function hydrateInitialValues(initialValues?: ReadinessInputs): DraftInputs {
  if (!initialValues) return { optionalFactor: '' };
  return {
    sleepHours: validSleepPart(initialValues.sleepHours, 0, 14) ? initialValues.sleepHours : undefined,
    sleepMinutes: validSleepPart(initialValues.sleepMinutes, 0, 59) ? initialValues.sleepMinutes : undefined,
    sleepQuality: validChoice(initialValues.sleepQuality) ? initialValues.sleepQuality : undefined,
    bodyStatus: validChoice(initialValues.bodyStatus) ? initialValues.bodyStatus : undefined,
    energy: validChoice(initialValues.energy) ? initialValues.energy : undefined,
    stress: validChoice(initialValues.stress) ? initialValues.stress : undefined,
    optionalFactor: initialValues.optionalFactor ?? '',
  };
}

function ChoiceRow({
  label,
  value,
  choices,
  onChange,
  C,
  required,
}: {
  label: string;
  value: number | undefined;
  choices: readonly { label: string; value: number; desc?: string }[];
  onChange: (v: number) => void;
  C: Colors;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedChoice = choices.find(choice => choice.value === value);
  return (
    <View style={styles.row}>
      <View style={styles.labelLine}>
        <Text style={[styles.rowLabel, { color: C.textDim }]}>{label}</Text>
        {required && value === undefined ? <Text style={[styles.requiredText, { color: C.warning }]}>Required</Text> : null}
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${selectedChoice?.label ?? 'not selected'}`}
        accessibilityHint="Opens a picker wheel"
        style={({ pressed }) => [
          styles.sleepPickerButton,
          {
            borderColor: value === undefined ? C.warning : C.border,
            backgroundColor: C.cardAlt,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <Text style={[styles.sleepPickerValue, { color: selectedChoice ? C.text : C.textMuted }]}>
          {selectedChoice?.label ?? 'Choose one'}
        </Text>
        <Text style={[styles.sleepPickerAction, { color: C.primary }]}>Change</Text>
      </Pressable>
      <ChoicePickerWheel
        visible={open}
        title={label}
        values={choices.map(choice => ({ value: String(choice.value), label: choice.label }))}
        selectedValue={String(value ?? choices[Math.floor(choices.length / 2)]?.value ?? '')}
        confirmLabel="Set"
        onConfirm={next => {
          onChange(Number(next));
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
      {selectedChoice?.desc ? (
        <Text style={[styles.choiceDescription, { color: C.textMuted }]}>
          {selectedChoice.desc}
        </Text>
      ) : null}
    </View>
  );
}

function factorLabel(value: string | undefined): string {
  if (!value) return 'Nothing notable';
  if (value.startsWith('other:')) return value.slice('other:'.length).trim() || 'Other';
  return FACTOR_CHOICES.find(choice => choice.value === value)?.label ?? 'Other';
}

function TrainingFactorPicker({
  value,
  onChange,
  C,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  C: Colors;
}) {
  const [open, setOpen] = useState(false);
  const [otherText, setOtherText] = useState(value?.startsWith('other:') ? value.slice('other:'.length).trim() : '');
  const selectedValue = value?.startsWith('other:') ? 'other' : value ?? '';
  const [pendingValue, setPendingValue] = useState(selectedValue);
  const [pendingOtherText, setPendingOtherText] = useState(otherText);
  function openPicker() {
    setPendingValue(selectedValue);
    setPendingOtherText(value?.startsWith('other:') ? value.slice('other:'.length).trim() : otherText);
    setOpen(true);
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: C.textDim }]}>Anything affecting today's training?</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`Training factor, ${factorLabel(value)}`}
        accessibilityHint="Opens a picker wheel"
        style={({ pressed }) => [
          styles.sleepPickerButton,
          { borderColor: C.border, backgroundColor: C.cardAlt, opacity: pressed ? 0.82 : 1 },
        ]}
      >
        <Text style={[styles.sleepPickerValue, { color: C.text }]}>{factorLabel(value)}</Text>
        <Text style={[styles.sleepPickerAction, { color: C.primary }]}>Change</Text>
      </Pressable>
      <ChoicePickerWheel
        visible={open}
        title="Anything affecting training?"
        values={FACTOR_CHOICES.map(choice => ({ value: choice.value, label: choice.label }))}
        selectedValue={pendingValue}
        confirmLabel="Set Factor"
        onDraftChange={next => setPendingValue(next)}
        renderExtra={draftValue => draftValue === 'other' ? (
          <TextInput
            value={pendingOtherText}
            onChangeText={setPendingOtherText}
            placeholder="Add a short note"
            placeholderTextColor={C.textDim}
            style={[styles.otherInput, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            accessibilityLabel="Other training factor note"
            returnKeyType="done"
          />
        ) : null}
        onConfirm={next => {
          if (next === 'other') {
            const trimmed = pendingOtherText.trim();
            setOtherText(trimmed);
            onChange(trimmed ? `other:${trimmed}` : 'other:');
          } else {
            setOtherText('');
            onChange(next);
          }
          setOpen(false);
        }}
        onClose={() => {
          setPendingValue(selectedValue);
          setPendingOtherText(otherText);
          setOpen(false);
        }}
      />
      {selectedValue === 'other' ? (
        <TextInput
          value={otherText}
          onChangeText={text => {
            setOtherText(text);
            onChange(`other:${text}`);
          }}
          placeholder="Add a short note"
          placeholderTextColor={C.textDim}
          style={[styles.otherInput, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
          accessibilityLabel="Other training factor note"
        />
      ) : null}
    </View>
  );
}

function SleepDurationPicker({
  hours,
  minutes,
  onChange,
  C,
}: {
  hours: number | undefined;
  minutes: number | undefined;
  onChange: (hours: number, minutes: number) => void;
  C: Colors;
}) {
  const [open, setOpen] = useState(false);
  const label = formatSleepDuration(hours, minutes);
  const incomplete = !validSleepPart(hours, 0, 14) || !validSleepPart(minutes, 0, 59) || (hours === 0 && minutes === 0);

  function openPicker() {
    setOpen(true);
  }

  return (
    <View style={styles.row}>
      <View style={styles.labelLine}>
        <Text style={[styles.rowLabel, { color: C.textDim }]}>Sleep last night</Text>
        {incomplete ? <Text style={[styles.requiredText, { color: C.warning }]}>Required</Text> : null}
      </View>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`Sleep last night, ${label}`}
        accessibilityHint="Opens hour and minute picker"
        style={({ pressed }) => [
          styles.sleepPickerButton,
          {
            borderColor: incomplete ? C.warning : C.border,
            backgroundColor: C.cardAlt,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <Text style={[styles.sleepPickerValue, { color: incomplete ? C.textMuted : C.text }]}>{label}</Text>
        <Text style={[styles.sleepPickerAction, { color: C.primary }]}>Change</Text>
      </Pressable>
      <TwoColumnPickerWheel
        visible={open}
        title="Sleep last night"
        subtitle="Choose hours and minutes."
        confirmLabel="Set Sleep"
        columns={[
          {
            id: 'hours',
            title: 'Hours',
            values: HOUR_OPTIONS,
            selectedValue: validSleepPart(hours, 0, 14) ? hours : 7,
            formatValue: value => `${value} hr`,
          },
          {
            id: 'minutes',
            title: 'Minutes',
            values: MINUTE_OPTIONS,
            selectedValue: validSleepPart(minutes, 0, 59) ? minutes : 30,
            formatValue: value => `${value} min`,
          },
        ]}
        confirmDisabled={selection => selection.hours === 0 && selection.minutes === 0}
        onConfirm={selection => {
          onChange(selection.hours, selection.minutes);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

type Props = {
  initialValues?: ReadinessInputs;
  onSaved?:       () => void;
  embedded?:      boolean;
};

export default function ReadinessCheckInCard({ initialValues, onSaved, embedded = false }: Props) {
  const C = useColors();
  const submitReadiness = useReadinessStore(s => s.submitReadiness);
  const [inputs, setInputs] = useState<DraftInputs>(() => hydrateInitialValues(initialValues));
  const missingItems = useMemo(() => {
    const missing: string[] = [];
    if (!validSleepPart(inputs.sleepHours, 0, 14) || !validSleepPart(inputs.sleepMinutes, 0, 59) || (inputs.sleepHours === 0 && inputs.sleepMinutes === 0)) missing.push('sleep duration');
    if (!validChoice(inputs.sleepQuality)) missing.push('sleep quality');
    if (!validChoice(inputs.bodyStatus)) missing.push('body');
    if (!validChoice(inputs.energy)) missing.push('energy');
    if (!validChoice(inputs.stress)) missing.push('stress');
    return missing;
  }, [inputs]);
  const canSave = sleepDraftIsValid(inputs);

  function update<K extends keyof ReadinessInputs>(key: K, value: ReadinessInputs[K]) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!sleepDraftIsValid(inputs)) return;
    const activities = useActivityStore.getState().activities;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const sevenDayLoad = activities
      .filter(activity => activity.status !== 'skipped' && activity.startTime >= now - 7 * dayMs)
      .reduce((sum, activity) => sum + Math.max(0, activity.trainingLoad.wholeBody), 0);
    const yesterdayStart = new Date();
    yesterdayStart.setHours(0, 0, 0, 0);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = yesterdayStart.getTime() + dayMs;
    const priorDayHighIntensity = activities.some(activity =>
      activity.status !== 'skipped'
      && activity.startTime >= yesterdayStart.getTime()
      && activity.startTime < yesterdayEnd
      && ((activity.rpe ?? 0) >= 7 || activity.trainingLoad.wholeBody >= 60));
    submitReadiness(inputs, {
      recentTrainingLoad: Math.min(100, sevenDayLoad),
      priorDayHighIntensity,
    });
    onSaved?.();
  }

  return (
    <View
      style={[
        embedded ? styles.embeddedCard : styles.card,
        { backgroundColor: embedded ? 'transparent' : C.card, borderColor: embedded ? 'transparent' : C.border, borderTopColor: C.border },
      ]}
    >
      <Text style={[styles.title, { color: C.text }]}>Daily Check-In</Text>
      <Text style={[styles.subtitle, { color: C.textMuted }]}>A quick, plain-language check before you train.</Text>

      <View style={styles.rows}>
        <SleepDurationPicker
          hours={inputs.sleepHours}
          minutes={inputs.sleepMinutes}
          onChange={(hours, minutes) => setInputs(previous => ({ ...previous, sleepHours: hours, sleepMinutes: minutes }))}
          C={C}
        />
        <ChoiceRow label="How was the quality of your sleep?" C={C}
          value={inputs.sleepQuality} choices={SLEEP_QUALITY_CHOICES} onChange={v => update('sleepQuality', v)} required />
        <ChoiceRow label="How does your body feel today?" C={C}
          value={inputs.bodyStatus} choices={BODY_CHOICES} onChange={v => update('bodyStatus', v)} required />
        <ChoiceRow label="How is your energy today?" C={C}
          value={inputs.energy} choices={ENERGY_CHOICES} onChange={v => update('energy', v)} required />
        <ChoiceRow label="What are your stress levels like today?" C={C}
          value={inputs.stress} choices={STRESS_CHOICES} onChange={v => update('stress', v)} required />
        <TrainingFactorPicker value={inputs.optionalFactor} onChange={value => update('optionalFactor', value)} C={C} />
      </View>

      {!canSave ? (
        <Text style={[styles.incompleteText, { color: C.warning }]}>Complete: {missingItems.join(', ')}.</Text>
      ) : null}
      <Button label="Save Check-In" onPress={handleSave} disabled={!canSave} style={{ marginTop: spacing.md }} />
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
  embeddedCard: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginBottom: 0,
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
  labelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '800',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  choice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    flexBasis: '30%',
    gap: 2,
  },
  choiceText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedText: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  choiceDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  otherInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  rowLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  sleepPickerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sleepPickerValue: {
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  sleepPickerAction: {
    fontSize: 12,
    fontWeight: '800',
  },
  incompleteText: {
    marginTop: spacing.md,
    fontSize: 12,
    fontWeight: '700',
  },
});
