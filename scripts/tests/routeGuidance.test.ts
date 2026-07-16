import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBreadcrumbGuidancePlan,
  createTurnByTurnGuidancePlan,
  formatTurnAnnouncement,
  updateRouteGuidanceProgress,
} from '../../src/lib/routeGuidance';

const route = [
  { latitude: 44.0580, longitude: -121.3150 },
  { latitude: 44.0585, longitude: -121.3150 },
  { latitude: 44.0590, longitude: -121.3145 },
];

test('directions off disables navigation without discarding route geometry', () => {
  const plan = createBreadcrumbGuidancePlan(route, 'off');
  assert.equal(plan.kind, 'disabled');
  assert.equal(plan.geometry.length, route.length);
  assert.equal(plan.supportsTurnAnnouncements, false);
});

test('manual routes remain breadcrumb guidance and never claim turn-by-turn steps', () => {
  const plan = createBreadcrumbGuidancePlan(route, 'walking');
  assert.equal(plan.kind, 'breadcrumb');
  assert.equal(plan.provider, 'saved_route');
  assert.equal(plan.supportsTurnAnnouncements, false);
  assert.match(plan.limitation ?? '', /does not include routable steps/i);
});

test('MapKit steps create turn-by-turn walking and cycling guidance', () => {
  for (const mode of ['walking', 'cycling'] as const) {
    const plan = createTurnByTurnGuidancePlan({
      mode,
      geometry: route,
      steps: [{
        id: 'one',
        instruction: 'Turn left onto Pine Street',
        distanceMeters: 120,
        expectedTravelTimeSeconds: 30,
        start: route[0],
        end: route[1],
      }],
    });
    assert.equal(plan.kind, 'turn_by_turn');
    assert.equal(plan.provider, 'mapkit');
    assert.equal(plan.supportsTurnAnnouncements, true);
    assert.equal(plan.supportsRerouting, true);
  }
});

test('off-route state requires sustained samples instead of one noisy location', () => {
  const plan = createBreadcrumbGuidancePlan(route, 'walking');
  const far = { latitude: 44.0600, longitude: -121.3200 };
  const first = updateRouteGuidanceProgress({ point: far, plan });
  const second = updateRouteGuidanceProgress({ point: far, plan, previous: first });
  const third = updateRouteGuidanceProgress({ point: far, plan, previous: second });
  assert.equal(first.isOffRoute, false);
  assert.equal(second.isOffRoute, false);
  assert.equal(third.isOffRoute, true);
  assert.equal(third.nextInstruction, 'Follow saved route');
});

test('turn guidance exposes the next step and advances after reaching its endpoint', () => {
  const plan = createTurnByTurnGuidancePlan({
    mode: 'walking',
    geometry: route,
    steps: [
      {
        id: 'one',
        instruction: 'Turn left onto Pine Street',
        distanceMeters: 55,
        expectedTravelTimeSeconds: 20,
        start: route[0],
        end: route[1],
      },
      {
        id: 'two',
        instruction: 'Continue onto Riverside Boulevard',
        distanceMeters: 70,
        expectedTravelTimeSeconds: 30,
        start: route[1],
        end: route[2],
      },
    ],
  });
  const initial = updateRouteGuidanceProgress({ point: route[0], plan });
  const advanced = updateRouteGuidanceProgress({ point: route[1], plan, previous: initial });
  assert.equal(initial.nextInstruction, 'Turn left onto Pine Street');
  assert.equal(advanced.nextInstruction, 'Continue onto Riverside Boulevard');
});

test('turn announcements use direct wording near a turn and distance context earlier', () => {
  assert.equal(formatTurnAnnouncement('Turn right onto Riverside Boulevard', 20), 'Turn right onto Riverside Boulevard');
  assert.match(formatTurnAnnouncement('Turn left onto Pine Street', 92), /^In \d+ feet, turn left/);
});
