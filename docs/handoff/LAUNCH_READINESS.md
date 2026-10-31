# StrideOS Launch Readiness

Checkpoint: October 31, 2026. Current continuation follows committed baseline 399bcac in the canonical Developer checkout. This is a targeted single-assistant multi-lens review, not an independent security audit, clinical validation, legal opinion, or physical-device acceptance.

## Latest Continuation

- The owner explicitly authorized separating Bet Desk and StrideOS without unnecessary deletion. Both apps already had dedicated projects; the mistaken shared-auth conclusion came from empty legacy Bet Desk tables in StrideOS. Bet Desk's web and mobile production URLs were freshly verified against its dedicated project. Nine empty legacy tables were preserved in a private archive schema, with the same relation identities and counts, and their obsolete Auth foreign keys detached. No accounts, files, training history, bets, or projects were deleted. No paid upgrade was needed. See `BACKEND_ISOLATION.md` for evidence and the failed, non-billed new-project attempt.
- All seven high dependency findings were removed through narrowly scoped patched upstream dependencies, not an SDK jump. The CommonJS adapter delegates URI parsing to exact upstream decode-uri-component 0.5.1. Real Router parsing, bounded malicious inputs, Metro assets, Expo CLI schemas, and both plist consumers have dedicated tests. Current scan: 18 findings (16 moderate, two low), zero high/critical. These remaining findings are not represented as zero vulnerabilities or independent clearance.
- Guarded deletion fulfillment is implemented as an operator command with a read-only default, an exact-receipt execution confirmation, database leases, Storage API removal before Auth removal, and verified completion. Cloud access freezes at the recorded request even for older clients. The real existing Apple-linked account remains blocked until provider revocation is configured; no deletion command was run against it. This is not a completed automatic end-user deletion service.
- RevenueCat project `1a3600d5` exists and email confirmation is complete. Entitlement `pro` / StrideOS Pro (`entl0c642305f9`) was created with no attached products. An offering cannot be saved until products exist. Apple purchase-key upload, store products, approved paid scope/prices/trial, server key, and sandbox tests remain. Client/server billing stays off.
- Initial full regression rerun passed 1,227/1,227 tests. A fresh `npm ci --ignore-scripts` succeeded from the lockfile; clean-install validation is tracked in the continuation's final receipts. Full iOS Metro/Hermes export passed (3,713 modules, 109 assets). This proves JavaScript bundling, not native compilation or device behavior.

### Final Engineering Checkpoint

- Final regression after the additional false-completion test: **1,228/1,228
  passed**, no failures/skips, `/tmp/strideos-launch-release-tests.log`, 120.5s.
  Semantic TypeScript, Expo SDK compatibility and diff checks passed.
- Actual-component browser fixture rerun: **28/28**, no page errors or external
  requests, dark/light and 320/393/768 widths. Still synthetic, not native QA.
- A separate directory with no pre-existing `node_modules` installed the lockfile
  successfully. Its decoder resolves to its own copied vendor adapter, not the
  canonical checkout. Phone, Watch and Live Activity prebuild passed there. The
  existing missing optional `expo-system-ui` background-color warning remains;
  neither SDK 57 nor React Native 0.86 was adopted despite CLI recommendations.
- All deletion SQL changes were transaction-probed before applying and probed
  again afterward. Null leases, mismatched storage ownership, client RPC access,
  false completion and cross-app Auth references are checked. Synthetic users,
  requests and Storage metadata fixtures were rolled back and absence verified.
  No physical test object was uploaded/deleted and no customer was removed.
- Latest security advisor: only leaked-password protection (paid-plan setting).
  Latest dependency scan: zero high/critical, 18 moderate/low.
- GPS, HealthKit, Watch/Live Activity code, route builder, strength engine and
  root startup show no diff from this continuation's baseline.

Single-assistant multi-lens release review: the platform view supports a limited
TestFlight candidate after these checks; the contrarian view rejects any public-
launch claim while provider revocation, billing and physical/independent reviews
remain open. The resolution is beta testing only, payments unchanged/off, not
App Review or public release. Engineering confidence for that bounded candidate
is 95/100 as a judgment under the repository gate, not a measured reliability
probability. Native compilation, upload and Apple processing must each be checked
separately and appended after they happen. No score waives the public-launch gates.

## Scope And Decision

The user authorized working through the launch checklist autonomously and using Chrome/computer use, with owner-dependent steps last. No paid service purchase, freelancer hire, acceptance of third-party contracts, or public App Store release is being performed without the owner's specific decision. No independent review agents are available in this run.

## Implemented In Source

- Explicit, versioned, account-bound Anthropic sharing choice. Enabling waits for storage confirmation; logout, revocation, failed storage and owner races fail closed. Chat requests and late responses are owner/consent fenced. Context disclosure includes potentially sensitive training/recovery/movement information; unrelated on-device guidance stays usable without consent.
- Authenticated AI handler with bounded input, fixed server safety instructions, sanitized errors, cancellation, no automatic retry, maximum 1,024 output tokens, and atomic reservations capped at 20 requests/account/UTC day and 500 requests globally/UTC day. Reservations are charged even if a provider call fails, to prevent retry abuse. This bounds requests, not a guaranteed dollar bill; vendor spend caps remain an owner setting.
- Authenticated, idempotent in-app account-deletion requests and receipt/status UI. Client-supplied user IDs are ignored. No existing user account or activity has been deleted to test this feature.
- Account/legal controls and signup links, corrected privacy statements about local media, route backups, AI context, deletion versus reset, and optional purchase processing. Terms and support pages and safer listing copy are prepared.
- Subscription SDK installed and exact version locked; owner-fenced serialized purchase/restore operations, only known monthly/annual products, locale prices from Apple/RevenueCat, cancellation/renewal disclosures, and no fabricated active entitlement. Billing is disabled unless explicitly enabled with a valid iOS project key.
- Tutorial replay consumes its request only after the focused/hydrated screen starts the walkthrough. Background mounted tabs cannot steal it. Bubble pointer and in-bubble close control added. Activity metric spacing increased; split refresh moved to the bottom.

## Hard Launch Gates Still Open

1. **End-to-end deletion, not just initiation or an operator engine.** Backend separation is now verified. The operator's database and workflow checks are implemented and tested, but the existing Apple-linked account deliberately fails closed until provider-token revocation is implemented/configured. Local-device cleanup, completion notification/status handling, retention operations, operator responsibility and dedicated end-to-end acceptance remain. The request endpoint still only initiates deletion. Do not mark a request completed merely because it was recorded or a plan was reset. Confirm processing time and operational responsibility before promising an SLA publicly.
2. **Paid configuration and lifecycle.** Do not enable `EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED` merely because purchase UI compiles. AI Coach chat has source-level Pro gates and server-authoritative RevenueCat entitlement verification, including expiration/grace checks; core recording/history/Insights remain free. Create RevenueCat/App Store products (`strideos_pro_monthly`, `strideos_pro_annual`), entitlement `pro`, and the matching offering; approve the initial paid scope/prices/trial; configure the public iOS key and the separate server-only `REVENUECAT_SECRET_API_KEY`; keep client/server billing switches aligned (`EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED` and Supabase `STRIDEOS_BILLING_ENABLED`). Test real sandbox purchase/restore/refund/expiration and revocation before enabling either switch. No paid feature or charge is activated in this run.
3. **Owner account settings.** Apple agreements, banking/tax, App Store labels/age rating/export compliance/reviewer account/availability, provider spend limits and billing setup are unverified. Leaked-password protection remains disabled; do not purchase a plan or alter shared auth settings blindly. Existing trigger-function search paths/direct-execution privileges were hardened and the new security advisor scan cleared those warnings.
4. **Physical-device acceptance.** Independent testers must exercise fresh installation, Apple/Google/email login, denied permissions, screen-locked GPS, pause/resume/interruption, Watch reconnect, offline save, account ownership, restore/reinstall, failed Health recovery, and purchase lifecycle when enabled. Source/browser checks cannot prove these paths.
5. **External human review.** No lawyer, QA contractor, security engineer, or sports-domain reviewer has been hired or represented as having approved the app. Gather fixed-scope quotes and obtain owner approval before spending.
6. **Release.** Final tests, exact native archive, SDK/privacy manifests, source-map upload, TestFlight processing, external beta feedback, and App Review/public-release decisions are separate gates. Build 103 was absent in the last live EAS read at the start of this request; no public release is claimed.
7. **Residual dependency review.** High/critical findings are now zero without changing Expo SDK 56. Eighteen moderate/low upstream findings remain. The release review must assess their actual exposure and compatible fixes; neither a clean high-severity threshold nor successful bundling establishes whole-app security.

## Deletion Operator Runbook (Not Yet An Accepted End-User Service)

The implementation is `scripts/process-account-deletion.ts` and the pure engine
`src/utils/deletionFulfillment.ts`. It requires secure, server-only operator
configuration. Running it without `--execute` only inventories the exact request
and reports blockers. Execution additionally requires
`STRIDEOS_DELETION_CONFIRM_REQUEST` to match that receipt. Never provide credentials
through command-line arguments, public variables, source, screenshots or chat.
Social-provider accounts and any unexpected shared Auth/storage dependencies fail
closed before a lease or destructive action. Dedicated database functions are
service-role-only; completion refuses residual records/files or a live Auth user.
No real user has been removed to test this engine.

- Monitor pending `stride_account_deletion_requests` through restricted operator access; do not expose the queue to other users. Each request has an authenticated owner and stable receipt. A duplicate submission does not reset its original date or falsely mark completion.
- Verify request ownership and identify StrideOS-only database/media records and any shared identity dependencies. Do not inspect or delete unrelated app records as a substitute for identity separation.
- Stop the account's StrideOS sync and writes before removal so queued writes cannot recreate records. Revoke active sessions and applicable social-provider grants. Handle Apple refresh-token revocation with the properly configured server credentials.
- Remove owned objects through the Storage API, not direct SQL deletes from `storage.objects`. Purge only the requester's app records. Delete a shared auth identity only when doing so cannot erase another service's account and is authorized for that identity.
- Account for local copies and other devices, restricted backups, legal holds and paid subscriptions. Account deletion does not cancel Apple renewal or remove Apple Health/photo originals.
- Verify record/object isolation and removal, notify the requester, then record completion appropriately. Test the whole procedure using dedicated test identities first. This runbook is not permission to delete existing users.

## External Review Brief

Hire a senior React Native/iOS reviewer with shipped HealthKit, Watch, Supabase RLS/storage and StoreKit/RevenueCat experience for a fixed-scope launch audit, not a rewrite. Ask for prioritized findings, repro steps, affected code, test evidence and a capped remediation estimate. Add real-device QA and a licensed privacy/consumer-app attorney. Give least-privilege access and dedicated test accounts; retain ownership of all accounts and source. Proposed planning budgets, not quotes: engineer $1,000-$3,000, QA $400-$1,000, legal $750-$2,000; optional independent training-content review $300-$1,000.

## Verified Checkpoint Receipts

- Latest complete serial regression suite after compatible dependency patches, hiding unavailable legacy Movement Lab promotion panels, and durable AI-consent failure recovery: **1,212/1,212 passed**, no failures/skips, `/tmp/strideos-launch-tests-complete.log`. Final `npm run check` passed both the semantic TypeScript check and Expo dependency compatibility. The grid retains its existing narrow-screen two-column sizing and changes vertical spacing; no tracking or metrics calculation changed.
- New privacy/AI/server entitlement/purchase race/replay tests exercise actual factories and runtime bindings, including owner changes during awaited SDK identity and offering lookups, no SDK initialization while billing is disabled, and consumed replay timers on retained screens.
- Actual component browser fixture: **28/28 checks passed**, dark/light at 320/393/768 widths, no page errors or external requests. Includes real AI consent and Account & Legal components plus the real tour provider, safe bubble bounds and dismiss/replay. Screenshots under `/tmp/strideos-launch-preview`. Synthetic storage/accounts only; not native Switch, StoreKit, VoiceOver, or physical-device proof. Browser QA exposed and fixed a pre-existing web-only `findNodeHandle` focus crash without changing the native focus path.
- Supabase migrations applied: `launch_privacy_and_coach_limits`, `harden_trigger_privileges`, `grant_strideos_owner_access`. The deeper authenticated-role probe found missing CRUD table grants that prevented backup operations despite existing ownership policies, plus unnecessary client maintenance grants. Restricted StrideOS-only grants were corrected; other-app table privileges were not changed.
- Live transactional RLS probe `scripts/sql/launch-rls-probe.sql` then passed: signup profile trigger still works, users can access/update their own records, and cross-account reads/writes are denied across the four backup-log tables. The quota probe allowed exactly 20 of 25 requests per owner, denied the exhausted global quota, and isolated deletion receipts. All synthetic auth/request/activity records were rolled back and absence was read back. No customer data was deleted. These are SQL role probes, not a device-to-API backup/restore test.
- Deployed Edge Functions: `account-deletion` v1 (JWT verification on), `ai-coach` v9 (JWT verification on). No-auth and public-anon-key requests both returned **401** for both endpoints. A real signed-in client/SDK delivery remains unverified. Older clients lacking the AI consent-version field cannot send chat to the new handler; an updated app is required.
- Last live security advisor scan: only `auth_leaked_password_protection` remained. Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Private movement bucket and owner-prefix policies were inspected; actual media upload/download isolation needs signed-in test users.
- Privacy, support, and terms were published atomically to the existing GitHub Pages hosting branch only, preserving its unrelated files. Commit `5e5d315dea1b70bee743d741b44e567236811b41`; all three pages returned HTTP 200 with the new copy. Follow-up privacy-only commit `fd5a2895155a595b247f739f5b1f65bbdb58419d` discloses first-party operational counters and deletion receipts; Pages reported that commit built. This does not publish an iOS app or constitute attorney approval.
- GPS, HealthKit, native Watch/Live Activity, route-builder, strength-engine and root startup sources were not edited. The native subscription dependency still requires an actual archive/StoreKit test before any paid launch.

## Owner Handoff Prepared Last

- Supabase and RevenueCat are signed in. The owner confirmed RevenueCat email verification. RevenueCat's Apple connection form is waiting for the owner's private purchase key; the empty Pro entitlement is configured. No private key, password, OTP, or new binding agreement was entered by the assistant.
- Backend isolation is complete with the existing projects, not blocked on another paid project. Needed decisions/access: provider revocation and end-to-end deletion acceptance, RevenueCat/App Store keys and approved paid scope, optional paid security settings, independent-review budget, and eventual public-release approval. Credentials belong in the relevant vendor UI/secret store, never in chat.
- No public App Store release or new TestFlight submission was performed in this request. The unresolved public-launch gates above remain deliberately open.

## Pricing Proposal, Not Configured Products

Free recording/calendar/history; proposed Pro $9.99/month or $79.99/year, with a seven-day trial only after eligibility and renewal disclosure are correctly configured and tested. Validate included features, real AI/storage/support costs and willingness to pay before activating billing. Do not promise unlimited expensive analysis or a lifetime service. An annual plan is a recurring service obligation, not immediate profit.
