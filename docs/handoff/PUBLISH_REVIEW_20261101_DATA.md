# Publish review — architecture, privacy and data custody

Independent first pass, November 1, 2026. Canonical checkout:
`/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.
Source inspected at **9f9b5e0**, initially clean. One data-custody seat's opinion
for cross-examination with Darwin; this is not a Chair verdict, legal clearance,
fresh vendor audit, device acceptance, or an assertion that publication occurred.
Only this new file was written. No UI, account, credential, configuration,
deployment, activation or deletion action was taken.

## Call

**REVISE public data-readiness, while finishing the source-backed declaration
draft now.** Two concrete gaps remain: ordinary users currently cannot initiate
the implemented automatic deletion flow, and the recorded Apple privacy label
is inconsistent with account-linked routes and operational/optional telemetry.
Neither is resolved by successful sign-in, screenshot uploads or compilation.

Conservative inclusion can remove the need to prove a telemetry exemption or
unlinkability before drafting labels. It cannot establish a working deletion
service, vendor purpose/retention facts, processing commitments, or nonexistent
data categories. No new paid service is required by this review.

## Evidence boundaries and fresh parent readback

- Parent reports deletion endpoint v3 and status/worker v1 active, but control
  **enabled=false, allowed-owner count=0, cron count=0**. This confirms the dormant
  state previously recorded in `DELETION_ACCEPTANCE.md:47–63`; no settings were
  independently retrieved here.
- Parent reports the production client billing flag false, correct StrideOS
  project, and an iOS public purchases key present. Key presence is not billing
  activation or proof of purchase collection. No values were read or copied here.
- Parent reports one security-advisor warning for disabled paid-tier leaked-
  password protection and four expected private-schema RLS/no-policy information
  notices. These do not justify a paid upgrade or disabling private isolation.
  They also do not certify the entire service's security.
- Apple browser authentication expired, per parent. The earlier privacy editor
  was cancelled without saving/publishing (`PRIVACY_LABEL_RECONCILIATION.md:9–20`).
  This seat cannot assert current Apple answers from an old receipt.
- Parent's full-suite/isolated Swift-timeout work and build/capture/Apple checks
  remain with the main task. This review makes no competing build verdict.
- The compared deletion, backup, Coach, media-upload and telemetry source files
  listed below show no changes from recorded build-106 source `13feb937` to
  `9f9b5e0`. This supports carrying forward their bounded source inventory, not
  assuming identical live environments or all distributed binaries.

Evidence paths are repository-relative. Short basenames below resolve to
`src/lib/` for `syncService.ts`, `aiCoach.ts`, `posthogClient.ts`,
`movementVideoStorage.ts`, `observabilityClients.ts` and `poseSequenceStorage.ts`;
`src/utils/` for `observabilityPrivacy.ts` and `measurementMatrix.ts`;
`src/components/settings/` for `AccountPrivacy.tsx` and `AccountCleanupGate.tsx`;
`supabase/functions/_shared/` for `deletionProviders.ts`, `deletionRuntime.ts`
and `launchHandlers.ts`; and `supabase/migrations/` for the dated SQL files.
The named acceptance/reconciliation documents are in `docs/handoff/`.

## Concrete findings and smallest sufficient actions

| Priority | Finding and exact evidence | Smallest action; ownership of the remaining fact |
| --- | --- | --- |
| P1 | **Deletion initiation is unavailable for ordinary accounts.** `src/lib/accountDeletion.ts:230–239` checks `automaticProcessing` before saving a secure intent. `supabase/functions/_shared/deletionHandlers.ts:91–99` rejects new receipt-based requests while automation is off. Fresh parent control readback is off. | Retain the preflight/fences. Finish the existing service's provider/native acceptance and operating decisions, then have the main task separately approve and verify its intended activation/scope. Changing a label or the error message does not make deletion available. |
| P1 | **Privacy answers need a real reconciliation/publication, not just this document.** Whole activity objects go into account-bound rows in `src/lib/syncService.ts:130–140`. The prior label had location unlinked and omitted operational usage/diagnostic types (`PRIVACY_LABEL_RECONCILIATION.md:9–36`). | Prepare the inclusive matrix below now. Main compares it with the actual available release and publishes the complete set through authenticated Apple access. No uncertain diagnostic exemption is needed to draft an included type. |
| P2 | **Deletion confirmation overstates removal.** `src/components/settings/AccountPrivacy.tsx:56–63` promises permanent removal of server records without explaining the retained recovery record. `supabase/migrations/20261101054636_deletion_automation_receipts_and_tickets.sql:450–456` clears account usage/provider secrets but keeps the completed request row. `src/lib/accountDeletionControl.ts:131–134` retains a released native control record. | An autonomous source-copy follow-up can say that account/training data and app-owned uploaded media are removed, while minimal recovery/status records remain; link the existing policy. Preserve all confirmation and cleanup behavior. Do not claim every associated identifier disappears. Not edited in this pass. |
| P1 acceptance/config | **Real provider revocation is still unaccepted, not absent in source.** `deletionProviders.ts:94–129` checks Google subject/audience and Apple identity, secures the exchanged Apple refresh token, and revokes. `deletionRuntime.ts:67–75` requires a secured provider disposition before proceeding. `DELETION_ACCEPTANCE.md:177–183` separates real grants/native cleanup from synthetic evidence. | Main/owner acceptance needs consenting disposable Apple/Google identities and the actual client/provider interaction: revoke success, cancelled prompt, expired-token repair and wrong-account rejection. Engineering can prepare fixtures and sanitized receipts. No source defect is established by the absence of a real-grant receipt; do not use an owner-history account. |
| P2 operating decision | **No accepted processing window or completion-record retention policy.** Stage/reference messages exist (`AccountPrivacy.tsx:56–62`; `AccountCleanupGate.tsx:64–87`), while policy explicitly states processing is disabled (`docs/privacy.html:148`). Completion rows and recovery records have no reviewed TTL (`DELETION_ACCEPTANCE.md:128–135`). | Owner supplies a support operator, realistic processing/escalation expectation and retention/backup decisions. Engineering can then render approved stage/time copy and implement/test any agreed retention change. A minute-based scheduler is not an SLA. Do not invent a deadline or delete retained receipts to make the statement true. |
| P2 configuration fact | **Client billing=false is not the complete RevenueCat inventory.** `src/lib/revenueCat.ts:13–32` gates the client SDK. Separately, `supabase/functions/ai-coach/index.ts:7–18` supplies server billing and QA-owner policy; `supabase/functions/_shared/revenueCatAccess.ts:15–24,33–43` can query account entitlements even with the client SDK off. | Main reconciles the server global/QA applicability for the released audience as a boolean/policy fact without exposing credentials. Keep Purchase History conditional until that boundary and actual available purchase behavior are established; do not infer collection merely from a present SDK key. No server traffic or enabled flag is asserted here. |

### Important distinctions that avoid unnecessary work

- Apple does not require deletion to be instant or automated. A fulfilled,
  in-app-initiated manual process with clear timing and completion confirmation
  can qualify. The current native path, however, specifically refuses to start
  when automation is off. A support email alone is not a substitute for this
  app's required initiation path. An alternative manual workflow would need
  implementation and acceptance, not a rename of the current button.
- Missing legacy provider tokens are explicitly represented as manual revocation
  guidance (`deletionProviders.ts:85–90`; `AccountCleanupGate.tsx:72–78`). They are
  not evidence of a revoked grant. Supplied bad/expired credentials stay pending
  (`deletionRuntime.ts:71–75`); do not weaken that safeguard to force completion.
- Apple exchange capability is only a presence check of configuration names
  (`deletionRuntime.ts:123–125`), not proof credentials match the app or remain
  valid. A legacy missing-token fixture cannot validate fresh Apple revocation.
- Scheduler eligibility treats NULL allowlist as unrestricted and an empty list
  as no eligible owners (`20261101054636_deletion_automation_receipts_and_tickets.sql:86–90`).
  Its configure helper schedules work and updates scope together (`:527–549`).
  Activation must explicitly name the intended scope; do not change it here.
- Local cleanup includes consent records, app-owned pose/video directories and
  scoped archives (`src/lib/localAccountCleanupManifest.ts:3–23`); original Health,
  photo-library and other-device copies are separate. No claim of their erasure
  follows from a completed server receipt.

## Source-backed privacy draft

For the reviewed available functionality, the following is a reviewable inclusive
draft. “Linked: Yes” for diagnostics is a conservative disclosure choice, **not
an observation that Sentry has linked a particular event to a person**. All
purpose entries below are limited to the inspected use; do not add advertising
purposes merely as a hedge. This is an app-level union across available flows.

| Data type | Collection / linkage draft | Purpose and source evidence |
| --- | --- | --- |
| Health; Fitness | Yes; linked | Functionality, plus personalization for selected context used in tailored Coach replies. Account-bound workout/check-in/Activity backup: `syncService.ts:44–57,76–84,130–140,176–184`. Health/symptom context and personalized role: `app/(tabs)/coach/index.tsx:421,459–494`; explicit transmission gate: `src/lib/aiCoach.ts:83–109`. |
| Name | Yes; linked | Functionality/personalization where supplied in identity or Coach context. `src/store/authStore.ts:275–288`; Coach role/context above. Do not claim fresh onboarding names are backed up by an unused helper. |
| Email Address; User ID | Yes; linked | Functionality: authenticated accounts and owner-scoped backup/operations. `src/store/authStore.ts:214–226`; `syncService.ts:130–140`; account-scoped usage below. No additional email marketing purpose established. |
| Precise Location | Yes; **linked** | Functionality: saved routes are in the entire Activity object sent with account ID (`src/types/activity.ts:108–119`; `syncService.ts:130–140`). This correction is definite; telemetry scrubbing does not anonymize database backup. |
| Photos or Videos | Yes; linked | Functionality: explicit Add Video copies/uploads original media bytes under the signed-in account (`app/(tabs)/movement/index.tsx:469–496`; `movementVideoStorage.ts:94–113`). Local analyses are not thereby automatic cloud backups. |
| Other User Content | Yes; linked | Functionality/personalization: saved notes and selected chat/movement context. `syncService.ts:103–111,130–140`; `aiCoach.ts:83–109`; `supabase/functions/ai-coach/index.ts:33–44`. Include without depending on an unverified real-time-only provider-retention exemption. |
| Product Interaction | Yes; **linked** | Functionality for account-scoped request attempts/reservations, Analytics for optional allowlisted app/tutorial events. `20261031150809_launch_privacy_and_coach_limits.sql:24–40`; `launchHandlers.ts:56–64`; `posthogClient.ts:60–69`; `observabilityPrivacy.ts:10–17,41–62`. Operational counts remain in scope even if analytics is off. |
| Crash Data; Other Diagnostic Data | Include; linked conservatively | Functionality: JS exception handler and sanitized error envelopes, including code coordinates, event ID/time and release/build. `observabilityClients.ts:20–43`; `observabilityPrivacy.ts:80–120`. Native crash handling is off, but JS failures are still handled. Scrubbing alone does not establish vendor unlinkability. |

### Items to resolve without inventing data

- **Hands / Head:** retain the existing source-based proposal to omit dedicated
  structured body categories from this draft. Normal pose sequences are local
  (`poseSequenceStorage.ts:22–27`); the measurement filter admits listed supported
  joint measurements (`measurementMatrix.ts:303–310`), not arbitrary body streams.
  See the bounded outbound inventory in `PRIVACY_LABEL_RECONCILIATION.md:53–83`.
  Generic video or free text does not establish dedicated structured hand/head
  collection. Whole-object backups still admit unexpected historical fields;
  this is a bounded supported-writer finding, not an audit of every old record.
- **Other User Contact Info:** no additional solicited contact field was
  established; do not retain this category solely because users could put a
  phone number into generic notes. Email already has its own category.
- **Customer Support:** `docs/support.html:31–41` explicitly solicits account/
  training support by email. If those requests are retained, including linked
  Customer Support for functionality avoids relying on an unproven exemption.
  Owner confirms actual support handling/retention; an external mail link is
  not proof of an in-app support database or a second contact-address type.
- **Purchase History:** conditional as described above. Reconcile available
  client purchases and server entitlement lookups; no payment-card collection
  was found in these paths. Public billing activation changes the inventory.
- Do not add demographic, audio, biometric or device-ID categories merely from
  package names, a random event/session UUID, possible free-text contents or IP
  transport exposure. Establish the particular retained data/use before adding
  a new category. No such additional category is certified by this review.

### Can the required answers be finalized conservatively?

**The core matrix can be prepared now; waiting for a telemetry exemption is
unnecessary.** Include the optional paths and decline to assert unlinkability
where it is unproven. This avoids making a privacy-preserving payload allowlist
carry claims about a vendor's retention/correlation practices.

**A universal “Yes to everything” is not a truthful finalization strategy.**
Finalize the release-audience billing boundary and support handling, reconcile
the actual Apple editor, and record the submitted answers. “No advertising
tracking observed in the inspected source” is supportable; an unconditional
statement about every third-party business practice is not freshly verified.
Consent/default-off status does not itself establish a disclosure exemption.
Vendor retention/deletion and local legal obligations remain distinct decisions
even when the label includes the data.

## Autonomous follow-up versus external facts

Engineering can finish a precise declaration worksheet, qualify deletion
confirmation text, document disabled/capability states, add regression coverage
for those messages, and prepare an operator acceptance checklist without a new
service or credentials. None of those actions needs to change the existing
account/history model or weaken provider/ownership fences.

Owner/provider/device facts still needed: operational responsibility and timing;
retention and backup treatment; real provider credentials/grant behavior; native
secure-receipt/cleanup/restart behavior; and actual release configuration and
Apple declarations. Source can consume approved policy values; it cannot invent
them. This file authorizes none of those external changes.

## Cross-examination for Darwin / Chair

1. Is an accepted receipt-based manual service a smaller valid path than
   activating the existing automation? Either must actually accept requests;
   leaving this client's capability false plus email help does not close it.
2. Does the inclusive diagnostics-linked draft remove the earlier linkage
   uncertainty as a declaration blocker while preserving vendor/privacy work?
   My answer is yes; it must not be advertised as evidence of actual correlation.
3. Does any retained support or server entitlement flow change the final type/
   purpose union? Verify that narrow boundary instead of re-auditing builds.
4. Keep the missing-token fallback, or require a fresh-token attempt for new
   social accounts? Decide from actual provider acceptance and policy; neither
   an automatic-revocation promise nor indefinite denial of deletion follows
   from the legacy fixture alone.

## Validation performed in this seat

Read-only source comparison and **60/60 local synthetic tests passed**, zero
failures/skips, from `deletionRuntime.test.ts`, `accountDeletionClient.test.ts`,
`observabilityPrivacy.test.ts` and `observabilityLifecycle.test.ts` (12.7s).
They cover actual modules with mocked native/provider/backend boundaries,
including disabled automation, wrong/expired credentials, lease ordering,
recoverable receipts, scoped cleanup, consent lifecycle and telemetry payloads.
These tests do not revoke a real grant, delete a live account, or prove native
runtime acceptance. No source/configuration or global document was edited.

## Official interpretation references

- [Apple privacy categories and collection guidance](https://developer.apple.com/app-store/app-privacy-details/):
  declarations cover the developer and integrated partners; local-only data is
  treated separately from transmitted results, and exemption conditions must be
  established together. Used for the draft classification, not as provider facts.
- [Apple account-deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion):
  in-app initiation, reasonable manual processing with timing/confirmation, and
  subscription/provider handling inform the operating boundary above.
- [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple):
  the existing source/receipt cites it for missing-token guidance. Its full body
  was not newly retrieved by this seat; no new conclusion depends on rereading it.

Apple privacy/deletion guidance was opened in this pass. The Supabase Markdown
changelog and Apple's TN Markdown endpoint were unavailable through the read
tool; no SDK/API or backend changes were made on that basis.
