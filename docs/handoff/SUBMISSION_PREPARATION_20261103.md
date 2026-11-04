# What can finish before device acceptance

November 3, 2026. This prepares submission material and operating checks while
device use is deferred. A final accepted public binary has not been selected.

The copy-ready local draft files and field validation are now assembled in
`store-package-20261103/`. `DESKTOP_COMPLETION_20261103.md` records the Gmail
queue setup, name screen and private AI verification helper. These additions
do not close the remaining native or owner-decision gates.

## Division of work

| Work | Preparation that can happen now | Evidence still needing app use |
| --- | --- | --- |
| Signup confirmation | Settings, redirects, templates, callback/source tests and exact test steps | Inbox-to-native return, correct account, expired/reused links and restart |
| iPhone and Watch | Code review, synthetic tests, permission configuration, failure recovery and evidence collection plan | Recording under lock/interruption/offline, exactly-one save, restart, Health and Watch behavior |
| Deletion | Provider/server configuration, worker and receipt checks, exact disposable-account scope | Actual native credentials/prompts, provider revocation, device cleanup and restart; specific deletion approval also required |
| Subscriptions | Products/offering/credentials, QA112 archive, private delivery preparation, notification investigation and lifecycle result sheet | Apple purchase/restore/cancel prompts and real client/server access outcomes, plus elapsed renewal/expiration tests |
| Store package | Draft description, privacy variants, reviewer text, asset inventory and candidate-selection checklist | Genuine missing captures, accepted deletion/payment outcomes and final binary selection |
| Operations and naming | Service checks, proposed support handling and name-review evidence | Owner decisions/professional review as appropriate; these do not depend on recording a workout |

These are guided acceptance cases with expected outcomes. General feedback from
ordinary use is welcome, but it does not replace checking the specific cases.

## Current operations readback

`OPERATIONS_READBACK_20261103.json` records fresh read-only checks:

- AI Coach v14 is ACTIVE with gateway JWT verification. All three deployed
  source files match the current local versions byte for byte. The deployed
  handler obtains the Anthropic key from a server environment variable, verifies
  ownership/consent and applies its usage allowance before a model request.
- Claude Console still shows the owner-approved $20 monthly organization limit,
  $0 current-month spending and a December 1 UTC reset. The actual deployed key
  has not been independently matched to that organization, and no over-limit
  model request was executed. These remain distinct from the saved limit.
- RevenueCat's intended App Store connection shows valid purchase credentials.
  Its last notification received is October 31 at 21:23 UTC, matching the earlier
  sandbox TEST. The notification endpoint is present and masked. New-purchase
  ingestion from server notifications remains off. No credentials were revealed
  and no settings or purchase records were changed.

### Production notification 401

The historical request returned 401 from Apple's production API. That differs
from a notification being delivered to RevenueCat and rejected there. Current
RevenueCat credential validation and the prior successful sandbox delivery do
not prove production delivery.

Apple's [Commerce Engineer response](https://developer.apple.com/forums/thread/806452)
describes production API access being unavailable until a production release.
The example concerns transaction APIs, so it supports an eligibility explanation
without confirming the exact notification TEST cause. Keep this unresolved;
do not rotate a validated key or release an unaccepted app merely to test it.
When production access is eligible, capture the HTTP/error code, test reference
and Apple's delivery-status result without recording a JWT or key.

RevenueCat's [notification guidance](https://www.revenuecat.com/docs/platform-resources/server-notifications/apple-server-notifications)
explains its update behavior and optional new-purchase ingestion. Keep the
existing account-identity policy during controlled tests; an automatically
created anonymous subscriber is not proof of the intended signed-in owner.

### AI organization matching

The [provider's organization endpoint](https://platform.claude.com/docs/en/api/http/beta/organization/retrieve)
can return the organization associated with an authenticated API key. A later
scoped check must use the exact deployed key in a protected server/owner context,
with no chat/repository key disclosure. Creating another key does not match the
one currently deployed. No diagnostic endpoint, new admin credential, model
request or access expansion is created by this preparation.

## Paid-release privacy label overlay — prepared, not published

The currently published label was reconciled for billing-off operation. Before
distributing the paid candidate or starting QA entitlement processing, reconcile
the purchase-enabled scope against the exact binary and configured integrations.

| Data | Prepared treatment | Source evidence |
| --- | --- | --- |
| Purchase History | Collected, linked to the user, App Functionality and Analytics; no advertising tracking in the reviewed implementation | RevenueCat receipt/entitlement handling and dashboard use; see vendor guidance below |
| User ID | Collected and linked; review App Functionality and Analytics purposes for the RevenueCat path | `src/lib/revenueCat.ts` configures RevenueCat with the authenticated Supabase owner UUID |
| Payment-card details | Do not add collection solely for Apple-processed payment | The app's purchase API does not receive full card details |
| Advertising Device ID | No new declaration solely from adding this purchase path; reassess if integrations change | Automatic device-identifier collection is disabled and no advertising integration is enabled by the reviewed source |

[RevenueCat's privacy instructions](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
call for both functionality and analytics purposes for purchase history, and
linkage when the app's user ID identifies a person. Apply the full
[Apple privacy definitions](https://developer.apple.com/app-store/app-privacy-details/)
to the final app and third-party use. Existing Health/Fitness and other
disclosures remain governed by `PRIVACY_LABEL_RECONCILIATION.md`.

The public policy already describes RevenueCat, purchase records, account
identifiers and the fact that account deletion does not cancel an Apple
subscription or erase provider purchase records. Retention periods, support
custody and operational backup handling remain decisions; no invented deadline
or immediate-erasure promise is added. No public policy or Apple label changed
in this pass.

## Reviewer purchase paragraph — draft insertion only

Use the seven source-mapped journeys in `APP_REVIEW_NOTES_111_DRAFT.md` as the
baseline. After actual acceptance on the public candidate, replace its
billing-off paragraph with the following candidate-matched insertion. This text
is not ready to paste into Apple before those outcomes are verified:

> Core recording, calendar, saved history and on-device Insights remain
> available without Pro. To view subscriptions, open More → Settings → Account
> & Legal → StrideOS Pro membership, then View plans with RevenueCat. Choose
> Monthly membership or Annual membership and follow Apple's confirmation
> dialog. Prices, currency and any introductory eligibility are supplied by the
> store. Restore purchases and Retry membership check are available on this
> screen. Manage renewal through Manage Apple subscriptions in Account & Legal.
> AI Coach chat requires separate Anthropic-sharing consent and has usage limits.

Source mapping: `src/components/settings/AccountPrivacy.tsx`,
`app/(tabs)/settings/membership.tsx`, and `src/lib/revenueCat.ts`. This is source
evidence; native labels, successful purchase/restore, access and cancellation
still need acceptance. Add the accepted deletion steps and observed outcome
before submission. Do not paste private credentials in the notes body.

The private QA 429 is an intentional no-quota stop. It must not be described as
the normal paid app's successful AI response or used as the final public-review
experience. A paid public variant requires accepted normal client/server
alignment and its own exact archive/delivery record after lifecycle testing.

## Final package assembly

Prepare now: source-backed copy, privacy variants, reviewer navigation, capture
shot list, product review checklist and links to exact build receipts. The
annual subscription review screenshot was empty at the latest recorded Apple
check; obtain a genuine accepted paywall capture and review both products.
Three existing phone captures have build-107 provenance. Preserve those
originals and assess final-candidate fidelity instead of relabeling their build.

Finalize after results: exact normal public candidate, genuine required captures,
accepted deletion/purchase instructions, correct privacy answers and release
settings. Saved public draft 109 lacks the build-111 reset correction. Private
QA112 is never the ordinary release candidate. Submission and manual release
remain separate owner decisions.

The owner confirmed initial support handling by Drew Moore with daily checks of
the existing Gmail inbox; see `SUPPORT_COVERAGE_CONFIRMATION_20261103.json`.
Retention and other custody decisions remain open. No support customer
data, mailbox exports, access grants, response-time promise, external reviewer
engagement or paid naming search was created here. Keep StrideOS as the working
name under the owner's recorded direction; the fallback and clearance work is
in `NAMING_DIRECTION_20261103.md`.
