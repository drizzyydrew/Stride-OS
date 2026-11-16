# StrideOS launch and revenue plan

Owner direction, 2026-11-16: pursue **$10,000 gross monthly recurring revenue within 7–14 days**. This is a stretch target, not a forecast or guarantee. No audience size or promotion budget has been supplied. Do not buy ads, send outreach, make purchases, or claim the app is publicly available on the basis of this document.

## One offer

One Pro entitlement, monthly or annual billing, current US prices $9.99/month and $79.99/year. A 14-day Apple introductory free trial for eligible subscribers; no device-clock trial, second trial entitlement, or hidden unlimited promise. Include only accepted capabilities: new personalized running/hybrid goal plans, deliberate automatic week rebuilding with review/confirmation, and AI Coach with the existing 20 requests per UTC day subject to availability. Tracking, calendar, saved plans/history, manual changes, recovery actions and existing on-device Insights stay usable after expiry. Reports, fueling, Movement Lab and human coaching are not new paid claims in this release.

A 14-day trial is a real evaluation window. A person who starts on launch day cannot become a paying subscriber until the trial ends. Later cohorts convert later. Count trials as pipeline, never as paid MRR. Apple approval and public release precede the public acquisition window; do not promise a launch date controlled by review.

## Subscriber arithmetic

- 1,002 active paid monthly subscribers: $10,009.98 gross MRR.
- 1,501 active paid annual subscribers: $10,005.42 gross MRR, annual payments divided by 12.
- 500 monthly and 752 annual: $10,007.71 gross MRR.
- 126 annual payments: $10,078.74 gross cash sales before fees, but only $839.90 MRR.
- At a hypothetical 5% offer-visitor-to-paid conversion, the monthly-only target needs 20,040 offer visitors. At 2%, it needs 50,100. These are scenarios, not conversion benchmarks or audience forecasts.

All figures exclude refunds, taxes, commissions, RevenueCat, infrastructure, AI costs, support, marketing and churn. Gross MRR is not profit or bank cash; Apple settles on its own schedule. TestFlight purchases produce no real revenue.

## Work order

1. Finish and accept membership gating, purchase/restore/expiry, signup/reviewer/deletion and Store metadata/screenshots on the exact candidate. Reconcile public client and server billing before accepting a paid public launch.
2. Record reachable, permission-based audience: email subscribers, existing clients, social reach, running clubs, gyms, coaches and relevant creators. Distinguish followers from people who visit the offer. Record any owner-approved promotion budget before spending.
3. Prepare a 30–45 second actual-app demonstration: choose a goal, show the personalized week, review a week adjustment, record a session and revisit its saved history. Use synthetic demo data explicitly labeled as demo; never expose an athlete's health data or fabricate testimonials/results.
4. Use the launch copy in COPY.md. The current beta web page invites questions by email; it does not enroll someone in a trial, promise an open beta, automatically add them to a mailing list, or charge them.
5. After approved public release, make the public download link active and begin owner-approved outreach to the warm audience and partners. Track each channel's visits, trial starts and eventual paid conversion. Do not publish or send outreach without explicit authorization.
6. Review after 48–72 hours: Does the first session make the plan's value clear? Where do people leave? Fix demonstrated friction before increasing spending. Review paid conversion when each cohort actually leaves its trial.
7. At day 7 and day 14, report accepted product status, offer visitors, active trials, real active paid subscriptions, cancellations and costs separately. Report the gap to $10,000 MRR candidly; never turn trials, annual cash collections, or download totals into paid MRR.

## Measurement

RevenueCat production subscription reporting and Apple's production sales/financial reports are the purchase source of truth. Use production, not Sandbox. Optional PostHog membership-screen events measure aggregate UI activity only; a membership check or restored entitlement is not a new paid conversion. Consent is off by default, session identifiers rotate and non-consenting people are absent, so these events cannot establish a complete user-level conversion rate. Use exact comparable denominators and cohort windows.

Use scripts/launch-revenue-plan.cjs for explicit aggregate scenarios and verified paid-subscription counts. Empty or missing actuals must remain unknown, not zero. No new ad SDK, fingerprinting, contact upload, session replay or health-data marketing pipeline is included.

## Cost/capacity acceptance

AI default is Haiku 4.5, but a server model override is possible. Source currently limits each account to 20 requests/day and the service to 500/day. That shared limit and the previously observed organization spending cap do not establish capacity for 1,000+ paying customers. Before public growth, verify the actual provider organization, usage cost, spending controls, server entitlement enforcement and a deliberately approved capacity budget. No spending-cap increase is authorized by this plan.

## Primary references

- Apple trial configuration and eligibility: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/
- Apple payment timing: https://developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments/
- RevenueCat MRR definition: https://www.revenuecat.com/docs/dashboard-and-metrics/charts/monthly-recurring-revenue-mrr-chart
