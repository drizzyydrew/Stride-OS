import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const { plan } = createRequire(import.meta.url)('../launch-revenue-plan.cjs');

test('launch planning keeps actual revenue unknown until production paid counts are supplied', () => {
  const result = plan();
  assert.equal(result.actual, null);
  assert.equal(result.scenarios.monthlyOnlyPaidSubscribers, 1002);
  assert.equal(result.scenarios.annualOnlyPaidSubscribers, 1501);
});
test('annual cash collections are normalized rather than inflated into monthly revenue', () => {
  const result = plan({ verifiedPaidCounts: { source: 'RevenueCat', environment: 'production', asOf: '2026-11-16T00:00:00Z', monthly: 0, annual: 126 } });
  assert.equal(result.actual.grossMrrUsd, 839.9);
  assert.equal(result.actual.gapToTargetUsd, 9160.1);
});
test('mixed paid plans reach the target while sandbox, missing, and fractional counts fail', () => {
  const counts = { source: 'Apple', environment: 'production', asOf: '2026-11-16T00:00:00Z', monthly: 500, annual: 752 };
  assert.equal(plan({ verifiedPaidCounts: counts }).actual.grossMrrUsd, 10007.71);
  assert.equal(plan({ verifiedPaidCounts: counts }).actual.gapToTargetUsd, 0);
  for (const bad of [{ environment: 'sandbox' }, { monthly: null }, { annual: 0.5 }, { asOf: 'not-a-date' }, { source: 'Trial starts' }]) {
    assert.throws(() => plan({ verifiedPaidCounts: { ...counts, ...bad } }));
  }
});
