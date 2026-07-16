import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  attachRouteState,
  detachRouteState,
  migrateRouteAttachment,
  reverseDistanceFromStart,
  reverseRouteState,
} from '../../src/utils/routeAttachment';

test('route detachment is persistent and non-destructive', () => {
  const attached = attachRouteState('river-loop', 100);
  const detached = detachRouteState(attached, 200);
  assert.equal(detached.routeId, null);
  assert.equal(detached.status, 'detached');
  assert.equal(detached.lastDetachedRouteId, 'river-loop');
  assert.equal(detached.detachedAt, 200);
  assert.equal(migrateRouteAttachment(detached, null).lastDetachedRouteId, 'river-loop');
});

test('route direction reverses active guidance without changing route identity', () => {
  const attached = attachRouteState('river-loop', 100);
  const reversed = reverseRouteState(attached);
  assert.equal(reversed.routeId, 'river-loop');
  assert.equal(reversed.direction, 'reverse');
  assert.equal(reverseDistanceFromStart(6.2, 1.2), 5);
  assert.equal(reverseRouteState(reversed).direction, 'forward');
});
