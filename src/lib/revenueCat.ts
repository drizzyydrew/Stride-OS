import { Platform } from 'react-native';
import type Purchases from 'react-native-purchases';
import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';

const PRODUCT_IDS = new Set(['strideos_pro_monthly', 'strideos_pro_annual']);
let sdk: typeof Purchases | undefined;
let queue: Promise<unknown> = Promise.resolve();

export type Entitlements = { hasAnalysisCredits: boolean; isPro: boolean };
export type SubscriptionOption = {
  id: string;
  period: 'month' | 'year';
  price: string;
  amount?: number;
  currency?: string;
  monthlyEquivalent?: string;
  /** Present only when this owner is explicitly eligible for a store-supplied, zero-price offer. */
  freeTrial?: string;
  package: PurchasesPackage;
};

function freeTrialLabel(product: PurchasesPackage['product'], eligible: boolean): string | undefined {
  const intro = product.introPrice;
  if (!eligible || !intro || intro.price !== 0 || !Number.isSafeInteger(intro.cycles) || intro.cycles < 1
    || !Number.isSafeInteger(intro.periodNumberOfUnits) || intro.periodNumberOfUnits < 1) return undefined;
  const unit = ({ DAY: 'D', WEEK: 'W', MONTH: 'M', YEAR: 'Y' } as Record<string, string>)[intro.periodUnit];
  if (!unit || intro.period !== `P${intro.periodNumberOfUnits}${unit}`) return undefined;
  const count = intro.periodNumberOfUnits * intro.cycles;
  if (!Number.isSafeInteger(count)) return undefined;
  return unit === 'D' || unit === 'W' ? `${count * (unit === 'W' ? 7 : 1)}-day`
    : `${count}-${unit === 'M' ? 'month' : 'year'}`;
}

/** Compare actual recurring prices only; never parse a localized price string. */
export function annualSavingsPercent(options: SubscriptionOption[]): number | null {
  const annual = options.find(option => option.period === 'year');
  const monthly = options.find(option => option.period === 'month');
  if (!annual?.currency || annual.currency !== monthly?.currency || !Number.isFinite(annual.amount)
    || !Number.isFinite(monthly.amount) || annual.amount! <= 0 || monthly.amount! <= 0) return null;
  const savings = Math.floor((1 - annual.amount! / (monthly.amount! * 12)) * 100);
  return savings > 0 && savings < 100 ? savings : null;
}

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
  return withPurchases(async (client, assertCurrent) => {
    const current = (await client.getOfferings()).current;
    assertCurrent();
    const packages = (current?.availablePackages ?? []).filter(pkg => PRODUCT_IDS.has(pkg.product.identifier)
      && Number.isFinite(pkg.product.price) && pkg.product.price > 0
      && pkg.product.subscriptionPeriod === (pkg.product.identifier === 'strideos_pro_annual' ? 'P1Y' : 'P1M'));
    let eligibility: Awaited<ReturnType<typeof client.checkTrialOrIntroductoryPriceEligibility>> = {};
    if (packages.some(pkg => pkg.product.introPrice?.price === 0)) {
      try { eligibility = await client.checkTrialOrIntroductoryPriceEligibility(packages.map(pkg => pkg.product.identifier)); }
      catch { /* Unknown eligibility shows the standard price. Apple's confirmation remains authoritative. */ }
      assertCurrent();
    }
    return packages.map(pkg => {
      const period = pkg.product.identifier === 'strideos_pro_annual' ? 'year' as const : 'month' as const;
      const eligibleStatus = client.INTRO_ELIGIBILITY_STATUS?.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
      const eligible = eligibleStatus !== undefined && eligibility[pkg.product.identifier]?.status === eligibleStatus;
      return { id: pkg.identifier, period, price: pkg.product.priceString, amount: pkg.product.price,
        currency: pkg.product.currencyCode, monthlyEquivalent: period === 'year' ? pkg.product.pricePerMonthString ?? undefined : undefined,
        freeTrial: freeTrialLabel(pkg.product, eligible), package: pkg };
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
