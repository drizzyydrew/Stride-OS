import assert from 'node:assert/strict';
import test from 'node:test';
import { locateFeatureTourTarget } from '../../src/utils/feature-tour-runtime';
import { highlightRectForTarget, scrollOffsetForTourTarget } from '../../src/utils/featureTours';

const viewport = { x: 0, y: 140, width: 390, height: 620 };

test('offscreen feature is scrolled into its real viewport before outlining', async () => {
  let offset = 0;
  const nativeMeasure = () => ({ x: 18, y: 1100 - offset, width: 354, height: 100 });
  const rect = await locateFeatureTourTarget({
    find: () => ({
      reveal: async current => { if (current()) offset = scrollOffsetForTourTarget(nativeMeasure(), viewport, offset); },
      measure: async () => nativeMeasure(),
    }), current: () => true, pause: async () => {},
    visible: value => highlightRectForTarget(value, 390, 844) !== null,
  });
  assert.equal(offset, 936);
  assert.deepEqual(rect, { x: 18, y: 164, width: 354, height: 100 });
  assert.deepEqual(highlightRectForTarget(rect, 390, 844), { x: 10, y: 156, width: 370, height: 116 });
});

test('prepare reveals a conditional subview before target measurement', async () => {
  let active = false; let measured = 0;
  const rect = { x: 20, y: 200, width: 300, height: 50 };
  const result = await locateFeatureTourTarget({
    prepare: () => { active = true; },
    find: () => active ? { measure: async () => { measured += 1; return rect; } } : undefined,
    current: () => true, visible: () => true, pause: async () => {},
  });
  assert.equal(result, rect); assert.equal(measured, 1);
});

test('missing targets finish after bounded attempts without invented highlight', async () => {
  let attempts = 0;
  const result = await locateFeatureTourTarget({
    find: () => { attempts += 1; return undefined; }, current: () => true,
    visible: () => true, pause: async () => {},
  });
  assert.equal(attempts, 8); assert.equal(result, null);
});

test('dismissal during reveal prevents measurement and stale outline publication', async () => {
  let current = true; let measures = 0;
  const result = await locateFeatureTourTarget({
    find: () => ({ reveal: async () => { current = false; }, measure: async () => { measures += 1; return null; } }),
    current: () => current, visible: () => true, pause: async () => {},
  });
  assert.equal(result, null); assert.equal(measures, 0);
});

test('late native callback cannot revive a dismissed step', async () => {
  let current = true; let finish!: (value: any) => void;
  const pending = locateFeatureTourTarget({
    find: () => ({ measure: () => new Promise(resolve => { finish = resolve; }) }),
    current: () => current, visible: () => true, pause: async () => {},
  });
  await Promise.resolve(); await Promise.resolve();
  current = false; finish({ x: 10, y: 200, width: 300, height: 60 });
  assert.equal(await pending, null);
});

test('visible cards keep their scroll position and oversized cards align predictably', () => {
  assert.equal(scrollOffsetForTourTarget({ x: 20, y: 200, width: 350, height: 100 }, viewport, 500), 500);
  assert.equal(scrollOffsetForTourTarget({ x: 20, y: 900, width: 350, height: 1200 }, viewport, 500), 1236);
  assert.equal(scrollOffsetForTourTarget({ x: 20, y: -400, width: 350, height: 100 }, viewport, 500), 0);
});
