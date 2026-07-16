import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  nextScrubInteractionState,
  scrubFractionFromX,
} from '../scrubInteraction';

test('full scrubber width maps continuously to zero through one', () => {
  assert.equal(scrubFractionFromX(0, 320), 0);
  assert.equal(scrubFractionFromX(80, 320), 0.25);
  assert.equal(scrubFractionFromX(160, 320), 0.5);
  assert.equal(scrubFractionFromX(320, 320), 1);
  assert.equal(scrubFractionFromX(-20, 320), 0);
  assert.equal(scrubFractionFromX(400, 320), 1);
});

test('scrub interaction remains locked until release or cancellation', () => {
  assert.equal(nextScrubInteractionState('idle', 'start'), 'dragging');
  assert.equal(nextScrubInteractionState('dragging', 'end'), 'idle');
  assert.equal(nextScrubInteractionState('idle', 'start'), 'dragging');
  assert.equal(nextScrubInteractionState('dragging', 'cancel'), 'idle');
});
