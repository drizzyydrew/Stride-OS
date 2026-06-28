// ─── RevenueCat Integration ───────────────────────────────────────────────────
//
// Requires: react-native-purchases (native module — needs EAS custom dev client).
// Product IDs are configured in App Store Connect after Apple Developer account
// is active. Guarded with try/catch so the app runs on Expo Go without crashing.

type OptionalPurchasesModule = {
  default: {
    configure: (options: { apiKey: string }) => Promise<void> | void;
    logIn: (userId: string) => Promise<unknown> | unknown;
    getCustomerInfo: () => Promise<{ entitlements: { active: Record<string, unknown> } }>;
    getOfferings: () => Promise<{ current?: { availablePackages: unknown[] } | null }>;
    purchasePackage: (pkg: unknown) => Promise<unknown>;
  };
};

let Purchases: OptionalPurchasesModule | null = null;

try {
  Purchases = require('react-native-purchases');
} catch {
  // react-native-purchases not available in this build
}

const REVENUECAT_API_KEY_IOS     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export async function initRevenueCat(userId?: string): Promise<void> {
  if (!Purchases) return;

  const { Platform } = require('react-native');
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey) return;

  await Purchases.default.configure({ apiKey });
  if (userId) {
    await Purchases.default.logIn(userId);
  }
}

export type Entitlements = {
  hasAnalysisCredits: boolean;
  isPro:              boolean;
};

export async function checkEntitlements(): Promise<Entitlements> {
  if (!Purchases) return { hasAnalysisCredits: false, isPro: false };

  try {
    const info = await Purchases.default.getCustomerInfo();
    return {
      hasAnalysisCredits: 'analysis_credits' in info.entitlements.active,
      isPro:              'pro' in info.entitlements.active,
    };
  } catch {
    return { hasAnalysisCredits: false, isPro: false };
  }
}

export async function purchaseAnalysisCredit(): Promise<boolean> {
  if (!Purchases) return false;

  try {
    const offerings = await Purchases.default.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    if (!pkg) return false;

    await Purchases.default.purchasePackage(pkg);
    return true;
  } catch {
    return false;
  }
}
