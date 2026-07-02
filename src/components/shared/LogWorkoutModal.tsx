// ─── Log Workout Modal ────────────────────────────────────────────────────────
//
// Universal custom workout logger. Supports running, strength, cross-training,
// mobility, and other categories. Can be triggered from any screen.
//
// Business logic: customWorkoutEngine.ts + customWorkoutStore.ts
// No business logic lives in this component.

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

import NumberInput from '../ui/NumberInput';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type {
  CustomWorkoutCategory,
  RunWorkoutType,
  StrengthFocus,
  CrossTrainingType,
  ExerciseLogEntry,
  SetEntry,
} from '../../types/customWorkout';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: CustomWorkoutCategory; label: string; icon: string }[] = [
  { key: 'running',        label: 'Run',         icon: '🏃' },
  { key: 'strength',       label: 'Strength',    icon: '🏋️' },
  { key: 'cross_training', label: 'Cross',       icon: '🚴' },
  { key: 'mobility',       label: 'Mobility',    icon: '🧘' },
  { key: 'other',          label: 'Other',       icon: '⚡' },
];

const RUN_TYPES: { key: RunWorkoutType; label: string }[] = [
  { key: 'easy',          label: 'Easy'          },
  { key: 'recovery',      label: 'Recovery'      },
  { key: 'long_run',      label: 'Long Run'      },
  { key: 'tempo',         label: 'Tempo'         },
  { key: 'threshold',     label: 'Threshold'     },
  { key: 'marathon_pace', label: 'Marathon Pace' },
  { key: 'intervals',     label: 'Intervals'     },
  { key: 'vo2',           label: 'VO₂ Max'       },
  { key: 'hills',         label: 'Hills'         },
  { key: 'fartlek',       label: 'Fartlek'       },
  { key: 'race',          label: 'Race'          },
  { key: 'time_trial',    label: 'Time Trial'    },
];

const STRENGTH_FOCUSES: { key: StrengthFocus; label: string }[] = [
  { key: 'lower',          label: 'Lower Body'      },
  { key: 'upper',          label: 'Upper Body'      },
  { key: 'core',           label: 'Core'            },
  { key: 'full_body',      label: 'Full Body'       },
  { key: 'power',          label: 'Power'           },
  { key: 'tendon_capacity',label: 'Tendon Capacity' },
  { key: 'mobility_prehab',label: 'Mobility/Prehab' },
];

const CROSS_TYPES: { key: CrossTrainingType; label: string }[] = [
  { key: 'bike',      label: 'Bike'      },
  { key: 'swim',      label: 'Swim'      },
  { key: 'ski',       label: 'Ski'       },
  { key: 'row',       label: 'Row'       },
  { key: 'elliptical',label: 'Elliptical'},
  { key: 'hike',      label: 'Hike'      },
  { key: 'walk',      label: 'Walk'      },
  { key: 'other',     label: 'Other'     },
];

// ─── Pill selector ────────────────────────────────────────────────────────────

function PillRow<K extends string>({
  options, selected, onSelect,
}: {
  options:  { key: K; label: string }[];
  selected: K;
  onSelect: (k: K) => void;
}) {
  const colors = useThemeColors();
  const pill   = useMemo(() => createPillStyles(colors), [colors]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
      <View style={pill.row}>
        {options.map(o => (
          <Pressable
            key={o.key}
            style={[pill.item, selected === o.key && pill.itemActive]}
            onPress={() => onSelect(o.key)}
          >
            <Text style={[pill.txt, selected === o.key && pill.txtActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function createPillStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', gap: spacing.xs, paddingBottom: 4 },
    item:      { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 20, backgroundColor: colors.border },
    itemActive:{ backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: colors.primary },
    txt:       { color: colors.textDim, fontSize: FontSize.sm },
    txtActive: { color: colors.primary, fontWeight: FontWeight.bold },
  });
}

// ─── Section label ────────────────────────────────────────────────────────────

function SLabel({ label }: { label: string }) {
  const colors = useThemeColors();
  return <Text style={[sLabelStyle.text, { color: colors.textMuted }]}>{label}</Text>;
}

const sLabelStyle = StyleSheet.create({
  text: {
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export type LogWorkoutModalProps = {
  visible:      boolean;
  onClose:      () => void;
  onSaved:      (logId: string) => void;
  onAddLog: (
    partial:           Omit<import('../../types/customWorkout').CustomWorkoutLog, 'id' | 'completedAt' | 'estimatedLoad' | 'fatigueImpact'>,
    currentFatigue:    number,
    setFatigueScore:   (score: number) => void,
    setRecentEasyLoad: (load: number) => void,
    recentEasyLoad:    number,
  ) => string;
  currentFatigue:    number;
  currentRecovery:   number;
  recentEasyLoad:    number;
  setFatigueScore:   (score: number) => void;
  setRecentEasyLoad: (load: number)  => void;
  defaultDate?:      string;   // "YYYY-MM-DD" for backdated logging
  overrideId?:       string;   // links to override record
};

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function LogWorkoutModal({
  visible, onClose, onSaved, onAddLog,
  currentFatigue, recentEasyLoad, setFatigueScore, setRecentEasyLoad,
  defaultDate, overrideId,
}: LogWorkoutModalProps) {
  const colors = useThemeColors();
  const s      = useMemo(() => createStyles(colors), [colors]);

  const today = new Date().toISOString().split('T')[0];

  const [category,     setCategory]     = useState<CustomWorkoutCategory>('running');
  const [date,         setDate]         = useState(defaultDate ?? today);
  const [rpe,          setRpe]          = useState(5);
  const [notes,        setNotes]        = useState('');

  // Running
  const [runType,  setRunType]  = useState<RunWorkoutType>('easy');
  const [durMin,   setDurMin]   = useState(45);
  const [distMi,   setDistMi]   = useState(0);

  // Strength
  const [sFocus,   setSFocus]   = useState<StrengthFocus>('lower');
  const [sDurMin,  setSDurMin]  = useState(45);
  const [exercises, setExercises] = useState<ExerciseLogEntry[]>([]);
  const [exName,   setExName]   = useState('');

  // Cross training
  const [crossType,     setCrossType]     = useState<CrossTrainingType>('bike');
  const [crossDurMin,   setCrossDurMin]   = useState(45);
  const [crossDistMi,   setCrossDistMi]   = useState(0);

  // Mobility / other
  const [mobDurMin, setMobDurMin] = useState(30);

  function addExercise() {
    if (!exName.trim()) return;
    setExercises(prev => [...prev, {
      exerciseName: exName.trim(),
      sets: [{ reps: undefined, load: undefined, rpe: undefined, completed: true }],
    }]);
    setExName('');
  }

  function handleSave() {
    const source = defaultDate && defaultDate < today ? 'backdated' : overrideId ? 'override' : 'custom';

    const base = {
      category,
      date,
      source: source as 'custom' | 'backdated' | 'override',
      overrideId,
      notes: notes || undefined,
      rpe,
    };

    let full: Omit<import('../../types/customWorkout').CustomWorkoutLog, 'id' | 'completedAt' | 'estimatedLoad' | 'fatigueImpact'>;

    switch (category) {
      case 'running':
        full = { ...base, runType, durationMinutes: durMin, distanceMiles: distMi || undefined };
        break;
      case 'strength':
        full = { ...base, strengthFocus: sFocus, strengthDurationMin: sDurMin, exercises: exercises.length ? exercises : undefined };
        break;
      case 'cross_training':
        full = { ...base, crossTrainingType: crossType, crossDurationMin: crossDurMin, crossDistanceMiles: crossDistMi || undefined };
        break;
      case 'mobility':
        full = { ...base, mobilityDurationMin: mobDurMin };
        break;
      default:
        full = { ...base, otherDurationMin: mobDurMin };
    }

    const id = onAddLog(full, currentFatigue, setFatigueScore, setRecentEasyLoad, recentEasyLoad);
    onSaved(id);
    resetForm();
    onClose();
  }

  function resetForm() {
    setCategory('running'); setDate(defaultDate ?? today); setRpe(5); setNotes('');
    setRunType('easy'); setDurMin(45); setDistMi(0);
    setSFocus('lower'); setSDurMin(45); setExercises([]);
    setCrossType('bike'); setCrossDurMin(45); setCrossDistMi(0);
    setMobDurMin(30);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => { resetForm(); onClose(); }}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
          <Text style={s.title}>Log Workout</Text>
          <Pressable onPress={handleSave}>
            <Text style={s.save}>Save</Text>
          </Pressable>
        </View>

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Date */}
          <View style={s.section}>
            <SLabel label="DATE" />
            <TextInput
              style={s.dateInput}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSubtle}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
            />
          </View>

          {/* Category */}
          <View style={s.section}>
            <SLabel label="CATEGORY" />
            <View style={s.catRow}>
              {CATEGORIES.map(c => (
                <Pressable
                  key={c.key}
                  style={[s.catBtn, category === c.key && s.catBtnActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={s.catIcon}>{c.icon}</Text>
                  <Text style={[s.catLabel, category === c.key && s.catLabelActive]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── Running ── */}
          {category === 'running' && (
            <>
              <View style={s.section}>
                <SLabel label="WORKOUT TYPE" />
                <PillRow options={RUN_TYPES} selected={runType} onSelect={setRunType} />
              </View>
              <View style={s.section}>
                <NumberInput label="Duration" value={durMin} onChangeValue={setDurMin} min={1} max={600} step={5} unit="min" />
              </View>
              <View style={s.section}>
                <NumberInput label="Distance (optional)" value={distMi} onChangeValue={setDistMi} min={0} max={200} step={0.1} unit="mi" decimalPlaces={1} />
              </View>
            </>
          )}

          {/* ── Strength ── */}
          {category === 'strength' && (
            <>
              <View style={s.section}>
                <SLabel label="FOCUS AREA" />
                <PillRow options={STRENGTH_FOCUSES} selected={sFocus} onSelect={setSFocus} />
              </View>
              <View style={s.section}>
                <NumberInput label="Duration" value={sDurMin} onChangeValue={setSDurMin} min={5} max={180} step={5} unit="min" />
              </View>
              <View style={s.section}>
                <SLabel label="EXERCISES (optional)" />
                <View style={s.exRow}>
                  <TextInput
                    style={s.exInput}
                    value={exName}
                    onChangeText={setExName}
                    placeholder="e.g. Romanian Deadlift"
                    placeholderTextColor={colors.textSubtle}
                    returnKeyType="done"
                    onSubmitEditing={addExercise}
                  />
                  <Pressable style={s.exAddBtn} onPress={addExercise}>
                    <Text style={s.exAddTxt}>Add</Text>
                  </Pressable>
                </View>
                {exercises.map((ex, i) => (
                  <View key={i} style={s.exChip}>
                    <Text style={s.exChipTxt}>{ex.exerciseName}</Text>
                    <Pressable onPress={() => setExercises(prev => prev.filter((_, j) => j !== i))}>
                      <Text style={s.exChipRemove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Cross Training ── */}
          {category === 'cross_training' && (
            <>
              <View style={s.section}>
                <SLabel label="ACTIVITY" />
                <PillRow options={CROSS_TYPES} selected={crossType} onSelect={setCrossType} />
              </View>
              <View style={s.section}>
                <NumberInput label="Duration" value={crossDurMin} onChangeValue={setCrossDurMin} min={5} max={600} step={5} unit="min" />
              </View>
              <View style={s.section}>
                <NumberInput label="Distance (optional)" value={crossDistMi} onChangeValue={setCrossDistMi} min={0} max={200} step={0.1} unit="mi" decimalPlaces={1} />
              </View>
            </>
          )}

          {/* ── Mobility / Other ── */}
          {(category === 'mobility' || category === 'other') && (
            <View style={s.section}>
              <NumberInput label="Duration" value={mobDurMin} onChangeValue={setMobDurMin} min={5} max={180} step={5} unit="min" />
            </View>
          )}

          {/* RPE */}
          <View style={s.section}>
            <NumberInput
              label="RPE (1–10)"
              value={rpe}
              onChangeValue={setRpe}
              min={1}
              max={10}
              step={1}
              unit="/10"
            />
            <Text style={s.rpeHint}>
              {rpe <= 3 ? 'Very light — easy conversation' :
               rpe <= 5 ? 'Moderate — comfortable effort' :
               rpe <= 7 ? 'Hard — could speak short sentences' :
               rpe <= 9 ? 'Very hard — very difficult to speak' :
               'Max — all-out effort'}
            </Text>
          </View>

          {/* Notes */}
          <View style={s.section}>
            <SLabel label="NOTES (OPTIONAL)" />
            <TextInput
              style={s.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it feel? Any context?"
              placeholderTextColor={colors.textSubtle}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
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
  root:       { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:      spacing.xl,
    paddingBottom:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel:     { color: colors.textMuted, fontSize: FontSize.base },
  title:      { color: colors.text,      fontSize: FontSize.base, fontWeight: FontWeight.bold },
  save:       { color: colors.primary,   fontSize: FontSize.base, fontWeight: FontWeight.bold },
  scroll:     { flex: 1 },
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
  dateInput: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.base,
    padding:         spacing.md,
  },
  catRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  catBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderRadius:    10,
    backgroundColor: colors.card,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             4,
  },
  catBtnActive: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  catIcon:      { fontSize: 18 },
  catLabel:     { color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.bold },
  catLabelActive: { color: colors.primary },
  rpeHint:    { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.sm,
    padding:         spacing.md,
    minHeight:       80,
  },
  exRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  exInput: {
    flex:            1,
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  exAddBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius:    Radius.sm,
    paddingHorizontal: spacing.md,
    borderWidth:     1,
    borderColor:     colors.primary,
    justifyContent:  'center',
  },
  exAddTxt: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  exChip: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   colors.card,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  exChipTxt:    { color: colors.text,    fontSize: FontSize.sm },
  exChipRemove: { color: colors.textDim, fontSize: FontSize.sm },
  });
}
