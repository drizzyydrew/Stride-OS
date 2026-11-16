const fs = require('node:fs');

function nonnegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a nonnegative safe integer.`);
  return value;
}
function plan(input = {}) {
  const monthly = nonnegativeInteger(input.monthlyPriceCents ?? 999, 'monthlyPriceCents');
  const annual = nonnegativeInteger(input.annualPriceCents ?? 7999, 'annualPriceCents');
  const target = nonnegativeInteger(input.targetMrrCents ?? 1000000, 'targetMrrCents');
  if (!monthly || !annual || !target || !Number.isSafeInteger(target * 12)) throw new Error('Prices and target must be positive and bounded.');
  let actual = null;
  if (input.verifiedPaidCounts != null) {
    const counts = input.verifiedPaidCounts;
    if (counts.environment !== 'production' || !['RevenueCat', 'Apple'].includes(counts.source)
      || typeof counts.asOf !== 'string' || !Number.isFinite(Date.parse(counts.asOf))) {
      throw new Error('Actual counts require dated production Apple or RevenueCat evidence. Sandbox and trial counts are not paid MRR.');
    }
    const monthlyCount = nonnegativeInteger(counts.monthly, 'paid monthly count');
    const annualCount = nonnegativeInteger(counts.annual, 'paid annual count');
    const numerator = monthlyCount * monthly * 12 + annualCount * annual;
    if (!Number.isSafeInteger(numerator)) throw new Error('Paid counts exceed safe calculation range.');
    const mrrCents = Math.round(numerator / 12);
    actual = { source: counts.source, asOf: counts.asOf, activePaidMonthly: monthlyCount, activePaidAnnual: annualCount,
      grossMrrUsd: mrrCents / 100, gapToTargetUsd: Math.max(0, target - mrrCents) / 100 };
  }
  const monthlyOnly = Math.ceil(target / monthly);
  const annualOnly = Math.ceil(target * 12 / annual);
  return {
    metric: 'gross monthly recurring revenue before fees and expenses', currency: 'USD',
    targetMrrUsd: target / 100, monthlyPriceUsd: monthly / 100, annualPriceUsd: annual / 100,
    scenarios: { monthlyOnlyPaidSubscribers: monthlyOnly, annualOnlyPaidSubscribers: annualOnly,
      monthlyOnlyOfferVisitorsAtHypotheticalFivePercentPaidConversion: monthlyOnly * 20 },
    actual, caveats: ['Trial starts and TestFlight purchases are not paid MRR.',
      'Annual payments are normalized over 12 months, not counted in full each month.',
      'Counts supplied by the operator are not independently verified by this offline calculator.',
      'Revenue is not profit or cash deposited. Audience size and conversion are unverified.'],
  };
}
module.exports = { plan };
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--input')) throw new Error('Usage: node scripts/launch-revenue-plan.cjs [--input aggregate-production-counts.json]');
    const input = args.length ? JSON.parse(fs.readFileSync(args[1], 'utf8')) : {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Input must be an aggregate JSON object.');
    process.stdout.write(JSON.stringify(plan(input), null, 2) + '\n');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
