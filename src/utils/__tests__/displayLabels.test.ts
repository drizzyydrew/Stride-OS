import assert from 'node:assert/strict';
import test from 'node:test';

import { displayLabel, displayLabels } from '../displayLabels';

test('normalizes approved equipment and activity identifiers', () => {
  assert.equal(displayLabel('squat_rack'), 'Squat rack');
  assert.equal(displayLabel('body_weight'), 'Bodyweight');
  assert.equal(displayLabel('resistance_band'), 'Resistance band');
  assert.equal(displayLabel('indoor_cycling'), 'Indoor cycling');
  assert.equal(displayLabel('cross_country_skiing'), 'Cross-country skiing');
  assert.equal(displayLabel('mixed_modal'), 'Mixed-modal');
  assert.equal(displayLabel('heart_rate'), 'Heart rate');
});

test('handles multiple separators without exposing internal enum syntax', () => {
  assert.equal(displayLabel('very_long_equipment_name'), 'Very long equipment name');
  assert.equal(displayLabel('road-bike_trainer'), 'Road bike trainer');
  assert.equal(displayLabels(['squat_rack', 'resistance_band']), 'Squat rack, Resistance band');
});
