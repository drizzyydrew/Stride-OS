import { COACH_PROVIDER_MODEL, estimateCoachTokenCostNanoUsd } from './coachProviderTelemetry.ts';

function integer(value: number, name: string, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw new Error(`Invalid ${name}`);
  return value;
}
function multiply(a: number, b: number, name: string) { return integer(a * b, name); }

/** Offline scenario only. No default budget, live quota, pricing or invoice is changed. */
export function planCoachCapacity(input: {
  monthlyBudgetCents: number;
  days: number;
  accounts: number;
  requestsPerAccountPerDay: number;
  globalRequestsPerDay: number;
  inputTokensPerRequest: number;
  outputTokensPerRequest: number;
}) {
  const budgetCents = integer(input.monthlyBudgetCents, 'budget');
  const days = integer(input.days, 'days', true);
  const accounts = integer(input.accounts, 'accounts');
  const perAccount = integer(input.requestsPerAccountPerDay, 'personal allowance', true);
  const global = integer(input.globalRequestsPerDay, 'shared allowance', true);
  const inputTokens = integer(input.inputTokensPerRequest, 'input tokens');
  const outputTokens = integer(input.outputTokensPerRequest, 'output tokens');
  const cost = estimateCoachTokenCostNanoUsd(COACH_PROVIDER_MODEL,
    { input: inputTokens, output: outputTokens, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
  if (!cost) throw new Error('Positive bounded request cost required');
  const personalPeriodRequests = multiply(perAccount, days, 'personal period requests');
  const requestedPeriodRequests = multiply(personalPeriodRequests, accounts, 'total period requests');
  const sharedPeriodRequests = multiply(global, days, 'shared period requests');
  const budgetNanoUsd = multiply(budgetCents, 10_000_000, 'budget nanodollars');
  const budgetPeriodRequests = Math.floor(budgetNanoUsd / cost);
  return { scope: 'hypothetical_capacity_not_observed_usage' as const, model: COACH_PROVIDER_MODEL,
    days, accounts, requestsPerAccountPerDay: perAccount, globalRequestsPerDay: global,
    estimatedCostPerRequestNanoUsd: cost, monthlyBudgetCents: budgetCents,
    requestedPeriodRequests, sharedPeriodRequests, budgetPeriodRequests,
    estimatedFullPersonalAllowanceCostNanoUsd: multiply(personalPeriodRequests, cost, 'personal cost'),
    estimatedFullRequestedCostNanoUsd: multiply(requestedPeriodRequests, cost, 'full requested cost'),
    estimatedSharedLimitCostNanoUsd: multiply(sharedPeriodRequests, cost, 'shared limit cost'),
    fullAllowanceAccountsWithinSharedLimit: Math.floor(sharedPeriodRequests / personalPeriodRequests),
    fullAllowanceAccountsWithinBudget: Math.floor(budgetPeriodRequests / personalPeriodRequests),
    fitsSharedLimit: requestedPeriodRequests <= sharedPeriodRequests,
    fitsIllustrativeBudget: requestedPeriodRequests <= budgetPeriodRequests,
  };
}
