# Build 118 — internal TestFlight delivery

Version **1.0.0 (118)** is **VALID / IN_BETA_TESTING** in the existing Team (Expo) group. Build source `bd33864ef75c68cd2981b5aa057ee91a74ef4091`; EAS build `e5a06e42-613e-47d2-b9b8-31e566b6df8c`; exact submission `35337421-3e1a-47c4-98fe-cf21dd0dea90`; Apple build `58b7cebd-74c6-4941-a0a4-7001f9458a6c`. No tester expansion or public review/release.

## What changed

One Pro membership now gates explicit new personalized running/hybrid goals and automatic week rebuilding. Existing plans, calendar/history, recording/completion, rest/reduction, manual moves and repeating an existing beginner week remain available. Expiry never deletes history. New onboarding saves open training durably, retains setup choices and carries them through membership into the goal form without automatically replacing a plan.

Membership loads plans/checks Pro on focus and foreground without automatic Restore. It displays persistent verified status, localized recurring prices, numeric same-currency annual savings, and only store-supplied zero-price trial terms for explicitly eligible people. Apple now has 14-day introductory offers for both existing products in the five existing markets; prices and availability were not expanded.

Optional membership events keep the existing analytics consent and exclude identity, health data, receipts and prices. The website membership preview/contact CTA, terms and privacy are live and byte-verified on GitHub Pages and strideosfitness.com. It remains a private-beta preview without checkout or open signup. Growth/revenue planning and draft store copy are in launch118/. No outreach or advertising purchase occurred.

## Verification

The 1,963-case full suite initially passed 1,960 cases with three Swift compiler timeouts under parallel load. All three failed files were rerun in isolation: 9/9 passed, zero skips. The final affected membership/access subset passed 55/55; the core independently passed 59 scoped cases. Canonical typecheck, Expo dependency check, native version/live-activity checks (29/29), and diff checks passed. Eighteen synthetic membership layout cases and nine website layout cases passed without horizontal overflow. Native physical UI acceptance remains pending.

Cloud Doctor passed21/21; archive succeeded with0 errors/33 existing warnings. The signed phone, Watch and Live Activity targets are all118, with strict signatures, valid store profiles, expected entitlements,21 privacy manifests, Hermes bytecode and embedded new membership/access strings verified. No auth, native Watch/GPS/Health, dependency, or SDK purchase-queue rewrite. Beta notes were saved/read back exactly using Apple's whatsNew field.

## Remaining public launch gates

Public server billing remains off until authenticated RevenueCat/server guard acceptance; credential-name presence and matching deployed source are insufficient. Verify actual AI model, costs and capacity before expanding paid use. Current source still has a500/day shared service limit and20 requests/account/day; no budget increase was made. Production signup/reviewer/deletion acceptance, paid lifecycle, genuine current Store screenshot/product-review materials and final public binary reconciliation remain separate gates. Public1.0 draft still selects109 in PREPARE_FOR_SUBMISSION/MANUAL.

The $10,000 gross MRR objective is a stretch target, not earned revenue or a forecast. Trial starts and TestFlight purchases are not paid MRR. Audience size and promotion budget remain unknown.

Next: follow BUILD118_OWNER_TEST_GUIDE.md without uninstalling or resubscribing if Pro is active.
