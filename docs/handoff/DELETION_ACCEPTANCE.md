# Deletion acceptance and policy handoff

Documentation review: November 1, 2026 UTC / October 31, 2026 Pacific.
Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.

This record describes current source, the parent's verified deployment/live
receipts in this session, and the limits of that evidence. It is not a legal
opinion, public-launch clearance, real provider-grant revocation acceptance, or
native-device cleanup report. This documentation pass made no account, database,
configuration, deployment, purchase, or release changes. Billing remains off as
reported by the parent; billing flags were not freshly read in this pass.

## Current source and queued build receipt

Parent-reported final source: `04158fc924692611e6f4bbef4b4ff9128f96ed2b`, pushed.
Final regression: **1,412/1,412 passed**, zero skips, **154.8s**. The parent also
reported 49 backend Deno tests and backend checks, native prebuild and Hermes
export passed. Build **105** is **queued** as
`d639ada9-80c2-413c-adb8-2f59da229b5a` from that exact app commit. No cloud-build
completion, archive, upload or Apple processing is claimed for this queued build.
These are supplied parent receipts, not newly executed checks by this sidecar.

## Latest verified operating state

Parent-reported exact deployed-source verification:

| Function | Version | Gateway JWT verification | Application authorization |
| --- | --- | --- | --- |
| `account-deletion` | 3 | On | Verified Supabase user; owner-scoped capability/preflight RPCs |
| `account-deletion-status` | 1 | Off | Private recovery receipt, checked by a service-only RPC |
| `account-deletion-worker` | 1 | Off | Expiring, single-use, request/purpose-bound job ticket |

JWT-off on the last two routes is deliberate: a receipt must remain usable after
Auth removal, and the scheduler uses a scoped ticket. Neither route is authorized
by a supplied user ID, request ID alone, public API key, or claimed capability flag.
Receipt and job secrets are distinct. A receipt can read/resume its already
authorized request, not start a new deletion or supply replacement credentials.

The live exercise was allowlisted to **three newly created synthetic UUIDs**.
The parent verified existing/nonfixture eligibility remained **0**. At the end,
`configure(false)` was verified as:

| Control | Final receipt |
| --- | --- |
| `enabled` | `false` |
| `allowed_owner_ids` | `[]` |
| Gateway API key in scheduler control | `null` |
| Deletion cron jobs | `0` |

Automation is now off. The fixture exercise is not activation for the original
account or general users. No control values were changed or privately retrieved
by this documentation sidecar. For any separately authorized future synthetic
exercise, use explicit fixture UUIDs. The SQL helper interprets a NULL allowlist
as unrestricted owner eligibility when enabled; NULL is not an empty allowlist
and was not the scope of this fixture acceptance.

## Live synthetic API/server acceptance

All times below are November 1, 2026 UTC, from the parent's live acceptance
receipt. They were not recreated or independently re-probed by this sidecar.

| Fixture | Observed result | What it proves |
| --- | --- | --- |
| Immediate email fixture | Completed `05:52:52.896211Z` | Synthetic authenticated API/server deletion path completed |
| Legacy Apple fixture | Completed `05:53:10.214721Z`, `manual_required` / `legacy_token_unavailable` | Honest missing-credential fallback; does not prove Apple grant revocation |
| Scheduler-resume fixture | Request created; ticket issued/consumed; lease claimed then deliberately expired at `05:53:03Z`. No subsequent endpoint, status-poll, or manual dispatch call. Read-only SQL observed cron success at `05:54:00Z`, pg_net worker HTTP **202**, and completion `05:54:01.769662Z`, `dispatch_attempts=2`, Auth absent | Server scheduler resumed an abandoned synthetic request without a client/endpoint trigger |

Parent readback: all three fixture Auth users were absent; their backup/storage
records were removed; three minimal completed fixture receipts remain. The
original-account counts exactly matched the pre-test baseline:

| Original-account scope | Unchanged count |
| --- | --- |
| Auth | 1 |
| Profiles | 1 |
| Workouts | 15 |
| Strength | 5 |
| Storage objects | 2 |
| All other app counts in the parent's baseline | 0 |

The original account was not deleted or opted into automation. Fixture cleanup is
not customer deletion. No fixture passwords, receipt secrets, tickets, provider
tokens, signing keys, or real-user identifiers are included in this record.

Earlier in this session, **19/19** `scripts/tests/deletionRuntime.test.ts` VM tests
passed with no failures/skips. They executed actual runtime/core/handler/provider
modules with mocked external Deno, Supabase, HTTP and jose boundaries. Those
tests cover named RPC arguments, owner allowlists, lease/provider ordering,
Apple exchange persistence before revoke, mismatched token rejection, ban before
file/Auth removal, ticket expiry/replay, retry backoff, and owned-status GET
preflight. They are synthetic local evidence, separate from the live table above;
this prose-only review did not rerun a full app suite or native build.

## Current code semantics and disclosure boundaries

| Stage | Source behavior | Accurate user-facing description |
| --- | --- | --- |
| Before submission | Active recording is blocked from deletion initiation; native secure receipt must be durably saved. Normal training/sync are fenced while intent is pending | A saved confirmation is not proof the server received it; preserve the app's recovery record |
| Request accepted | Authenticated owner and explicit confirmation bind the original receipt hash. Duplicate starts retain that identity | A reference proves recording of the request, not completion |
| Provider processing | Apple/Google subject and app identity are checked when usable credentials exist; Apple exchange refresh token is persisted before revoke. Known failed/expired credentials cannot become a legacy missing-token fallback | Revoked, manual guidance, and pending are distinct outcomes; configuration failures are not fixed by repeatedly signing in |
| Credential repair | Explicit authenticated action only; the owned-status RPC must say the request is eligible, incomplete v1, and outside an active lease before prompting | Confirm the original provider identity only when offered; retry status if the worker still holds its lease |
| Server removal | Leases and provider prerequisites precede account ban, owner-prefixed Storage removal, Auth deletion/cascades, inventory verification, and completion | Do not describe a request, provider error, Auth error, or partial file removal as completed deletion |
| Local cleanup | Requires a capability-verified completed server receipt. Account stores, scoped goal archives/journals, known credentials, app-owned media and related temporary files are removed and absence is checked | Server completion and this device's cleanup are separate stages; retry online/unlocked after a failure |
| Reopening | Old in-memory stores remain quarantined; a fresh app bootstrap verifies absence before releasing local ownership | Follow the close/reopen instruction after verified cleanup; restarting is not proof that data was erased |
| Retained receipt | Minimal server receipt/provider dispositions and a protected device recovery record remain after completion | Not an anonymous aggregate and not a promise that every associated identifier has vanished |

Source map: `src/lib/accountDeletion.ts`, `accountDeletionControl.ts`,
`localAccountCleanup.ts`, `localAccountCleanupManifest.ts`,
`src/components/settings/AccountCleanupGate.tsx`,
`src/utils/deletionFulfillment.ts`, `supabase/functions/_shared/deletionRuntime.ts`,
`deletionHandlers.ts`, `deletionProviders.ts`, and migration
`20261101054636_deletion_automation_receipts_and_tickets.sql`.

The server removes the configured StrideOS account data and app-owned cloud
media. It does not erase Apple Health, original photo-library items, exported
Strava/other-service copies, purchase records held by Apple/RevenueCat, or local
copies on other devices. Subscription cancellation is a separate Apple action.
Server success also does not prove deletion from historical provider backups.

The retained server completion row includes the former account UUID, receipt
hash, request/completion timestamps and status; minimal private provider
dispositions/reasons also remain. Provider secrets are cleared after confirmed
revocation or at completed fulfillment. The native control record remains after
release to support recovery. No automatic purge period for these completion
records was identified in the reviewed code. A legal basis, retention duration,
backup-retention account, and handling of support requests about retained data
have not been established by this technical review. Do not describe those
records as required by law without a supported decision.

## Policy text and publication status

Reviewed documentation-only pages, now published separately by the parent:

| File | Intended published URL | Changes |
| --- | --- | --- |
| `docs/privacy.html` | https://drizzyydrew.github.io/Stride-OS/privacy.html | Current off state; secure receipt and temporary provider credentials; pending versus completion; local cleanup/restart; retained operational records and external-copy limits; removes absolute backup/security assurances |
| `docs/terms.html` | https://drizzyydrew.github.io/Stride-OS/terms.html | Same deletion stages and limits; separate provider/subscription actions; no instant-completion or fixed-deadline promise |
| `docs/support.html` | https://drizzyydrew.github.io/Stride-OS/support.html | Current availability, safe progress/retry guidance, explicit credential repair, no private recovery secrets in email, and retained/external data boundaries |

**Publication complete, per parent verification:** only `privacy.html`,
`terms.html` and `support.html` were pushed to the existing Pages branch in
commit `d9e8749ddd55158a0145f31761d00887a44d6ecc`. GitHub Pages built at
**2026-11-01T06:06:56Z**. Uncached readback verified all three **HTTP 200** and
byte-for-byte exact matches, with these SHA-256 values:

| Published page | Verified SHA-256 |
| --- | --- |
| `privacy.html` | `d022565f86d5d243aaa28c194f5f6373d9f0bc6378380c940914fd1bd423e05a` |
| `terms.html` | `e2925582fc5ff64deced5292f89079c80ce0ad53d08ad6f826b4b876e96c0dc7` |
| `support.html` | `8ba97d37923197c7f37721c9e3d5b8fcdbe3e75d1a2cd6f15b00d0aa335ca495` |

The initial documentation review observed older published copies before this
separate publication. This receipt update records the parent's later push and
readback; the sidecar did not perform a new push, deployment or public check.
`src/utils/legal.ts` already links to the URLs above and was not changed.
Policy publication does not change the installed Build 104 binary, finish the
queued Build 105, activate billing, release the app, or provide legal clearance.
The new native cleanup
flow needs an appropriately built and accepted client; backend deployment alone
does not deliver it to an installed app.

Documentation checks passed: all three policy files have balanced HTML, no
scripts, valid local page links, and the current availability/subscription
disclosures; all six edited/added documentation files passed whitespace checks.
No application code or tests were changed for this review.

## Acceptance and operating decisions still open

- Real Apple/Google grants: authenticated revoke success, expired-token repair,
  cancellation and linked-account behavior have not been accepted from this
  synthetic exercise. The Apple legacy fixture proved manual fallback only.
- Native device: secure receipt across force-close, owner/account switching,
  recording/permission state, online/offline status recovery, real media and
  credential cleanup, interruption during purge, restart verification and other
  devices remain device-QA work. No customer is a test fixture.
- Support and retention: identify operational responsibility and evidence-based
  processing expectations, decide completion-record and backup retention, and
  validate identity-verification/support handling. No unsupported SLA or legal
  clearance is supplied here.
- Public availability: general automation remains off. The current email-help
  fallback is not represented as satisfying Apple's in-app deletion requirement
  for a public launch. Accept the intended user flow and communicate processing
  expectations before representing that requirement as met.
- Public policies: the three-page publication/readback gate is complete with the
  receipt above. Any future policy edits need their own publication/readback;
  no paid billing, app release or legal clearance follows from this publication.

Official guidance consulted: [Apple account-deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion),
[Sign in with Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple),
and [Apple subscription cancellation](https://support.apple.com/en-us/118428).
Apple distinguishes account deletion from temporary deactivation, permits
confirmation/identity checks, calls for clear progress information, and separates
subscription cancellation. TN3194 covers manual revocation guidance when the
necessary Apple tokens are unavailable. These references inform the review;
they are not evidence of App Review approval or jurisdiction-specific legal advice.
