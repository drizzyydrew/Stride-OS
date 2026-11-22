import { useEffect, useMemo, useState } from 'react';
import { Keyboard, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Collapsible, Host, Picker, TextInput, useNativeState } from '@expo/ui';
import { useColors } from '../../../src/theme/useColors';
import { useThemeMode } from '../../../src/store/themeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { LAYOUT } from '../../../src/constants/layout';
import {
  estimateOneRepMax, estimateRepMaxWeight, estimateRepetitions, parseStrengthCalculatorNumber, percentageLoads,
  type StrengthCalculatorMethod, type StrengthCalculatorResult, type StrengthCalculatorUnit,
} from '../../../src/utils/strengthCalculators';

type Tool = 'one_rm' | 'rep_max' | 'repetitions' | 'percentages';
const TOOLS = [
  { value: 'one_rm', label: 'Estimate 1RM' }, { value: 'rep_max', label: 'Target rep-max weight' },
  { value: 'repetitions', label: 'Estimate repetitions' }, { value: 'percentages', label: 'Percentage loads' },
];
const CONVENTIONS = [
  { value: 'barbell', label: 'Barbell: total load' }, { value: 'dumbbell', label: 'Dumbbell: per hand' },
  { value: 'machine', label: 'Machine: displayed load' }, { value: 'other', label: 'Other external load' },
];

function Choice({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  const C = useColors(), theme = useThemeMode();
  return <View style={{ gap: 4, minWidth: 0 }}>
    <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
      {process.env.EXPO_OS === 'ios'
        ? <IOSChoice label={label} value={value} options={options} onChange={onChange} />
        : <Picker selectedValue={value} onValueChange={onChange} appearance="menu">
          {options.map(option => <Picker.Item key={option.value} {...option} />)}
        </Picker>}
    </Host>
  </View>;
}

// Explicit native label avoids the universal iOS menu's unlabeled appearance.
function IOSChoice({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  if (process.env.EXPO_OS !== 'ios') return null;
  const { Picker: IOSPicker, Text: IOSText } = require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
  const { pickerStyle, accessibilityLabel, frame, tag } = require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');
  return <IOSPicker label={label} selection={value} onSelectionChange={onChange}
    modifiers={[pickerStyle('menu'), accessibilityLabel(label), frame({ minHeight: 44 })]}>
    {options.map(option => <IOSText key={option.value} modifiers={[tag(option.value)]}>{option.label}</IOSText>)}
  </IOSPicker>;
}

function NumberField({ label, value, onChange, whole = false }: {
  label: string; value: string; onChange: (value: string) => void; whole?: boolean;
}) {
  const C = useColors(), theme = useThemeMode(), text = useNativeState(value);
  const { fontScale } = useWindowDimensions();
  useEffect(() => { if (text.value !== value) text.value = value; }, [text, value]);
  return <View style={{ gap: 6, minWidth: 0 }}>
    <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} style={{ width: '100%' }}>
      <TextInput value={text} onChangeText={next => { text.value = next; onChange(next); }}
        keyboardType={whole ? 'number-pad' : 'decimal-pad'} autoCorrect={false} autoCapitalize="none"
        placeholder={whole ? 'Whole repetitions' : 'Weight'} placeholderTextColor={C.textDim}
        maxLength={14} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()}
        modifiers={process.env.EXPO_OS === 'ios' ? [require('@expo/ui/swift-ui/modifiers').accessibilityLabel(label)] : undefined}
        cursorColor={C.primary} textStyle={{ color: C.text, fontSize: 16 * fontScale }}
        style={{ padding: 12, borderRadius: 10, backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border }} />
    </Host>
  </View>;
}

type Calculation = { result?: StrengthCalculatorResult; percentages?: { percent: number; weight: number }[]; error?: string };

export default function StrengthCalculatorsScreen() {
  const C = useColors(), theme = useThemeMode();
  const settingsUnits = useSettingsStore(state => state.units);
  const { fontScale } = useWindowDimensions();
  const [tool, setTool] = useState<Tool>('one_rm');
  const [unit, setUnit] = useState<StrengthCalculatorUnit>(settingsUnits === 'imperial' ? 'lb' : 'kg');
  const [method, setMethod] = useState<StrengthCalculatorMethod>('sheet_average');
  const [convention, setConvention] = useState('barbell');
  const [weight, setWeight] = useState(''), [reps, setReps] = useState(''), [maximum, setMaximum] = useState('');
  const [effort, setEffort] = useState('unadjusted'), [rir, setRir] = useState('');
  const [attempted, setAttempted] = useState(false), [detailsOpen, setDetailsOpen] = useState(false);
  const copy = { color: C.textMuted, fontSize: 14, lineHeight: 21 };
  const card = { borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, backgroundColor: C.card, gap: 14, minWidth: 0 };
  const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

  const calculation = useMemo<Calculation>(() => {
    if (!attempted) return {};
    try {
      const W = parseStrengthCalculatorNumber(weight), R = parseStrengthCalculatorNumber(reps), M = parseStrengthCalculatorNumber(maximum);
      if (tool === 'one_rm') return { result: estimateOneRepMax({ weight: W, reps: R, unit, method,
        ...(effort === 'reported_rir' ? { actualRir: parseStrengthCalculatorNumber(rir) } : {}) }) };
      if (tool === 'rep_max') return { result: estimateRepMaxWeight({ oneRepMax: M, targetReps: R, unit, method }) };
      if (tool === 'repetitions') return { result: estimateRepetitions({ oneRepMax: M, weight: W, unit, method }) };
      return { percentages: percentageLoads(M, unit) };
    } catch (error) { return { error: error instanceof Error ? error.message : 'Check the entered values.' }; }
  }, [attempted, tool, weight, reps, maximum, unit, method, effort, rir]);

  const example = tool === 'one_rm' ? `Example: 100 ${unit} for 5 repetitions gives 115.5 ${unit} using the seven-equation average, or 116.7 ${unit} with Epley. No RIR adjustment.`
    : tool === 'rep_max' ? `Example: a 200 ${unit} 1RM and a target of 5 repetitions gives about 173.2 ${unit} using the seven-equation average. This estimates a 5RM, not a working-set recommendation.`
      : tool === 'repetitions' ? `Example: with a 200 ${unit} 1RM, 150 ${unit} predicts about 9.9 repetitions using the three-equation average, or 10 with Epley. Actual performance can differ.`
        : `Example: with a 200 ${unit} 1RM, 40% is 80 ${unit}, 70% is 140 ${unit}, and 80% is 160 ${unit}. Percentages alone do not choose your workout effort.`;
  function useExample() {
    setWeight(tool === 'repetitions' ? '150' : '100'); setMaximum('200'); setReps('5');
    setEffort('unadjusted'); setRir(''); setAttempted(true); Keyboard.dismiss();
  }
  const resultUnit = tool === 'repetitions' ? 'reps' : unit;
  const methodLabel = method === 'epley' ? 'Epley' : `Sheet average (${tool === 'repetitions' ? '3' : '7'} equations)`;

  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    <Stack.Screen options={{ headerShown: true, title: 'Strength calculators', headerTintColor: C.text,
      headerStyle: { backgroundColor: C.bg }, headerTitleStyle: { color: C.text }, headerShadowVisible: false }} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: LAYOUT.screenPadBottom, gap: 16 }}>
      <Text style={copy}>Explore estimated strength values without testing a maximum. These tools do not change your plan, logged sets or workout weights.</Text>
      <View style={card}>
        <Choice label="Calculator" value={tool} options={TOOLS} onChange={value => {
          setTool(value as Tool); setAttempted(false); setDetailsOpen(false);
        }} />
        <Choice label="Weight unit" value={unit} options={[{ value: 'lb', label: 'Pounds (lb)' }, { value: 'kg', label: 'Kilograms (kg)' }]}
          onChange={value => { if (value !== unit) { setUnit(value as StrengthCalculatorUnit); setWeight(''); setMaximum(''); setAttempted(false); } }} />
        <Text style={copy}>Changing units clears entered weights so the same number is never silently relabeled.</Text>
        <Choice label="Load convention" value={convention} options={CONVENTIONS} onChange={value => {
          if (value !== convention) { setConvention(value); setWeight(''); setMaximum(''); setAttempted(false); }
        }} />
        <Text style={copy}>{convention === 'barbell' ? 'Enter bar plus plates together.'
          : convention === 'dumbbell' ? 'Enter the load of one dumbbell. Results remain per hand; do not add both dumbbells together.'
            : convention === 'machine' ? 'Enter the displayed load. Results apply only to the same machine, settings and setup.'
              : 'Use a repeatable external-load convention for the same exercise and setup.'} Bodyweight, bands, timed holds and carries are not supported by these rep-max equations.</Text>
        {tool !== 'one_rm' ? <NumberField label={`Known or estimated 1RM (${unit})`} value={maximum} onChange={setMaximum} /> : null}
        {tool === 'one_rm' || tool === 'repetitions' ? <NumberField label={`Working weight (${unit})`} value={weight} onChange={setWeight} /> : null}
        {tool === 'one_rm' || tool === 'rep_max' ? <NumberField label={tool === 'one_rm' ? 'Repetitions completed (1–15)' : 'Target repetitions (1–15)'} value={reps} onChange={setReps} whole /> : null}
        {tool === 'one_rm' ? <>
          <Choice label="Effort adjustment" value={effort} options={[{ value: 'unadjusted', label: 'Unadjusted' }, { value: 'reported_rir', label: 'Use actual reps in reserve' }]} onChange={setEffort} />
          {effort === 'reported_rir' ? <><NumberField label="Actual reps in reserve (0–4)" value={rir} onChange={setRir} whole />
            <Text style={copy}>How many more controlled reps could you actually have completed? Use your reported effort, not the workout’s target. Unknown effort is not zero RIR.</Text></> : null}
        </> : null}
        {tool !== 'percentages' ? <Choice label="Result method" value={method} options={[{ value: 'sheet_average', label: 'Sheet average' }, { value: 'epley', label: 'Epley' }]} onChange={value => setMethod(value as StrengthCalculatorMethod)} /> : null}
        <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
          <Button label="Calculate" onPress={() => { setAttempted(true); Keyboard.dismiss(); }} />
        </Host>
        {calculation.error ? <Text selectable accessibilityRole="alert" style={[copy, { color: C.warning }]}>{calculation.error}</Text> : null}
      </View>

      {calculation.result ? <View style={card} accessibilityLiveRegion="polite">
        <Text style={[copy, { color: C.text, fontWeight: '600' }]}>{tool === 'one_rm' ? 'Estimated 1RM' : tool === 'rep_max' ? 'Estimated rep-max weight' : 'Estimated repetitions'}</Text>
        <Text selectable style={{ color: C.text, fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 }}>{number(calculation.result.value)} {resultUnit}</Text>
        <Text style={copy}>{methodLabel}{tool === 'one_rm' && effort === 'reported_rir' ? ` · adjusted using ${rir} reported RIR` : ''}</Text>
        {calculation.result.warnings.map(warning => <Text key={warning} style={copy}>{warning}</Text>)}
        <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
          <Collapsible label="Calculation details" isOpen={detailsOpen} onOpenChange={setDetailsOpen}
            labelStyle={{ color: C.primary, fontSize: 14 * fontScale, fontWeight: '600' }} />
        </Host>
            {detailsOpen ? <View style={{ gap: 12, minWidth: 0, width: '100%', maxWidth: '100%' }}>
              <Text style={copy}>{tool === 'repetitions' ? 'M = entered 1RM; W = working weight. Three populated equations are averaged.'
                : tool === 'one_rm' ? 'W = working weight; R = completed reps, plus actual RIR only when selected.'
                  : 'M = entered 1RM; R = target repetitions. Each forward equation is inverted separately, then the seven weights are averaged.'}</Text>
              {calculation.result.methods.map(row => <View key={row.id} style={{ gap: 4, minWidth: 0 }}>
                <Text selectable style={[copy, { color: C.text, fontWeight: '600' }]}>{row.label}: {number(row.value)} {resultUnit}</Text>
                <Text selectable style={copy}>{row.formula}</Text>
              </View>)}
              <Text selectable style={copy}>Average: {number(calculation.result.average)} {resultUnit}. Equation range: {number(calculation.result.range.min)}–{number(calculation.result.range.max)} {resultUnit}.</Text>
              <Text style={copy}>The range shows disagreement between equations, not a confidence interval or a guaranteed range for your true maximum. Different lifts, technique, fatigue and experience can change the result.</Text>
            </View> : null}
      </View> : null}

      {calculation.percentages ? <View style={card}>
        <Text style={[copy, { color: C.text, fontWeight: '600' }]}>Percentage loads</Text>
        {calculation.percentages.map(row => <Text selectable key={row.percent} style={[copy, { color: C.text, fontVariant: ['tabular-nums'] }]}>{row.percent}%: {number(row.weight)} {unit}</Text>)}
        <Text style={copy}>Each load is entered 1RM × percentage. These are reference values, not automatic workout targets or instructions to test a maximum.</Text>
      </View> : null}

      <View style={card}>
        <Text style={[copy, { color: C.text, fontWeight: '600' }]}>Example</Text>
        <Text style={copy}>{example}</Text>
        <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
          <Button label="Try this example" variant="outlined" onPress={useExample} />
        </Host>
      </View>
      <Text style={copy}>Keep estimates specific to the same exercise, range of motion, tempo and load convention. Calibrate a new variation separately. A calculator estimate does not establish technique, readiness or a safe working load.</Text>
      <View style={card}>
        <Text style={[copy, { color: C.text, fontWeight: '600' }]}>Reps, effort and your goal</Text>
        <Text style={copy}>RPE is effort, not a percentage. RPE 8 means about 2 good reps remain. For example, 3–5 completed reps at RPE 8 is roughly a 5–7 rep capacity; the weight can still be heavy.</Text>
        <Text style={copy}>Strength: practiced lifters often use 3–6 reps for priority lifts, with heavier work around 80% of estimated 1RM or above when appropriate. Beginners can build strength with lighter loads. Do not force every set, accessory or recovery week into one weekly percentage average.</Text>
        <Text style={copy}>Muscle growth: 6–12 reps is a useful common range, with effective work possible across a wider range. Strength and muscle growth overlap; 70% of 1RM can still improve strength.</Text>
        <Text style={copy}>Muscular endurance: often 12 or more reps with manageable loads. Power: short sets of quick, controlled reps with full recovery; stop when speed or control falls. Power does not always mean the heaviest weight.</Text>
        <Text style={copy}>These are starting ranges, not strict boundaries. Match working sets, effort, rests and weekly volume to experience, your main goal and how you recover.</Text>
      </View>
    </ScrollView>
  </View>;
}
