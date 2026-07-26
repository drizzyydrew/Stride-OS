import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summarizeStrengthSession, type StrengthSummaryExerciseInput } from '../strengthSummary';
import type { ActiveSetEntry } from '../strengthSession';

function set(overrides: Partial<ActiveSetEntry> = {}): ActiveSetEntry {
  return { id: overrides.id ?? `set_${Math.random()}`, completed: true, ...overrides };
}

test('summarizeStrengthSession computes completedSets/totalReps from completed sets only', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Squat', equipmentType: 'barbell',
    setEntries: [
      set({ reps: 8, completed: true }),
      set({ reps: 8, completed: true }),
      set({ reps: 8, completed: false }), // not counted
    ],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 600 });
  assert.equal(summary.completedSets, 2);
  assert.equal(summary.totalReps, 16);
  assert.equal(summary.exerciseCount, 1);
  assert.equal(summary.durationMinutes, 10);
});

test('externalLoadVolumeLb sums reps×weight for load-bearing equipment with a valid weight+unit only', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Bench Press', equipmentType: 'barbell',
    setEntries: [
      set({ reps: 5, weight: 135, weightUnit: 'lb' }),
      set({ reps: 5, weight: 135 }), // weight present but no unit — never guessed, excluded
      set({ reps: 5 }), // no weight — excluded
    ],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 });
  assert.equal(summary.externalLoadVolumeLb, 675); // only the first set counts
  assert.equal(summary.hasExternalLoadVolume, true);
  assert.equal(summary.totalReps, 15); // reps counted for all 3 completed sets regardless of load validity
});

test('externalLoadVolumeLb converts kg to the canonical lb unit via a single conversion', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Deadlift', equipmentType: 'barbell',
    setEntries: [set({ reps: 5, weight: 100, weightUnit: 'kg' })],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 });
  // 100kg -> ~220.46 lb * 5 reps
  assert.ok(Math.abs(summary.externalLoadVolumeLb - 1102.3) < 1);
});

test('band sets are counted separately and never converted into externalLoadVolumeLb', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Band Pull-Apart', equipmentType: 'resistance_band',
    setEntries: [
      set({ reps: 15, bandLevel: 'medium' }),
      set({ reps: 15, bandLevel: 'medium', weight: 20, weightUnit: 'lb' }), // even with a bogus weight, never counted
    ],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 });
  assert.equal(summary.bandSetsCount, 2);
  assert.equal(summary.hasExternalLoadVolume, false);
  assert.equal(summary.externalLoadVolumeLb, 0);
});

test('bodyweight sets are counted separately and never contribute externalLoadVolumeLb', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Push-Up', equipmentType: 'bodyweight',
    setEntries: [set({ reps: 12 }), set({ reps: 10 })],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 });
  assert.equal(summary.bodyweightSetsCount, 2);
  assert.equal(summary.hasExternalLoadVolume, false);
});

test('there is no combined universal volume field on the summary', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Squat', equipmentType: 'barbell',
    setEntries: [set({ reps: 5, weight: 100, weightUnit: 'lb' })],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 }) as Record<string, unknown>;
  assert.equal('volume' in summary, false);
  assert.equal('totalVolume' in summary, false);
  assert.equal('combinedVolume' in summary, false);
});

test('warm-up sets are excluded from totalReps and externalLoadVolumeLb but reported separately', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Squat', equipmentType: 'barbell',
    setEntries: [
      set({ reps: 10, weight: 45, weightUnit: 'lb', isWarmup: true }),
      set({ reps: 5, weight: 185, weightUnit: 'lb' }),
    ],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 });
  assert.equal(summary.totalReps, 5); // warm-up's 10 reps excluded
  assert.equal(summary.externalLoadVolumeLb, 925); // warm-up's 450 excluded
  assert.equal(summary.warmupSetsCount, 1);
  assert.equal(summary.warmupReps, 10);
  assert.equal(summary.completedSets, 2); // still counted toward completedSets
});

test('totalHoldSeconds sums hold time across completed sets', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Plank', equipmentType: 'bodyweight',
    setEntries: [set({ holdSeconds: 30 }), set({ holdSeconds: 45 }), set({ holdSeconds: 20, completed: false })],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 });
  assert.equal(summary.totalHoldSeconds, 75);
});

test('averageRpe uses set-level rpe, falling back to exercise-level rpeByExercise, excluding warm-ups', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Squat', equipmentType: 'barbell',
    setEntries: [
      set({ reps: 5, rpe: 9 }),
      set({ reps: 5 }), // no set-level rpe -> falls back to rpeByExercise
      set({ reps: 5, isWarmup: true, rpe: 3 }), // warm-up excluded from average
    ],
  }];
  const summary = summarizeStrengthSession({ exercises, rpeByExercise: { ex1: 7 }, durationSeconds: 300 });
  assert.equal(summary.averageRpe, 8); // (9 + 7) / 2
});

test('averageRpe is null when no rpe data is available anywhere', () => {
  const exercises: StrengthSummaryExerciseInput[] = [{
    id: 'ex1', name: 'Squat', equipmentType: 'barbell',
    setEntries: [set({ reps: 5 })],
  }];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 });
  assert.equal(summary.averageRpe, null);
});

test('skipped exercises are excluded from every aggregate', () => {
  const exercises: StrengthSummaryExerciseInput[] = [
    { id: 'ex1', name: 'Squat', equipmentType: 'barbell', setEntries: [set({ reps: 5, weight: 100, weightUnit: 'lb' })] },
    { id: 'ex2', name: 'Bench', equipmentType: 'barbell', skipped: true, setEntries: [set({ reps: 5, weight: 100, weightUnit: 'lb' })] },
  ];
  const summary = summarizeStrengthSession({ exercises, durationSeconds: 300 });
  assert.equal(summary.exerciseCount, 1);
  assert.equal(summary.completedSets, 1);
  assert.equal(summary.externalLoadVolumeLb, 500);
});
