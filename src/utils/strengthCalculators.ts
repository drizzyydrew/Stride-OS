/** Standalone, advisory calculators transcribed from the owner's
 * One Rep Max Calc / One Rep Max Calculator sheet (gid 655951260).
 * No training-store dependencies and no prescription/history mutation. */
export type StrengthCalculatorUnit = 'lb' | 'kg';
export type StrengthCalculatorMethod = 'sheet_average' | 'epley';
export type RepMaxEquation = 'epley' | 'brzycki' | 'lander' | 'lombardi' | 'mayhew' | 'oconner' | 'wathen';
export type EquationResult = { id: RepMaxEquation; label: string; value: number; formula: string };
export type StrengthCalculatorResult = {
  value: number;
  average: number;
  range: { min: number; max: number };
  methods: EquationResult[];
  warnings: string[];
};

export const REP_MAX_EQUATIONS: readonly { id: RepMaxEquation; label: string; formula: string }[] = [
  { id: 'epley', label: 'Epley', formula: 'W × (1 + R ÷ 30)' },
  { id: 'brzycki', label: 'Brzycki', formula: 'W × 36 ÷ (37 − R)' },
  { id: 'lander', label: 'Lander', formula: '100 × W ÷ (101.3 − 2.67123 × R)' },
  { id: 'lombardi', label: 'Lombardi', formula: 'W × R^0.1' },
  { id: 'mayhew', label: 'Mayhew', formula: '100 × W ÷ (52.2 + 41.9 × exp(−0.055 × R))' },
  { id: 'oconner', label: "O’Conner", formula: 'W × (1 + 0.025 × R)' },
  { id: 'wathen', label: 'Wathen', formula: '100 × W ÷ (48.8 + 53.8 × exp(−0.075 × R))' },
];

function requirePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw Error(`Enter a positive, finite ${label}.`);
}
function requireUnit(unit: StrengthCalculatorUnit): void {
  if (unit !== 'lb' && unit !== 'kg') throw Error('Choose lb or kg and use it consistently.');
}
function requireMethod(method: StrengthCalculatorMethod): void {
  if (method !== 'sheet_average' && method !== 'epley') throw Error('Choose Sheet average or Epley.');
}
function requireReps(reps: number, max = 15): void {
  if (!Number.isInteger(reps) || reps < 1 || reps > max) throw Error(`Enter whole repetitions from 1 to ${max}.`);
}

/** Strict parsing avoids Number('')=0, exponent/hex shortcuts and partial text. */
export function parseStrengthCalculatorNumber(text: string): number {
  const cleaned = text.trim();
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned) ? Number(cleaned) : NaN;
}

function factor(id: RepMaxEquation, reps: number): number {
  switch (id) {
    case 'epley': return 1 + reps / 30;
    case 'brzycki': return 36 / (37 - reps);
    case 'lander': return 100 / (101.3 - 2.67123 * reps);
    case 'lombardi': return Math.pow(reps, 0.1);
    case 'mayhew': return 100 / (52.2 + 41.9 * Math.exp(-0.055 * reps));
    case 'oconner': return 1 + 0.025 * reps;
    case 'wathen': return 100 / (48.8 + 53.8 * Math.exp(-0.075 * reps));
  }
}
function summarize(methods: EquationResult[], method: StrengthCalculatorMethod, warnings: string[]): StrengthCalculatorResult {
  if (!methods.length || methods.some(row => !Number.isFinite(row.value))) throw Error('These values are too large to calculate.');
  const average = methods.reduce((sum, row) => sum + row.value / methods.length, 0);
  if (!Number.isFinite(average)) throw Error('These values are too large to calculate.');
  return { value: method === 'epley' ? methods.find(row => row.id === 'epley')!.value : average,
    average, range: { min: Math.min(...methods.map(row => row.value)), max: Math.max(...methods.map(row => row.value)) },
    methods, warnings };
}

export function estimateOneRepMax(input: { weight: number; reps: number; unit: StrengthCalculatorUnit;
  method: StrengthCalculatorMethod; actualRir?: number }): StrengthCalculatorResult {
  requireUnit(input.unit); requireMethod(input.method); requirePositive(input.weight, 'working weight'); requireReps(input.reps);
  if (input.actualRir !== undefined && (!Number.isInteger(input.actualRir) || input.actualRir < 0 || input.actualRir > 4)) {
    throw Error('Choose actual reps in reserve from 0 to 4, or turn that adjustment off.');
  }
  const reps = input.reps + (input.actualRir ?? 0);
  requireReps(reps, 20);
  const warnings = [input.actualRir === undefined
    ? 'Unadjusted formulas assume the entered repetitions approximate a repetition maximum. A submaximal set can underestimate your capacity; you do not need to train to failure to use this tool.'
    : 'RIR adjustment adds your reported remaining repetitions to completed reps. It is an additional estimate, not a measured maximum or a required failure test.'];
  if (reps > 10) warnings.push('More than 10 effective repetitions: estimates are less dependable and equations may diverge.');
  if (input.reps === 1) warnings.push('A single completed rep is not necessarily a tested maximum. The original Sheet equations are retained and can differ even at one repetition.');
  return summarize(REP_MAX_EQUATIONS.map(row => ({ ...row, value: input.weight * factor(row.id, reps) })), input.method, warnings);
}

export function estimateRepMaxWeight(input: { oneRepMax: number; targetReps: number; unit: StrengthCalculatorUnit;
  method: StrengthCalculatorMethod }): StrengthCalculatorResult {
  requireUnit(input.unit); requireMethod(input.method); requirePositive(input.oneRepMax, '1RM'); requireReps(input.targetReps);
  return summarize(REP_MAX_EQUATIONS.map(row => ({ ...row, value: input.oneRepMax / factor(row.id, input.targetReps),
    formula: `M ÷ (${row.formula.replace(/^W × /, '').replace(/W/g, '1')})` })), input.method,
  ['A target RM estimates a repetition-limit load, not a recommended working load. Leave room for the effort and recovery your workout requires.',
    ...(input.targetReps > 10 ? ['Above 10 repetitions, estimates are less dependable and equations may diverge.'] : [])]);
}

/** Only the Sheet's three populated prediction equations are used. Its average
 * references a blank fourth cell; that blank is not an invented fourth model. */
export function estimateRepetitions(input: { oneRepMax: number; weight: number; unit: StrengthCalculatorUnit;
  method: StrengthCalculatorMethod }): StrengthCalculatorResult {
  requireUnit(input.unit); requireMethod(input.method); requirePositive(input.oneRepMax, '1RM'); requirePositive(input.weight, 'working weight');
  if (input.weight > input.oneRepMax) throw Error('Working weight must not exceed the entered 1RM.');
  const methods: EquationResult[] = [
    { id: 'epley', label: 'Epley', value: 30 * (input.oneRepMax / input.weight - 1), formula: '30 × (M ÷ W − 1)' },
    { id: 'brzycki', label: 'Brzycki', value: 37 - 36 * input.weight / input.oneRepMax, formula: '37 − 36 × W ÷ M' },
    { id: 'lander', label: 'Lander', value: (101.3 - 100 * input.weight / input.oneRepMax) / 2.67123, formula: '(101.3 − 100 × W ÷ M) ÷ 2.67123' },
  ];
  return summarize(methods, input.method,
    ['This is a fractional model estimate, not a prescribed set or a promise of how many reps you can perform. Only the Sheet’s three populated prediction formulas are averaged.',
      ...(methods.some(row => row.value > 10) ? ['Higher-repetition predictions are less dependable. Use actual controlled performance and effort to guide training.'] : []),
      ...(methods.some(row => row.value < 1) ? ['Near an entered 1RM, equations can return fewer than one repetition and disagree. Keep the original arithmetic separate from actual performance.'] : [])]);
}

export function percentageLoads(oneRepMax: number, unit: StrengthCalculatorUnit): { percent: number; weight: number }[] {
  requireUnit(unit); requirePositive(oneRepMax, '1RM');
  return [40, 50, 60, 70, 80, 90, 100].map(percent => ({ percent, weight: oneRepMax * (percent / 100) }));
}

export function convertCalculatorWeight(weight: number, from: StrengthCalculatorUnit, to: StrengthCalculatorUnit): number {
  requireUnit(from); requireUnit(to); requirePositive(weight, 'weight');
  const converted = from === to ? weight : from === 'lb' ? weight * 0.45359237 : weight / 0.45359237;
  requirePositive(converted, 'converted weight');
  return converted;
}
