import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(enabled = true) {
  let active = true; let sdkId = ''; let configured = false; let sdkLoads = 0; let purchases = 0; let restores = 0;
  let afterOfferings: (() => void) | null = null; let afterIdentity: (() => void) | null = null;
  let pro = true; let expiry: string | null = null;
  const product: any = { identifier: 'strideos_pro_monthly', price: 9.99, priceString: '$9.99', currencyCode: 'USD', subscriptionPeriod: 'P1M' };
  const pkg = { identifier: '$rc_monthly', product };
  let packages = [pkg, { identifier: 'unapproved', product: { ...product, identifier: 'unexpected_product' } }];
  let eligibility = 2, eligibilityFails = false, afterEligibility: (() => void) | null = null;
  const info = () => ({ entitlements: { active: pro ? { pro: { isActive: true, expirationDate: expiry } } : {} } });
  const sdk = {
    isConfigured: async () => configured,
    configure: (config: any) => { assert.equal(config.automaticDeviceIdentifierCollectionEnabled, false); sdkId = config.appUserID; configured = true; },
    getAppUserID: async () => { const result = sdkId; afterIdentity?.(); afterIdentity = null; return result; },
    logIn: async (id: string) => { sdkId = id; },
    getCustomerInfo: async () => info(),
    INTRO_ELIGIBILITY_STATUS: { INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2 },
    checkTrialOrIntroductoryPriceEligibility: async (ids: string[]) => {
      afterEligibility?.(); if (eligibilityFails) throw new Error('Eligibility unavailable');
      return Object.fromEntries(ids.map(id => [id, { status: eligibility }]));
    },
    getOfferings: async () => { afterOfferings?.(); return { current: { availablePackages: packages } }; },
    purchasePackage: async () => { purchases++; return { customerInfo: info() }; },
    restorePurchases: async () => { restores++; return info(); },
  };
  const exports: any = {};
  const code = ts.transpileModule(fs.readFileSync('src/lib/revenueCat.ts', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, process: { env: { EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED: enabled ? 'true' : 'false', EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_testpublickey' } },
    require: (id: string) => {
      if (id === 'react-native') return { Platform: { OS: 'ios' } };
      if (id.endsWith('localDataOwner')) return { captureOwnerLease: () => active ? { ownerUserId: 'verified-owner', generation: 1 } : null, ownerLeaseIsCurrent: () => active };
      if (id === 'react-native-purchases') { sdkLoads++; return { __esModule: true, default: sdk }; }
      throw new Error(`Unexpected import ${id}`);
    },
  });
  return { api: exports, pkg, setExpiry: (value: string | null) => { expiry = value; }, revoke: () => { active = false; }, expire: () => { pro = false; },
    setPackages: (next: typeof packages) => { packages = next; },
    eligibility: (status: number, fail = false) => { eligibility = status; eligibilityFails = fail; },
    afterEligibility: (fn: () => void) => { afterEligibility = fn; },
    afterOfferings: (fn: () => void) => { afterOfferings = fn; }, afterIdentity: (fn: () => void) => { afterIdentity = fn; },
    counts: () => ({ sdkLoads, purchases, restores }) };
}
test('disabled billing cannot initialize an SDK or start a purchase', async () => {
  const h = harness(false); assert.equal(h.api.billingIsConfigured(), false);
  await assert.rejects(h.api.getSubscriptionOptions());
  assert.equal((await h.api.checkEntitlements()).isPro, false);
  assert.deepEqual(h.counts(), { sdkLoads: 0, purchases: 0, restores: 0 });
});
test('known store plans use their actual localized price and restore requires an explicit call', async () => {
  const h = harness(); const options = await h.api.getSubscriptionOptions();
  assert.equal(options.length, 1); assert.equal(options[0].price, '$9.99'); assert.equal(h.counts().restores, 0);
  assert.equal((await h.api.purchaseSubscription(options[0])).isPro, true); assert.equal(h.counts().purchases, 1);
  assert.equal((await h.api.restoreSubscriptions()).isPro, true); assert.equal(h.counts().restores, 1);
  h.expire(); assert.equal((await h.api.checkEntitlements()).isPro, false);
});
test('an owner change during an awaited SDK identity lookup prevents a purchase', async () => {
  const h = harness(); const options = await h.api.getSubscriptionOptions();
  h.afterIdentity(h.revoke);
  await assert.rejects(h.api.purchaseSubscription(options[0])); assert.equal(h.counts().purchases, 0);
});
test('an owner change during offering refresh cannot charge the retired account', async () => {
  const h = harness(); const options = await h.api.getSubscriptionOptions(); h.afterOfferings(h.revoke);
  await assert.rejects(h.api.purchaseSubscription(options[0])); assert.equal(h.counts().purchases, 0);
});
test('unapproved and stale packages never reach the purchase API', async () => {
  const h = harness();
  await assert.rejects(h.api.purchaseSubscription({ id: 'unapproved', package: { product: { identifier: 'unexpected_product' } } }));
  assert.equal(h.counts().purchases, 0);
});

test('free-trial copy requires explicit owner eligibility and actual zero-price period metadata', async () => {
  const h = harness();
  h.pkg.product.introPrice = { price: 0, cycles: 1, period: 'P2W', periodUnit: 'WEEK', periodNumberOfUnits: 2 };
  assert.equal((await h.api.getSubscriptionOptions())[0].freeTrial, '14-day');
  h.pkg.product.introPrice = { ...h.pkg.product.introPrice, period: 'P1W', periodNumberOfUnits: 1 };
  assert.equal((await h.api.getSubscriptionOptions())[0].freeTrial, '7-day');
  for (const status of [0, 1, 3]) {
    h.eligibility(status); assert.equal((await h.api.getSubscriptionOptions())[0].freeTrial, undefined);
  }
  h.eligibility(2, true); assert.equal((await h.api.getSubscriptionOptions())[0].freeTrial, undefined);
  h.eligibility(2); h.pkg.product.introPrice.price = 1;
  assert.equal((await h.api.getSubscriptionOptions())[0].freeTrial, undefined);
  h.pkg.product.introPrice.price = 0; h.pkg.product.introPrice.period = 'P2W';
  assert.equal((await h.api.getSubscriptionOptions())[0].freeTrial, undefined, 'mismatched period is never advertised');
});

test('eligibility lookup cannot publish retired-owner plans', async () => {
  const h = harness();
  h.pkg.product.introPrice = { price: 0, cycles: 1, period: 'P2W', periodUnit: 'WEEK', periodNumberOfUnits: 2 };
  h.afterEligibility(h.revoke);
  await assert.rejects(h.api.getSubscriptionOptions());
  assert.equal(h.counts().purchases, 0);
});

test('annual savings compare numeric recurring prices in the same currency and keep store formatting', async () => {
  const h = harness();
  const annual = { identifier: '$rc_annual', product: { ...h.pkg.product, identifier: 'strideos_pro_annual', subscriptionPeriod: 'P1Y', price: 79.99, priceString: '79,99 $US', pricePerMonthString: '6,67 $US' } };
  h.setPackages([h.pkg, annual]);
  const options = await h.api.getSubscriptionOptions();
  assert.equal(options[1].price, '79,99 $US'); assert.equal(options[1].monthlyEquivalent, '6,67 $US');
  assert.equal(h.api.annualSavingsPercent(options), 33);
  options[1].currency = 'EUR'; assert.equal(h.api.annualSavingsPercent(options), null);
  options[1].currency = 'USD'; options[1].amount = 150; assert.equal(h.api.annualSavingsPercent(options), null);
  assert.equal(h.api.annualSavingsPercent([options[0]]), null);
  annual.product.subscriptionPeriod = 'P6M';
  assert.equal((await h.api.getSubscriptionOptions()).length, 1, 'unexpected periods are not sold as annual');
  annual.product.subscriptionPeriod = null;
  assert.equal((await h.api.getSubscriptionOptions()).length, 1, 'missing periods are not inferred from a product name');
});

test('entitlement carries the verified expiry including store grace extensions, without treating cancellation as expiry', async () => {
  const h = harness();
  h.setExpiry('2030-01-15T12:00:00Z');
  const active = await h.api.checkEntitlements();
  assert.equal(active.isPro, true);
  assert.equal(active.proExpiresAt, Date.parse('2030-01-15T12:00:00Z'));
  h.setExpiry('invalid');
  assert.equal((await h.api.checkEntitlements()).proExpiresAt, null);
  h.setExpiry(null);
  assert.equal((await h.api.checkEntitlements()).proExpiresAt, null);
  h.expire();
  assert.equal((await h.api.checkEntitlements()).isPro, false);
});
