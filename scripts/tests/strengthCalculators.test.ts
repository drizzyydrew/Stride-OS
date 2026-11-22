import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  convertCalculatorWeight, estimateOneRepMax, estimateRepMaxWeight, estimateRepetitions,
  parseStrengthCalculatorNumber, percentageLoads,
  type StrengthCalculatorMethod, type StrengthCalculatorUnit,
} from '../../src/utils/strengthCalculators';

const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const base = { weight: 100, reps: 5, unit: 'lb' as const, method: 'sheet_average' as const };

test('the seven forward equations match independently calculated Sheet fixtures and explicitly selected output', () => {
  const expected = [116.66666666666667, 112.5, 113.70891767872341, 117.4618943088019,
    119.01068045151959, 112.5, 116.58250529118924];
  const result = estimateOneRepMax(base);
  assert.deepEqual(result.methods.map(row => row.id), ['epley', 'brzycki', 'lander', 'lombardi', 'mayhew', 'oconner', 'wathen']);
  result.methods.forEach((row, index) => close(row.value, expected[index]!));
  close(result.average, 115.49009491384298); close(result.value, result.average);
  close(result.range.min, 112.5); close(result.range.max, 119.01068045151959);
  const epley = estimateOneRepMax({ ...base, method: 'epley' });
  close(epley.value, 116.66666666666667);
  close(epley.average, result.average, 1e-12);
});

test('target RM averages the seven individually inverted weights, not the inverse of the average', () => {
  const result = estimateRepMaxWeight({ oneRepMax: 200, targetReps: 5, unit: 'lb', method: 'sheet_average' });
  const expected = [171.42857142857142, 177.77777777777777, 175.8877, 170.2679845041569,
    168.05214392625237, 177.77777777777777, 171.5523263979086];
  result.methods.forEach((row, index) => close(row.value, expected[index]!));
  close(result.average, 173.2491831160635);
  assert.ok(Math.abs(result.average - 20000 / estimateOneRepMax(base).average) > 0.01);
  assert.match(result.warnings.join(' '), /not a recommended working load/i);
});

test('each inverse returns its originating working load throughout the supported rep domain', () => {
  for (const reps of [1, 3, 5, 10, 14, 15]) {
    const forward = estimateOneRepMax({ ...base, reps });
    for (const row of forward.methods) {
      const inverse = estimateRepMaxWeight({ oneRepMax: row.value, targetReps: reps, unit: 'lb', method: 'sheet_average' });
      close(inverse.methods.find(value => value.id === row.id)!.value, 100);
    }
  }
});

test('expected repetitions average only the three populated Sheet equations and retain fractional results', () => {
  const result = estimateRepetitions({ oneRepMax: 200, weight: 150, unit: 'lb', method: 'sheet_average' });
  assert.deepEqual(result.methods.map(row => row.id), ['epley', 'brzycki', 'lander']);
  close(result.methods[0]!.value, 10); close(result.methods[1]!.value, 10);
  close(result.methods[2]!.value, 9.84565162865047); close(result.value, 9.94855054288349);
  assert.match(result.warnings.join(' '), /three populated/i);
  close(estimateRepetitions({ oneRepMax: 200, weight: 150, unit: 'kg', method: 'epley' }).value, 10);
  assert.throws(() => estimateRepetitions({ oneRepMax: 100, weight: 101, unit: 'lb', method: 'sheet_average' }), /must not exceed/i);
  const nearMaximum = estimateRepetitions({ oneRepMax: 100, weight: 100, unit: 'lb', method: 'sheet_average' });
  assert.match(nearMaximum.warnings.join(' '), /fewer than one/i);
});

test('actual RIR is optional and explicit, never reconstructed from a planned target', () => {
  const result = estimateOneRepMax({ ...base, actualRir: 2, method: 'epley' });
  close(result.value, 123.33333333333333);
  close(estimateOneRepMax({ ...base, actualRir: 0, method: 'epley' }).value, 116.66666666666667);
  assert.match(result.warnings.join(' '), /reported remaining repetitions/i);
  assert.match(estimateOneRepMax(base).warnings.join(' '), /submaximal set can underestimate/i);
  for (const actualRir of [NaN, Infinity, -1, 5, 1.5]) {
    assert.throws(() => estimateOneRepMax({ ...base, actualRir }), /actual reps in reserve/i);
  }
});

test('one-rep arithmetic remains faithful and higher reps are allowed with explicit limitations', () => {
  const single = estimateOneRepMax({ ...base, reps: 1, method: 'epley' });
  close(single.value, 103.33333333333334);
  assert.match(single.warnings.join(' '), /not necessarily a tested maximum/i);
  assert.ok(single.range.max > single.range.min);
  const higher = estimateOneRepMax({ ...base, reps: 14 });
  assert.equal(higher.methods.length, 7);
  assert.match(higher.warnings.join(' '), /more than 10/i);
  assert.ok(estimateOneRepMax({ ...base, reps: 15, actualRir: 4 }).methods.every(row => Number.isFinite(row.value)));
  for (const reps of [0, 16, -1, 2.5, NaN, Infinity]) {
    assert.throws(() => estimateOneRepMax({ ...base, reps }), /whole repetitions/i);
    assert.throws(() => estimateRepMaxWeight({ oneRepMax: 200, targetReps: reps, unit: 'lb', method: 'epley' }), /whole repetitions/i);
  }
});

test('all four tools reject nonfinite/nonpositive loads and unknown unit/method metadata', () => {
  for (const weight of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(() => estimateOneRepMax({ ...base, weight }));
    assert.throws(() => estimateRepMaxWeight({ oneRepMax: weight, targetReps: 5, unit: 'lb', method: 'sheet_average' }));
    assert.throws(() => estimateRepetitions({ oneRepMax: 200, weight, unit: 'lb', method: 'sheet_average' }));
    assert.throws(() => percentageLoads(weight, 'lb'));
  }
  assert.throws(() => estimateOneRepMax({ ...base, unit: 'stone' as StrengthCalculatorUnit }));
  assert.throws(() => estimateOneRepMax({ ...base, method: 'unknown' as StrengthCalculatorMethod }));
  assert.throws(() => estimateOneRepMax({ ...base, weight: Number.MAX_VALUE }), /too large/i);
  assert.ok(percentageLoads(Number.MAX_VALUE, 'lb').every(row => Number.isFinite(row.weight)));
});

test('unit conversion preserves physical load and equation estimates without dumbbell doubling', () => {
  const kilograms = convertCalculatorWeight(100, 'lb', 'kg'); close(kilograms, 45.359237);
  close(convertCalculatorWeight(kilograms, 'kg', 'lb'), 100);
  const pounds = estimateOneRepMax(base), metric = estimateOneRepMax({ ...base, weight: kilograms, unit: 'kg' });
  close(convertCalculatorWeight(pounds.value, 'lb', 'kg'), metric.value);
  close(estimateOneRepMax({ ...base, weight: 25, unit: 'kg', method: 'epley' }).value, 29.166666666666668);
  assert.deepEqual(percentageLoads(200, 'lb'), [40, 50, 60, 70, 80, 90, 100].map(percent => ({ percent, weight: 2 * percent })));
});

test('numeric parsing does not accept blanks, units, partial strings, hexadecimal or exponents', () => {
  for (const text of ['', ' ', '100 lb', '20reps', '1e3', '0x10', 'Infinity', 'NaN', '-20', '1,000']) {
    assert.equal(Number.isNaN(parseStrengthCalculatorNumber(text)), true, text);
  }
  for (const [text, value] of [['100', 100], [' 20.5 ', 20.5], ['.5', 0.5], ['0', 0]] as const) close(parseStrengthCalculatorNumber(text), value);
});

test('calculators leave caller inputs intact and the UI does not write training data', () => {
  const input = { ...base, actualRir: 2 }, before = structuredClone(input);
  estimateOneRepMax(input); assert.deepEqual(input, before);
  const source = readFileSync('app/(tabs)/settings/strength-calculators.tsx', 'utf8');
  assert.doesNotMatch(source, /use(?:Strength|TrainingPlan|Profile|ActiveStrengthSession)Store|\.setState\(|fetch\(/);
  assert.match(source, /setWeight\(''\).*setMaximum\(''\)/);
  assert.match(source, /useState<StrengthCalculatorMethod>\('sheet_average'\)/);
  assert.match(source, /Single|single completed rep|calculation\.result\.warnings/);
});
