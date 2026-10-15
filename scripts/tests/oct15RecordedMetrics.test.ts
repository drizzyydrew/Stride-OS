import assert from 'node:assert/strict';
import test from 'node:test';
import type { Activity } from '../../src/types/activity';
import { buildActivitySummary } from '../../src/utils/activitySummary';

test('recorded running dynamics and cadence retain units and do not hide zero elevation', () => {
  const activity = { activityType: 'running', startTime: 1000, metrics: {
    durationSeconds: 600, distanceMeters: 1800, elevationGainMeters: 0, stepCount: 1800,
    cadenceSpm: 180, runningPowerWatts: 250,
    runningDynamics: { averageGroundContactTimeMs: 240, averageStrideLengthMeters: 1.2, averageVerticalOscillationMeters: 0.08 },
  }, trainingLoad: { wholeBody: 30 } } as Activity;
  for (const units of ['imperial', 'metric'] as const) {
    const summary = buildActivitySummary(activity, units, { dataRich: true });
    const rows = [...summary.primary, ...summary.sections.flatMap(section => section.metrics)];
    const value = (label: string) => rows.find(row => row.label === label)?.value;
    assert.equal(value('Cadence'), '180 spm');
    assert.equal(value('Ground contact time'), '240 ms');
    assert.equal(value('Running power (device estimate)'), '250 W');
    assert.equal(value('Elevation gain'), units === 'metric' ? '0 m' : '0 ft');
    assert.equal(value('Stride length'), units === 'metric' ? '1.20 m' : '3.94 ft');
    assert.equal(value('Vertical oscillation'), units === 'metric' ? '8.0 cm' : '3.1 in');
  }
});
