import assert from 'node:assert/strict';
import test from 'node:test';
import { planCoachCapacity } from '../../supabase/functions/_shared/coachCapacity';

const input = { monthlyBudgetCents: 2000, days: 30, accounts: 1002, requestsPerAccountPerDay: 20,
  globalRequestsPerDay: 500, inputTokensPerRequest: 2000, outputTokensPerRequest: 400 };

test('full daily personal allowance, shared capacity and currency budget remain separate', () => {
  const p = planCoachCapacity(input);
  assert.equal(p.scope, 'hypothetical_capacity_not_observed_usage');
  assert.equal(p.requestedPeriodRequests, 601_200);
  assert.equal(p.sharedPeriodRequests, 15_000);
  assert.equal(p.budgetPeriodRequests, 5_000);
  assert.equal(p.estimatedFullPersonalAllowanceCostNanoUsd / 1e9, 2.4);
  assert.equal(p.estimatedFullRequestedCostNanoUsd / 1e9, 2404.8);
  assert.equal(p.estimatedSharedLimitCostNanoUsd / 1e9, 60);
  assert.equal(p.fullAllowanceAccountsWithinSharedLimit, 25);
  assert.equal(p.fullAllowanceAccountsWithinBudget, 8);
  assert.equal(p.fitsSharedLimit, false); assert.equal(p.fitsIllustrativeBudget, false);
  assert.equal(input.monthlyBudgetCents, 2000); assert.equal(input.globalRequestsPerDay, 500);
});

test('more expensive input/output, zero budget and an empty cohort do not invent affordable access', () => {
  const long = planCoachCapacity({ ...input, inputTokensPerRequest: 12_000, outputTokensPerRequest: 1024 });
  assert.equal(long.estimatedCostPerRequestNanoUsd / 1e9, 0.01712);
  assert.equal(long.fullAllowanceAccountsWithinBudget, 1);
  const zero = planCoachCapacity({ ...input, monthlyBudgetCents: 0 });
  assert.equal(zero.budgetPeriodRequests, 0); assert.equal(zero.fitsIllustrativeBudget, false);
  const empty = planCoachCapacity({ ...input, accounts: 0 });
  assert.equal(empty.requestedPeriodRequests, 0); assert.equal(empty.estimatedFullRequestedCostNanoUsd, 0);
});

test('invalid and overflowing planning inputs fail instead of rounding away a cost or quantity', () => {
  for (const patch of [{ monthlyBudgetCents: -1 }, { days: 0 }, { accounts: 1.5 },
    { globalRequestsPerDay: NaN }, { requestsPerAccountPerDay: Infinity },
    { inputTokensPerRequest: 0, outputTokensPerRequest: 0 }, { accounts: Number.MAX_SAFE_INTEGER },
    { monthlyBudgetCents: Number.MAX_SAFE_INTEGER }, { inputTokensPerRequest: Number.MAX_SAFE_INTEGER }]) {
    assert.throws(() => planCoachCapacity({ ...input, ...patch }));
  }
});
