import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  categoryFromActivityType,
  categoryFromScheduledType,
  classificationSatisfiesIntent,
  classifySubstitution,
} from '../substitution';

// ─── Brief example 1: same strength category, custom substitute ───────────

test('same strength category custom workout -> equivalent_substitute, satisfies intent', () => {
  const result = classifySubstitution({
    scheduledCategory: 'strength',
    actualCategory: 'strength',
    intentMatch: true,
  });
  assert.equal(result.classification, 'equivalent_substitute');
  assert.equal(result.satisfiesIntent, true);
  assert.equal(result.requiresExplicitAcceptance, false);
});

test('strength substitution started from a preset and meaningfully altered -> modified, not equivalent_substitute', () => {
  const result = classifySubstitution({
    scheduledCategory: 'strength',
    actualCategory: 'strength',
    intentMatch: true,
    startedFromPreset: true,
    presetAltered: true,
  });
  assert.equal(result.classification, 'modified');
  assert.equal(result.satisfiesIntent, true);
});

test('strength substitution with no matching training intent -> completed_other_activity', () => {
  const result = classifySubstitution({
    scheduledCategory: 'strength',
    actualCategory: 'strength',
    intentMatch: false,
  });
  assert.equal(result.classification, 'completed_other_activity');
  assert.equal(result.satisfiesIntent, false);
});

// ─── Brief example 2: easy run -> hard intervals ───────────────────────────

test('easy run scheduled, hard intervals actually run -> completed_other_activity, never auto as-prescribed', () => {
  const result = classifySubstitution({
    scheduledCategory: 'run',
    scheduledSubtype: 'easy',
    actualCategory: 'run',
    actualSubtype: 'intervals',
  });
  assert.equal(result.classification, 'completed_other_activity');
  assert.notEqual(result.classification, 'completed_as_prescribed');
  assert.equal(result.satisfiesIntent, false);
});

test('easy run -> hard intervals counts as intended only via an explicit athlete override', () => {
  const result = classifySubstitution({
    scheduledCategory: 'run',
    scheduledSubtype: 'easy',
    actualCategory: 'run',
    actualSubtype: 'intervals',
    explicitOverrideClassification: 'completed_as_prescribed',
  });
  assert.equal(result.classification, 'completed_as_prescribed');
  assert.equal(result.satisfiesIntent, true);
});

// ─── Brief example 3: active recovery -> easy walk / gentle cycle ─────────

test('active recovery -> easy walk is equivalent, not a substitution question', () => {
  const result = classifySubstitution({ scheduledCategory: 'active_recovery', actualCategory: 'walk' });
  assert.equal(result.classification, 'equivalent_substitute');
  assert.equal(result.satisfiesIntent, true);
  assert.equal(result.requiresExplicitAcceptance, false);
});

test('active recovery -> gentle cycle is equivalent', () => {
  const result = classifySubstitution({ scheduledCategory: 'active_recovery', actualCategory: 'cycling', actualSubtype: 'easy' });
  assert.equal(result.classification, 'equivalent_substitute');
  assert.equal(result.satisfiesIntent, true);
});

test('active recovery -> a hard ride is not automatically equivalent', () => {
  const result = classifySubstitution({ scheduledCategory: 'active_recovery', actualCategory: 'cycling', actualSubtype: 'hard' });
  assert.notEqual(result.classification, 'equivalent_substitute');
});

// ─── Brief example 4: running -> cycling requires explicit acceptance ─────

test('running -> cycling requires explicit acceptance and does not count until accepted', () => {
  const gated = classifySubstitution({ scheduledCategory: 'run', actualCategory: 'cycling' });
  assert.equal(gated.requiresExplicitAcceptance, true);
  assert.equal(gated.classification, 'completed_other_activity');
  assert.equal(gated.satisfiesIntent, false);
});

test('running -> cycling counts as equivalent_substitute once explicitly accepted', () => {
  const accepted = classifySubstitution({ scheduledCategory: 'run', actualCategory: 'cycling', explicitlyAccepted: true });
  assert.equal(accepted.classification, 'equivalent_substitute');
  assert.equal(accepted.satisfiesIntent, true);
  assert.equal(accepted.requiresExplicitAcceptance, true);
});

test('cycling -> running is gated symmetrically', () => {
  const gated = classifySubstitution({ scheduledCategory: 'cycling', actualCategory: 'run' });
  assert.equal(gated.requiresExplicitAcceptance, true);
  assert.equal(gated.classification, 'completed_other_activity');
});

// ─── Explicit override always wins ─────────────────────────────────────────

test('an explicit athlete classification override always wins over the matrix', () => {
  const result = classifySubstitution({
    scheduledCategory: 'run',
    actualCategory: 'cycling',
    explicitOverrideClassification: 'skipped',
  });
  assert.equal(result.classification, 'skipped');
  assert.equal(result.satisfiesIntent, false);
  assert.equal(result.requiresExplicitAcceptance, false);
});

// ─── Generic fallbacks ──────────────────────────────────────────────────────

test('cross-domain, non-gated mismatch (e.g. strength instead of scheduled mobility) is honestly completed_other_activity', () => {
  const result = classifySubstitution({ scheduledCategory: 'mobility', actualCategory: 'strength' });
  assert.equal(result.classification, 'completed_other_activity');
  assert.equal(result.satisfiesIntent, false);
});

test('same non-strength domain with matching intent is equivalent_substitute', () => {
  const result = classifySubstitution({ scheduledCategory: 'mobility', actualCategory: 'mobility', intentMatch: true });
  assert.equal(result.classification, 'equivalent_substitute');
  assert.equal(result.satisfiesIntent, true);
});

// ─── classificationSatisfiesIntent ─────────────────────────────────────────

test('classificationSatisfiesIntent matches the documented semantics', () => {
  assert.equal(classificationSatisfiesIntent('completed_as_prescribed'), true);
  assert.equal(classificationSatisfiesIntent('modified'), true);
  assert.equal(classificationSatisfiesIntent('equivalent_substitute'), true);
  assert.equal(classificationSatisfiesIntent('completed_other_activity'), false);
  assert.equal(classificationSatisfiesIntent('partial'), false);
  assert.equal(classificationSatisfiesIntent('skipped'), false);
});

// ─── Category mapping helpers ───────────────────────────────────────────────

test('categoryFromScheduledType maps calendar entry types onto substitution categories', () => {
  assert.equal(categoryFromScheduledType('run'), 'run');
  assert.equal(categoryFromScheduledType('rest'), 'active_recovery');
  assert.equal(categoryFromScheduledType('hiit'), 'cross_train');
  assert.equal(categoryFromScheduledType('unknown_type'), 'other');
  assert.equal(categoryFromScheduledType(undefined), 'other');
});

test('categoryFromActivityType maps ActivityType (+ subtype) onto substitution categories', () => {
  assert.equal(categoryFromActivityType('running'), 'run');
  assert.equal(categoryFromActivityType('running', 'run_walk'), 'run_walk');
  assert.equal(categoryFromActivityType('indoor_cycling'), 'cycling');
  assert.equal(categoryFromActivityType('strength'), 'strength');
  assert.equal(categoryFromActivityType('other'), 'other');
});
