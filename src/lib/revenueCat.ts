import { Platform } from 'react-native';
import type Purchases from 'react-native-purchases';
import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';

const PRODUCT_IDS = new Set(['strideos_pro_monthly', 'strideos_pro_annual']);
let sdk: typeof Purchases | undefined;
let queue: Promise<unknown> = Promise.resolve();

export type Entitlements = { hasAnalysisCredits: boolean; isPro: boolean };
export type SubscriptionOption = { id: string; period: 'month' | 'year'; price: string; package: PurchasesPackage };

export function billingIsConfigured() {
  return Platform.OS === 'ios' && process.env.EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED === 'true'
    && /^appl_[A-Za-z0-9]+$/.test(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '');
}
function entitlements(info: CustomerInfo): Entitlements {
  return { isPro: Boolean(info.entitlements.active.pro?.isActive), hasAnalysisCredits: false };
}
async function withPurchases<T>(action: (client: typeof Purchases, assertCurrent: () => void) => Promise<T>): Promise<T> {
  const lease = captureOwnerLease(true);
  if (!lease || !billingIsConfigured()) throw new Error('Subscriptions are unavailable. No payment was started.');
  const task = queue.then(async () => {
    const assertCurrent = () => { if (!ownerLeaseIsCurrent(lease, true)) throw new Error('Your account changed. Please try again.'); };
    assertCurrent();
    sdk ??= (await import('react-native-purchases')).default;
    assertCurrent();
    const configured = await sdk.isConfigured();
    assertCurrent();
    if (!configured) {
      sdk.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!, appUserID: lease.ownerUserId,
        automaticDeviceIdentifierCollectionEnabled: false, shouldShowInAppMessagesAutomatically: false });
    } else {
      const priorUser = await sdk.getAppUserID();
      assertCurrent();
      if (priorUser !== lease.ownerUserId) { await sdk.logIn(lease.ownerUserId); assertCurrent(); }
    }
    const sdkOwner = await sdk.getAppUserID();
    assertCurrent();
    if (sdkOwner !== lease.ownerUserId) throw new Error('Membership identity could not be verified.');
    const result = await action(sdk, assertCurrent);
    const completedOwner = await sdk.getAppUserID();
    assertCurrent();
    if (completedOwner !== lease.ownerUserId) throw new Error('Your account changed. Check your Apple purchase history before retrying.');
    return result;
  });
  queue = task.catch(() => undefined);
  return task;
}
export async function initRevenueCat(_userId?: string): Promise<void> {
  await withPurchases(async () => undefined);
}
export async function checkEntitlements(): Promise<Entitlements> {
  if (!billingIsConfigured()) return { isPro: false, hasAnalysisCredits: false };
  return withPurchases(async client => entitlements(await client.getCustomerInfo()));
}
export async function getSubscriptionOptions(): Promise<SubscriptionOption[]> {
  return withPurchases(async client => {
    const current = (await client.getOfferings()).current;
    return (current?.availablePackages ?? []).flatMap(pkg => {
      if (!PRODUCT_IDS.has(pkg.product.identifier) || pkg.product.price <= 0) return [];
      const period = pkg.product.identifier === 'strideos_pro_annual' ? 'year' as const : 'month' as const;
      return [{ id: pkg.identifier, period, price: pkg.product.priceString, package: pkg }];
    });
  });
}
export async function purchaseSubscription(option: SubscriptionOption): Promise<Entitlements> {
  return withPurchases(async (client, assertCurrent) => {
    const current = (await client.getOfferings()).current?.availablePackages.find(pkg => pkg.identifier === option.id
      && pkg.product.identifier === option.package.product.identifier && PRODUCT_IDS.has(pkg.product.identifier));
    if (!current) throw new Error('This plan is no longer available. Reload the available plans.');
    assertCurrent();
    return entitlements((await client.purchasePackage(current)).customerInfo);
  });
}
export async function restoreSubscriptions(): Promise<Entitlements> {
  return withPurchases(async client => entitlements(await client.restorePurchases()));
}
