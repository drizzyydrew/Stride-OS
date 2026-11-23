# Build 126 release record

The owner authorized Build 126 after implementation and verification, followed by reconsidering the pending Apple submission. Public release is not authorized. Build 125 remains the submitted candidate until a separate verified replacement. No exercise images or screenshots were changed.

## Product changes

Membership now compares Free and Pro, simplifies active-subscription status, and explains adapting a plan when life changes. Free recording, GPS, ad hoc logging, workout history, sharing, standard instructions and calculators remain available. Custom routes, reusable structured workouts, schedule changes, personalized plans, forecasts and all Movement Lab playback/results require active Pro; export/deletion remain free. Expiry locks features without deleting saved records.

Strength guidance is collapsed into independent sections, the warm-up explanatory footer is removed, Strength links directly to calculators, and calculator wording/results/table are simplified. Programming distinguishes beginner practice, main strength/power work, hypertrophy and endurance, preserves active/completed prescriptions, and earns additional volume from actual performance rather than attendance.

Coach now displays messages rather than requests; Pro includes up to 20 daily messages. The versioned backend supports guarded local-midnight periods, owner-bound 24-hour per-message history, stable request IDs, interrupted-reply recovery and included-before-purchased consumption. Profile/training context stays separate; conversations do not create permanent profile memories. The updated consent disclosure requires renewed permission.

The requested standalone 30-message / US$4.99 / 12-month pack is implemented behind closed sale/Apple-approval flags. It is NOT available for purchase. Apple entitlement, App Store availability, new product approval, native purchase/refund/recovery and reminder-delivery acceptance remain mandatory before activation.

## Verification

- Aggregate app run: 2,312 tests, 2,309 passed, zero skipped; three resource/deadline failures during heavy host load.
- All three failures passed unchanged in the isolated 75/75 follow-up (dependency decoder, real owner-policy SQL and compiled Watch transport/order tests). The follow-up also covers renewed AI consent, history, client concurrency and usage parsing.
- Latest backend behavior: 29/29; PostgreSQL wallet scenarios: 21/21; all three new Deno entrypoints checked.
- Project TypeScript check and clean iOS prebuild passed. Final delivery receipts are recorded below when complete. No physical-device purchase or visual acceptance is inferred from source tests.

## Service deployment and limits

The new wallet migration and independent minute-by-minute retention cron are applied. All seven new tables have RLS; anon/authenticated users cannot read them or execute the service RPCs. The retention job has successful hosted runs, independent of sales/generation switches. New versioned endpoints are deployed; the existing v1 endpoint keeps its JWT gate and now supplies an explicit update response for migrated owners.

V2 is allocated a $1 monthly hard reservation envelope within the existing approved operating budget, at $0.02 reserved per provider attempt (at most 50 shared attempts/month, including failures/ambiguous outcomes). This is bounded testing capacity, NOT public-launch capacity or an additional budget increase. V1 retains its shared 500/day service limit. The provider organization’s previously matched $20 cap was not freshly read because browser controls were unavailable; combined v1/v2 operating capacity remains a public-release gate.

Hosted Postgres has outdated timezone data. Known affected regions/aliases temporarily use an explicitly disclosed UTC reset; transitions retain used allowance and purchased expiry is unchanged. This avoids a database upgrade/downtime during the pending review. A later verified timezone-data upgrade can remove the exception.

The first hosted usage read uncovered an Auth-table privilege mismatch. The additive repair is applied: a private service-only boolean helper reads existence, all ledger functions remain invoker, direct Auth-table SELECT remains denied, and the private schema is rejected by the Data API. Hosted authenticated v1/v2 usage and RevenueCat Pro reads passed; a rolled-back legacy quota reservation also succeeded. No broad Auth-table grant was added. Reviewer enrollment remains false, test timezone state was restored, and no provider generation/purchase occurred.

Versioned beta policy pages (privacy-126.html, terms-126.html, support-126.html) are published separately, and Build 126 links to them. The existing standard 125 pages stay unchanged. When selecting 126 for review, reconcile the standard policy pages and Apple description/reviewer notes, preserving manual release and the two submitted subscriptions. Historical 125 receipts remain unchanged.
