# Home launch session — estimates and division of work

Password-reset incident update: the first reset reportedly worked, but repeating
it after closing StrideOS left build 109 on **Finishing sign in…**. Email delivery
is accepted; native recovery is not. A scoped source fix and regression coverage
are prepared for **build 111**; see `AUTH_RESET_COLD_START_20261102.md`. Do not
claim the installed build or public draft contains this fix before replacement
artifact/upload/device acceptance is verified. No data deletion or public release.

Prepared November 2, 2026. Canonical production candidate is **109**, billing off.
The App Store draft selects 109 with manual release. Private purchase-test
candidate **110** is isolated in `/tmp/strideos-billing-qa110-20261102`; never
replace the public draft with that QA binary. Availability is recorded separately.

Private 110 is now signed-archive verified and **VALID / IN_BETA_TESTING
internally** in the existing owner-only group. The saved public draft was freshly
verified as **109 / manual release / Prepare for Submission**. See
`BILLING_QA110_RELEASE.md`. Following renewed owner sign-in, 110's private-QA
test note is saved and verified after reload. No new tester invitation was sent.

Owner-access follow-up: Apple and Claude were signed in. The Claude organization's
**$20/month** limit is saved/read back; no credits or automatic reload purchased.
That organization-wide limit does not independently prove which organization
owns the deployed API key. See `AI_VENDOR_SPENDING_20261102.json`.

The owner completed **strideosfitness.com** registration at Vercel for one year.
The completed order lists $12.03; final charged tax/total was not inspected.
Expiration is November 2, 2027. Auto-renew is **off**, verified through a separate
connector readback after the official CLI changed it. The approved cap was $15
including tax/fees. No hosting upgrade/add-on or second domain was purchased.

**auth.strideosfitness.com is Verified in Resend and ready to send.** The exact
provider DKIM TXT and Forge CNAME records are live in authoritative and public
DNS; existing domain records and free website URLs are preserved. Resend stays
on Free. No receiving mailbox or tracking subdomain is configured.

The owner completed private key/SMTP entry. Custom SMTP is saved and enabled
after reload; the stored password remains hidden. Resend key metadata verifies
Sending access restricted to the auth domain. Branded confirmation/recovery
subjects and HTML are saved and match full-reload source readback exactly.
The Resend processor disclosure is published to the existing free privacy URL
and verified live at HTTP 200, matching the canonical file. No key was read or
entered by the agent, no test message sent, no public signup reopened.

The owner initiated a reset and supplied two iPhone Gmail screenshots confirming
actual inbox delivery, expected StrideOS subject/sender, TLS and readable branded
content. This accepts a single reset email, not the whole authentication flow.
Next owner email check: follow the reset link, privately save the password and
verify native return/new-password sign-in. Keep Apple's review credentials current if
that account's password changes. Signup remains off and Confirm email is also
off; confirmation policy/flow must be enabled and accepted before reopening
signup. See `email-templates/RESEND_SMTP_ACCEPTANCE_20261102.json`.
Earlier card/cart/Brevo/unsaved-SMTP checkpoints are historical, not blockers.

## Planning estimate

Allow **2–4 hours of owner hands-on time**, split into smaller sessions if useful.
Allow roughly **6–12 hours of remaining engineering/verification work**, much of
it preparation or backend checking. Some work overlaps; do not add every range
as a sequential deadline. A reasonable planning window is **2–5 working days
after required account access is available**, plus Apple review, if acceptance
does not find substantial defects. Provider approval, new test identities,
delivery problems, bugs, rebuilds or review feedback can extend it. This is an
estimate, not a promise to publish the evening the owner returns.

| Section | My remaining active work | Owner active time | Owner-only part | What I can prepare without the owner |
| --- | --- | --- | --- | --- |
| Email confirmation/recovery | 45–90 min | 10–25 min | Existing sender access or account/terms setup, private SMTP credential entry, inbox/link confirmation and disposable password entry | Templates, callback/config audit, provider options, bounded configuration changes and acceptance steps |
| AI spending controls | 15–30 min | 5–10 min | Existing API-console sign-in and approval of the dollar cap | Existing app-limit verification, exact vendor-limit checklist; no invented cap or credit purchase |
| iPhone/Watch QA | 1–3 hours, excluding substantial fixes | 45–75 min | Device installation, permissions, physical recording, lock/background, Watch actions and observed outcomes | Candidate/archive/backend checks, exact test order, safe result collection |
| Real account deletion | 1–3 hours | 20–40 min | Consenting disposable Apple/Google identities, provider prompts and explicit test deletion confirmation | Server/key checks, private owner-scoped test plan, completion/cleanup readback and rollback scope |
| Subscription lifecycle | 1–3 active hours plus provider waits | 20–40 min | QA identity, sandbox-account controls, purchase/cancel/restore dialogs | Private QA artifact, inert server pathway, expected client/server states and read-only checks |
| Genuine screenshots/assets | 45–90 min | 10–20 min | Native navigation/captures if remote native control remains unavailable; final visual choices | Shot list, candidate/provenance requirements, filenames and draft placements |
| Final package/submission decision | 30–60 min | 10–15 min | Final approval of accepted content and submission/release decision | Metadata, free URLs, privacy/build/reviewer checks and final evidence packet |

Build 109 already exists, so its build time is not new owner work. New purchase
QA compilation/upload/Apple processing is background time. Standard TestFlight
subscriptions renew every 24 hours, so renewal acceptance can require overnight
elapsed time even when the owner's button presses are finished. A separately
configured Sandbox Apple Account can provide additional controls; do not assume
those settings already exist. [Apple testing guidance](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/).

Apple currently reports 50% of submissions reviewed within 24 hours and 90%
within 48 hours. Incomplete submissions and review issues can take longer;
review is not approval or release. [Apple review timing](https://developer.apple.com/distribute/app-review/).

## First 15–35 minutes at home: private account steps

1. Confirm the existing email-sending service, or say none. Reuse approved access
   when possible. If a new service is needed, the owner completes its terms and
   private credentials; no domain or paid plan is purchased without approval.
2. Sign in to the existing Anthropic **API console** funding AI Coach, not just
   the ordinary Claude chat app. Verify the correct organization/workspace and
   enforcement/reset scope before approving a spending limit. Do not buy credits.
3. Confirm dedicated fictional test identities. Do not use the retained-history
   account for deletion. If no disposable Apple identity exists, account setup
   and verification can add time; do not turn a real athlete account into a fixture.

Main then completes configuration/readback while the owner prepares devices.
Neither a saved sender nor an API response proves inbox delivery or recovery.

## Core device block: use production 109

Update rather than erase the owner's retained-history installation. Record
build, device/OS, date and pass/fail only; keep passwords, tokens, precise routes,
personal health values and private screenshots out of public/repository receipts.

1. Confirm sign-in, normal navigation and retained history. Check the dedicated
   review account's onboarding/navigation separately using fictional information.
2. Record a short supported outdoor session; lock/background, reopen,
   pause/resume/end, and reopen its saved detail. Confirm durable, nonduplicate
   completion and a plausible route/distance without manufacturing missing data.
3. Exercise Health permissions/recovery and the intended saved-workout behavior.
   Denied permissions must have a truthful fallback and preserve existing records.
4. Exercise the supported Watch start/end/sync and disconnection path. Confirm
   exactly one completed session, then verify offline/reopen/account-switch
   behavior using the agreed test scope. Never wipe history to make a case pass.
5. Confirm goal/archive/open-training navigation and the freedom to skip a plan.
   Do not change the device clock or fabricate historical results for screenshots.

## Deletion block: dedicated disposable identities only

Main verifies and records the exact owner scope before any controlled activation.
Owner confirms each disposable identity and approves its deletion/provider prompt.
Main checks real Apple exchange/custody and per-token revocation, Google handling,
pending/interrupted recovery, server removal and local cleanup/restart. A pending
or manual outcome is not a completed provider revocation. Restore the agreed
control state after the scoped test. General deletion is still off until accepted.

## Purchase block: private 110, only after server binding is confirmed

Do not start purchases just because 110 becomes installable. Main first confirms
the dedicated authenticated owner's UUID, server QA binding, SDK registration
and correct RevenueCat customer. The user enters sandbox credentials privately.

Accept both approved products, canceled purchase, purchase/restore/relaunch,
renewal, expiry, grace/retry, refund/revocation where supported and owner switching.
Main correlates actual client/server/vendor outcomes and receipt times. The QA
path's deliberate 429 means verified access with no AI/quota use; it is not normal
AI success. Remove/verify the QA binding after testing. Keep global billing off
until the intended production variant and remaining paid-launch gates pass.

For a paid launch, 109 remains the billing-off baseline and 110 remains QA only.
After lifecycle acceptance, prepare/verify the intended paid production variant,
align its client/server settings, and review paid-scope privacy labels including
purchase history before promotion. Budget another cloud-build/Apple-processing
wait if a new production binary is required; this is not owner hands-on time.
Do not silently enable payments or select the QA artifact as a shortcut.

## Screenshot block: accepted native UI, fictional account

Prioritize Today with the correct profile name, Calendar, saved History/activity
detail with correct manual labels, and Strength. Add current Watch shots only
from a real accepted Watch session. iPad support is not added to fill old slots.
Record build/device/date and preserve unedited originals. No reconstructed UI,
edited metric values or email-template previews presented as app screenshots.
Replace placements only after review; preserve historical Asset Library originals.

The annual subscription's Apple review screenshot field is currently empty.
During the accepted purchase session, capture the actual Membership/paywall
with store-provided prices, eligibility/renewal text and Restore. Review both
products' screenshot fields before the final paid submission. An image alone
does not accept purchases, and the QA binary is never a public release candidate.

RevenueCat's default monthly/annual package mappings and two-product Pro
entitlement were freshly checked. The existing EAS public iOS SDK key matches
the StrideOS App Store app; no key value was printed. Five-market availability
was preserved, not expanded. See `HOME_SUBSCRIPTION_PREPARATION_20261102.json`.
The historical production notification TEST 401 remains unresolved; do not
release prematurely to clear it or count sandbox delivery as production proof.

## One repeatable read-only check

```sh
./node_modules/.bin/tsx scripts/prepare-launch-session.ts
./node_modules/.bin/tsx scripts/prepare-launch-session.ts --live
```

Default reads only named local candidate/config receipts. `--live` adds exactly
six fixed-host, credential-free GET/OPTIONS checks: Coach public auth/CORS and
four free public pages. No emails, AI, quota changes, purchases, account deletion
or settings writes. Successful preparation never accepts human/device/provider
gates or declares the app ready for public release. Apple availability still
requires its separate official status readback; local receipts are historical.

## Scope review

This was a single-assistant review using product, platform and contrarian lenses,
not independent council consensus. Preparing a separate QA artifact saves owner
waiting; mistaken public promotion is the strongest countercase. Isolating 110,
preserving the saved 109 draft and leaving test-owner/global flags unset resolves
that preparation risk. Unverified purchase, provider and device outcomes remain
launch blockers rather than being treated as setup successes.
