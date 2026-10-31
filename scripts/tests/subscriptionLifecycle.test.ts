import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(enabled = true) {
  let active = true; let sdkId = ''; let configured = false; let sdkLoads = 0; let purchases = 0; let restores = 0;
  let afterOfferings: (() => void) | null = null; let afterIdentity: (() => void) | null = null;
  let pro = true;
  const product = { identifier: 'strideos_pro_monthly', price: 9.99, priceString: '$9.99' };
  const pkg = { identifier: '$rc_monthly', product };
  const info = () => ({ entitlements: { active: pro ? { pro: { isActive: true } } : {} } });
  const sdk = {
    isConfigured: async () => configured,
    configure: (config: any) => { assert.equal(config.automaticDeviceIdentifierCollectionEnabled, false); sdkId = config.appUserID; configured = true; },
    getAppUserID: async () => { const result = sdkId; afterIdentity?.(); afterIdentity = null; return result; },
    logIn: async (id: string) => { sdkId = id; },
    getCustomerInfo: async () => info(),
    getOfferings: async () => { afterOfferings?.(); return { current: { availablePackages: [pkg, { identifier: 'unapproved', product: { ...product, identifier: 'unexpected_product' } }] } }; },
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
  return { api: exports, pkg, revoke: () => { active = false; }, expire: () => { pro = false; },
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
