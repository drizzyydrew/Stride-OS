import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FEATURE_TOURS,
  cardPlacementForTarget,
  completedTourStatus,
  featureTourAccessibilityLabel,
  highlightRectForTarget,
  nextStepIndex,
  previousStepIndex,
  shouldAutoStartTour,
  skippedTourStatus,
  type FeatureTourId,
} from '../../src/utils/featureTours';

const REQUIRED_TOURS: FeatureTourId[] = [
  'today',
  'calendar',
  'running',
  'strength',
  'ai-coach',
  'gear',
  'stride-report',
  'achievements',
  'movement-lab',
];

test('feature tour definitions cover the required Build 57 sections', () => {
  const ids = new Set(FEATURE_TOURS.map(tour => tour.id));
  for (const id of REQUIRED_TOURS) assert.equal(ids.has(id), true, `${id} tour is defined`);
});

test('feature tour definitions are versioned and compact', () => {
  for (const tour of FEATURE_TOURS) {
    assert.equal(Number.isInteger(tour.version), true, `${tour.id} has integer version`);
    assert.ok(tour.version >= 1, `${tour.id} version starts at one`);
    assert.ok(tour.steps.length > 0, `${tour.id} has steps`);
    for (const step of tour.steps) {
      assert.ok(step.id.length > 0, `${tour.id} step has id`);
      assert.ok(step.targetId.length > 0, `${tour.id} step has target`);
      assert.ok(step.title.split(/\s+/).length <= 6, `${tour.id}:${step.id} title is concise`);
      assert.ok(step.description.length <= 190, `${tour.id}:${step.id} description is compact`);
    }
  }
});

test('Movement Lab replay only targets always-visible walkthrough regions', () => {
  const movement = FEATURE_TOURS.find(tour => tour.id === 'movement-lab');
  assert.ok(movement, 'movement-lab tour is defined');
  const alwaysVisibleTargets = new Set(['movement.assessments', 'movement.capture']);
  for (const step of movement.steps) {
    assert.equal(alwaysVisibleTargets.has(step.targetId), true, `${step.id} targets an always-visible Movement Lab region`);
  }
});

test('first-use tours start only when current version has not been seen', () => {
  const definition = { version: 2 };
  assert.equal(shouldAutoStartTour(definition, undefined), true);
  assert.equal(shouldAutoStartTour(definition, { completed: true, lastSeenVersion: 2 }), false);
  assert.equal(shouldAutoStartTour(definition, { skipped: true, lastSeenVersion: 2 }), false);
  assert.equal(shouldAutoStartTour(definition, { completed: true, lastSeenVersion: 1 }), true);
  assert.equal(shouldAutoStartTour(definition, { skipped: true, lastSeenVersion: 1 }), true);
});

test('completed and skipped status preserve independent outcomes', () => {
  const completed = completedTourStatus({ version: 3 }, 1000);
  assert.deepEqual(completed, { completed: true, skipped: false, lastSeenVersion: 3, completedAt: 1000 });

  const skipped = skippedTourStatus({ version: 3 }, 2000);
  assert.deepEqual(skipped, { completed: false, skipped: true, lastSeenVersion: 3, skippedAt: 2000 });
});

test('step progression clamps safely for next, back, and done flows', () => {
  assert.equal(nextStepIndex(0, 3), 1);
  assert.equal(nextStepIndex(2, 3), 2);
  assert.equal(previousStepIndex(2), 1);
  assert.equal(previousStepIndex(0), 0);
});

test('missing target uses safe centered placement instead of failing', () => {
  const placement = cardPlacementForTarget({
    target: null,
    viewportWidth: 320,
    viewportHeight: 640,
    insets: { top: 47, bottom: 34 },
    preferredPlacement: 'bottom',
  });
  assert.equal(placement.placement, 'center');
  assert.ok(placement.top >= 59);
  assert.ok(placement.top <= 260);
  assert.ok(placement.left >= 16);
  assert.ok(placement.width <= 288);
});

test('target placement respects narrow screens and safe areas', () => {
  const placement = cardPlacementForTarget({
    target: { x: 12, y: 84, width: 296, height: 72 },
    viewportWidth: 320,
    viewportHeight: 568,
    insets: { top: 44, bottom: 34 },
    preferredPlacement: 'bottom',
  });
  assert.ok(placement.top > 150);
  assert.equal(placement.left, 16);
  assert.equal(placement.width, 288);
});

test('top placement falls back below when there is not enough top room', () => {
  const placement = cardPlacementForTarget({
    target: { x: 20, y: 70, width: 260, height: 48 },
    viewportWidth: 390,
    viewportHeight: 844,
    insets: { top: 59, bottom: 34 },
    preferredPlacement: 'top',
  });
  assert.equal(placement.placement, 'bottom');
});

test('highlight rect pads targets without leaving the viewport', () => {
  const rect = highlightRectForTarget({ x: 2, y: 4, width: 340, height: 20 }, 320);
  assert.deepEqual(rect, { x: 8, y: 8, width: 304, height: 44 });
  assert.equal(highlightRectForTarget(null, 320), null);
});

test('accessibility label exposes title, progress, and description', () => {
  const step = {
    id: 'sample',
    targetId: 'target',
    title: 'Start Run',
    description: 'Start a planned or free run.',
  };
  assert.equal(
    featureTourAccessibilityLabel(step, 1, 4),
    'Start Run. Step 2 of 4. Start a planned or free run.',
  );
  assert.equal(
    featureTourAccessibilityLabel({ ...step, accessibilityLabel: 'Custom label' }, 0, 1),
    'Custom label',
  );
});

test('tour completion is independent between features', () => {
  const today = completedTourStatus({ version: 1 }, 10);
  const running = skippedTourStatus({ version: 1 }, 20);
  const status: Partial<Record<FeatureTourId, typeof today | typeof running>> = {
    today,
    running,
  };
  assert.equal(status.today?.completed, true);
  assert.equal(status.running?.skipped, true);
});
