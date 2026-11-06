# Current StrideOS launch status

## Latest verified delivery — build 114, November 5

The owner explicitly requested updating the build with all prepared work,
submitting it to TestFlight and giving detailed ordered next steps. They also
requested complete App Store launch preparation. This lifts the earlier
TestFlight hold for the new normal candidate; it does not approve public App
Review submission or manual public release. Normal **1.0.0 (114)** is now
**VALID / IN_BETA_TESTING**, with purchases disabled, in the existing Team
(Expo) internal group with one tester. Exact EAS build
`184207fd-0412-4788-8790-806c723579f5` and submission
`aad9c5ce-e380-4f47-8aca-54b0825bdaf2` are FINISHED. Signed archive inspection,
group assignment and saved TestFlight testing instructions are verified in
`BUILD114_RELEASE.md` and `BUILD114_APPLE_ACCEPTANCE.json`. No physical-device
acceptance of 114 is inferred. Historical QA112 remains separate.

The ordered owner instructions are `BUILD114_OWNER_TEST_GUIDE.md`. Updated store
drafts are in `store-package-20261105/`; a fresh supported Apple metadata pull
confirms the saved title/subtitle, description, categories, reviewer fields and
manual release (`APP_STORE_READBACK_20261105.json`). Private credentials and raw
pulled assets are outside the repository. Final screenshots, exact public binary,
signup/reviewer/deletion outcomes, paid lifecycle if included, operations and the
final owner release decisions still govern full launch readiness.

Fresh official Apple readback confirms public version 1.0 still selects **109**,
**PREPARE_FOR_SUBMISSION / MANUAL**. No public review or release occurred.
The local description draft now adds source-mapped Watch and race-PR paragraphs;
Apple's saved description is preserved separately. Four public policy/marketing
pages and both origin/Apple-CDN password association endpoints were read back.

Build 113 failed on the older provisioning profile and was not submitted.
`BUILD113_FAILURE.json` and `BUILD114_SIGNING_REPAIR.json` record the failure
and verified Associated Domains/profile repair. No app feature was removed.

The dated paragraphs below retain their historical scopes. Earlier “TestFlight
hold” and “no new build” statements describe those earlier checkpoints, not the
owner's new authorization.

## Earlier device and preparation checkpoints

Latest November 5 device report: the owner says all remaining listed build-111
checks looked good: plausible GPS map/distance/pace, live Watch measurements,
Watch disconnect/reconnect during recording, and denied/re-enabled Apple Health
permission recovery. Those scoped checks are owner-reported passed; do not
repeat them on 111 simply to fill prior blanks. Exact metric/sensor coverage,
independent logs and the pending corrected candidate are not established.
See `BUILD111_REMAINING_DEVICE_READBACK_20261105.json` and `PHONE_QA_20261104.md`.
This does not accept account, deletion, purchase or public-release gates.
TestFlight submission/delivery remains explicitly on hold.

Latest November 5 owner revision: Half Marathon/Marathon PR badge faces use
13.1/26.2 miles in place of HM/MAR, retaining the full race names. Other designs
are accepted. The owner explicitly does not want TestFlight submission yet;
prepare locally for the next app-test round without submitting or delivering.
The mileage revision passes canonical artwork validation, five integration tests
and focused design-council review. See `RACE_PR_MILEAGE_REVISION_20261105.json`.

Latest November 5 PR-badge update: the owner requested six race PR badges.
800m, 1 mile, 5K, 10K, half marathon and marathon are implemented as a new
canonical stopwatch family, with design-council PASS and source integration for
first-result and repeat-improvement celebrations. Existing history unlocks quietly;
ties, corrections and repeated imports do not replay popups. See
`RACE_PR_BADGES_20261105.md` and its validation receipt. This closes the generic
race-PR celebration/artwork gap in source, not on installed build 111.
Integrated verification: 1,796/1,796 tests, TypeScript 5.9.3 and the canonical
artwork validator pass. No native build/delivery was performed for this addition.

November 5 source corrections: archive ID transport, tour yellow outlines and
scroll/reveal/guided taps, full-width PR date entry, explicit Activity race/time-
trial results with automatic PR/calibration refresh, Health-setup-driven optional
Watch permissions and release-hidden sync diagnostics are prepared locally.
See `PHONE_FEEDBACK_CHANGES_20261105.md` and its validation receipt. These are
not installed in build 111. Historical live Race-mode notes are not automatically
promoted to official results; use explicit result confirmation. A generic new-
race-PR celebration was absent at that checkpoint; the requested follow-up is
subsequently implemented in the PR-badge update above.
Validation: 1,766/1,766 tests and semantic TypeScript pass; unsigned Release
arm64_32 Watch compilation and local phone-width UI previews pass. The online
Expo check recommends newer SDK-57 patch versions and remains open for next-
candidate preparation; dependencies/build numbers are unchanged.

Latest November 5 update: the owner reports the entire phone-started Watch block
worked, including Watch Pause/Resume controlling the phone, locked-phone
continuation, Watch End and exactly one saved session. Basic Watch control/save
flow is now owner-reported passed. Optional live metric values, disconnect/
reconnect, denied-permission recovery and the pending corrected build are not
accepted by that statement. See `WATCH_DEVICE_READBACK_20261105.json`.

November 5 phone update: the owner confirms Connected and the completed test
workout appears in Apple Health. A shared Health Highlights screenshot shows
one Running entry with the StrideOS source icon, supporting basic workout-write
presence. No exhaustive duplicate audit, denied-permission recovery or Watch
acceptance is inferred. See `PHONE_QA_20261104.md` and
`HEALTH_DEVICE_READBACK_20261105.json`. Watch was subsequently reported passed
within the scope above.

Latest phone update: the owner confirms the full eight-minute offline-save block
worked, including Run saved, the completed activity surviving a full offline
close/reopen, and exactly one activity after reconnecting. These are reported
device/UI passes; route plausibility and Watch remain open. Basic Health writing
is subsequently reported passed above. The separate
Running auto-pause Off/announcement/persistence defect is reproduced in source
and its correction is prepared for a future build. The corrected source passes
1,718 tests, TypeScript and Expo compatibility; it is not installed in 111.
See `PHONE_QA_20261104.md` and `AUTO_PAUSE_FIX_20261104.md`.

Latest November 4 owner report confirms build 111 / iPhone 13 Pro history intact,
screen-lock recording, pause/resume and in-progress recording retained after
closing/reopening. The owner clarified the activity had not been stopped/saved;
completed-save durability was untested at that checkpoint and is subsequently
reported passed above. Other blank phone/Health/Watch checks remain open.
`PHONE_QA_20261104.md` contains the scoped report and requested corrections.
Resume/Stop recovery, profile name/username visibility and credential-form
improvements are prepared in source for a future native build. The Apple
association file is live at the owned domain and mirrored by Apple's CDN;
matching native entitlement configuration is staged. These changes are not in
installed build 111. See `IOS_PASSWORD_AUTOFILL_ASSOCIATION_20261104.md`.

November 4 phone observation: the owner attempted the App Review login on the
iPhone holding their usual account's local data. The app displayed the exact
`owner-conflict` guard message and blocked access. The subsequent owner report
identifies build 111 and confirms their original history is intact. See
`PHONE_QA_20261104.md`.
Do not treat this as a password failure, successful account switching or proof
of a completed isolation/recovery test; do not uninstall/reset to bypass it.

`PHONE_FEEDBACK_CHANGES_20261104.md` and its validation receipt record the
implemented corrections: 1,673 passing full-suite tests, TypeScript/Expo checks,
source-only recovery review and public association readback. No new native
build/TestFlight delivery was performed; allocate a new build number and verify
signed entitlements before device acceptance of these changes.

Owner support decision, November 3: Drew Moore will handle initial support and
check the existing Gmail inbox daily. Coverage choice is closed. Subsequent
delegated preparation adopted Gmail-only routine custody and a 90-day resolved
case review rule; see `SUPPORT_CUSTODY_RETENTION_20261103.md`. Actual mailbox
controls, manual identity checks, backend-record duration and backups retain
separate acceptance gaps.

This is the current navigation page for launch preparation. Dated build receipts
retain their original scope. The latest internally available candidate is 111;
the last verified public draft still selects 109 with manual release. Neither
is a publicly released app. The final release candidate may change after testing.

Latest November 3 desk preparation: **Confirm email is now ON**, saved and
verified after reload; **public signup stays OFF**. The owner completed the
Apple Sandbox tester, and browser readback confirms one StrideOS QA account
for the United States. Do not repeat that setup. See
`SANDBOX_ACCOUNT_ACCEPTANCE_20261103.json`. The reset-fixed private QA112 build
is **compiled and signed-archive verified**, but not submitted to Apple or
available in TestFlight yet; see `BILLING_QA112_RELEASE.md`. This does not replace normal internal 111 or the
saved public draft 109. `DESK_PREPARATION_20261103.md` retains the other checks
and screenshot inventory.

Further desk preparation is in `SUBMISSION_PREPARATION_20261103.md`: fresh
RevenueCat package/Pro/credential readback, the saved $20 Claude organization
limit and exact deployed AI Coach v14 source match, a paid-privacy overlay and
reviewer purchase paragraph. No model/purchase request, service setting, public
label, submission or release changed in that pass. Actual deployed-key
organization matching and production notification diagnosis remain open.
Support defaults were subsequently completed, with control/identity/backup
acceptance kept separate below.

Desktop continuation: `DESKTOP_COMPLETION_20261103.md` records actual empty
Gmail support-queue setup, the assembled store packet in
`store-package-20261103/`, screened fallback-name results, and an owner-run
metadata-only AI key checker with six passing synthetic safety checks. All four
public pages returned HTTPS 200 and matched local source. The current Apple
field re-read was blocked by browser reconnection/control errors, so packet
copy is explicitly from the prior recorded readback. The live key audit remains
open; support defaults were subsequently completed as described above. No
additional app test was accepted and no store field was published.

Latest operations continuation: `AUTONOMOUS_OPERATIONS_20261103.json` records
live deployed-key digest and capped-organization ID readback, seven passing
synthetic checker tests, and Supabase physical-backup inventory. The references
are saved privately; the owner-run checker now needs only the original existing
API key through its hidden prompt. No original key was available in the tool
environment or canonical app dotenv files, and no live organization request was
made. The backup API listed no available physical backups and PITR off; this
does not prove absence or erasure of all provider copies.

Earlier November 3 continuation: fresh browser readback confirms the public draft is
still 109 / Prepare for Submission / manual release, and TestFlight lists 111
with Team (Expo). Expo shows build 111 Succeeded at source dc318bf. GitHub still
has documentation commit 2c89521, with its successful Pages workflow; Vercel
returns no deployment for that SHA and the separate native-branch preview is
READY. All four public-page hashes match the completed-patch receipt. See
`CONTINUATION_READBACK_20261103.json`. No service settings changed.

The owner chose to keep StrideOS as the working name and consider distinctive
fallbacks if needed. `NAMING_DIRECTION_20261103.md` explains why Run, Lift,
Recover differentiates the listing without establishing name clearance.

## Completed preparation

| Item | Latest evidence |
| --- | --- |
| Internal candidate 114 | Signed archive verified; fresh Apple VALID / IN_BETA_TESTING, exact existing group/one tester and saved testing instructions. `BUILD114_RELEASE.md` and `BUILD114_APPLE_ACCEPTANCE.json` |
| Source checks for 114 | 1,796 passing tests on identical app-feature source, final-114 TypeScript/Expo/native generation, badge validation and iOS bundle export; cloud Expo Doctor 21/21 and source-map upload verified. `BUILD114_PREFLIGHT.json` and `BUILD114_CLOUD_VERIFICATION.json` |
| Password reset | Resend delivery observed and owner-reported successful cold-start retest on 111. This accepts that reported flow only. |
| Sending service | auth.strideosfitness.com verified, custom SMTP saved, branded templates saved; Resend Free retained. `email-templates/RESEND_SMTP_ACCEPTANCE_20261102.json` |
| AI organization cap | Approved $20/month limit saved and read back. Actual deployed API-key organization and over-limit enforcement are not independently matched/tested. `AI_VENDOR_SPENDING_20261102.json` |
| Apple owner setup | Developer/Paid Apps agreements, bank and W-9 recorded Active; reviewer credentials previously authenticated against the separate backend. `APP_STORE_DRAFT_REVIEW.md` |
| Public website | Home, support, privacy and terms return HTTPS 200, match canonical source and have no missing relative file targets in `PUBLIC_SITE_AUDIT_LATEST.json`. Support FAQ and mobile fixes are published. |
| Support and review preparation | `LAUNCH_SUPPORT_PLAYBOOK.md` and `INDEPENDENT_REVIEW_BRIEF.md` are prepared; no reviewer hired. |
| Private purchase preparation | Owner-created Sandbox tester verified. Historical QA112 compiled/inspected but was not delivered; it predates the new source/profile. Prepare/revalidate the coordinated current private purchase candidate before use. `BILLING_QA112_RELEASE.md` and `BUILD114_RELEASE.md` |

## Open launch gates

| Gate | Remaining work | Owner dependency |
| --- | --- | --- |
| Account confirmation | Confirmation requirement is saved ON with signup OFF; actual signup email/native acceptance remains open | Dedicated test credentials and inbox/native return confirmation |
| Device reliability | Listed build-111 recording, GPS, Watch and Health checks are owner-reported passed. Known defects remain pending acceptance of the corrected candidate; account isolation remains separately scoped. | Scoped regression on the updated candidate and remaining account-isolation acceptance; no repeat of completed 111 checks solely to fill earlier blanks |
| Account deletion | Real provider exchange/revocation, device receipt/cleanup/restart and support handling; general automation remains off | Identified disposable identities, native prompts and explicit deletion approval |
| Paid subscriptions | Historical QA112 predates the current features and phone-profile repair. Prepare/revalidate the exact current private purchase candidate after normal 114 acceptance; bind only the intended authenticated owner/customer, then accept purchase, restore, renewal, expiry/refund/revocation. Do not blindly submit old QA112. | Device-side Sandbox dialogs and observed results; Sandbox account creation is complete; some checks need elapsed time |
| Store package | Final genuine screenshot coverage, final candidate attachment, privacy/reviewer reconciliation and submission decision | Capture assistance if needed and final owner decision |
| Naming review | Owner prefers keeping StrideOS, with fallback exploration if needed. Related public use remains unresolved; hold new public handles, promotional publication and additional brand spending pending clearance. See `NAMING_DIRECTION_20261103.md` | Further owner direction only if review requires a change or professional engagement; no unilateral rename |
| Operations evidence | Routine support custody/review defaults are adopted; actual mailbox controls, manual identity verification, backend deletion-record duration and recovery/backup handling remain unaccepted. Actual AI key-to-capped-org match remains open despite saved reference metadata | Protected credential/security steps and scoped ownership/deletion acceptance; policy documents cannot prove these controls |

The historical Apple production notification TEST 401 remains unresolved.
Sandbox TEST previously succeeded. Do not equate it with proven production
delivery or release an unaccepted app merely to obtain production API access.

Private billing QA build 110 predates the reset fix; do not make it the normal
public candidate. Payments, general deletion automation and public release stay
off. Signup is OFF and Confirm email is ON at the latest dashboard readback;
`AUTH_CONFIRMATION_PREPARATION_20261103.json` supersedes the earlier both-off state.

Independent engineering/device/legal reviews have not been commissioned.
Automated scoped reviews do not establish those professional review outcomes.

## Work that can continue without the owner

Website/link/copy auditing, metadata reconciliation, actual-asset inventories,
reviewer instructions, draft launch copy, support procedures and evidence
organization can proceed without phone access. Existing accounts, keys, services
and financial setup do not need to be recreated just because an old checklist
asks for them. Owner prompts and actual device outcomes cannot be replaced by
these preparation tasks.

Prepared copy: `APP_REVIEW_NOTES_111_DRAFT.md` and `LAUNCH_COPY_DRAFT.md`.
Neither draft has been sent, posted or saved into Apple's review fields.

The read-only `scripts/prepare-launch-session.ts` now checks internal candidate
111 and its actual receipt schema. Its `--live` mode still makes only six fixed
credential-free public GET/OPTIONS requests; a pass cannot accept native,
signup, spending enforcement, deletion, purchase, naming or submission gates.
The owner session no longer directs purchases to outdated QA110. These local
preparation changes do not change the embedded build-111 app or the live draft.

November 3 council continuation corrected unsupported professional-analysis
wording and the support-correspondence disclosure, mapped reviewer navigation,
clarified historical checkpoints and strengthened proposed support/reviewer
custody. The factual privacy corrections are published and byte-verified at the
existing free URL; no launch promotion was posted. Private financial source
documents and a service-cost register are organized outside both app
checkouts; no invoice, private manifest or source email is stored here. The
supplemental mailbox sweep was rate-limited, and Apple's original invoice remains
uncollected despite captured order/enrollment evidence. See
`COUNCIL_LAUNCH_PREPARATION_20261103.md` for the bounded review and receipt.
