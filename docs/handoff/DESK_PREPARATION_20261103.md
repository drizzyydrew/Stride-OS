# Launch preparation without the owner's app

November 3, 2026. Technical preparation can continue while the owner defers
physical app tests. This checkpoint does not accept the public launch.

## Completed this session

- Saved **Confirm email = on** in the isolated StrideOS Supabase project and
  verified it after a full dashboard reload. **Allow new users to sign up stays
  off**. Manual linking and anonymous sign-in remain off; Email, Apple and Google
  providers remain enabled. No account was created and no email was sent.
- Read-only aggregate checks before and after showed three users, all with a
  non-null email-confirmation timestamp, with zero unconfirmed users. Those
  timestamps are not independent mailbox-ownership evidence for older accounts.
- Verified the native callback `strideos://auth/callback` is on the redirect
  allowlist; current signup and resend code use the shared callback generator.
  The stored confirmation template uses Supabase's ConfirmationURL. No redirect
  or template change was required. End-to-end signup acceptance remains open.
- Ran 37 existing authentication callback/ownership/navigation tests, all passing.
  These cover source behavior with synthetic inputs, not inbox or device proof.
- Audited nine local screenshot originals. All four build-107 originals match
  their recorded hashes, sizes and dimensions. Three were previously reviewed
  for draft placement; the manual activity-detail image remains held for its
  misleading completion label. Five older images have unverified current UI and
  provenance. No build-111 or Watch original was found in this screenshot folder.
  `supportsTablet` is false. No image or Apple placement was changed.
- Compared native source: HEAD bff834b and the build-111 source dc318bf have no
  app/src/components/constants differences. The three historically placed screen
  routes are unchanged since the build-107 capture, but shared code, authentication
  and some other screens changed. This supports targeted review; it does not
  relabel build-107 captures as build 111 or accept physical behavior.
- Prepared a one-file build-number patch from reset-fixed bff834b for the next
  private billing QA source. `git apply --check` passed. Proposed 112 is only a
  placeholder until current EAS/Apple history is checked; it is not reserved.
  The existing billing-qa profile inherits production, is store-only and turns
  on only the client purchase flag. Canonical production stays billing-off/111.
  Ran 34 billing/server/observability guard tests, all passing. No new binary,
  upload, QA owner binding, purchase or public payment activation occurred.

## One useful laptop-only owner action

Apple's Sandbox page currently has no test accounts. The signed-in browser is
left at **Users and Access → Sandbox → New Tester**, with the fictional name
StrideOS QA and United States selected. Email/password fields are blank and
Create remains disabled. The form has not been submitted.

Owner can finish this without opening StrideOS:

1. Enter a dedicated email not already used as an Apple Account. A supported
   plus-address can avoid creating a separate mailbox; choose it privately.
2. Enter and confirm a unique password, save it privately, and select Create.
3. Complete any Apple verification privately. Report only whether the sandbox
   tester appears in the list; never send its password or verification code.

New credential entry and submission must be completed by the owner under the
browser security rules. If the browser form is lost, reopen
[Sandbox test accounts](https://appstoreconnect.apple.com/access/users/sandbox).
No ordinary Apple Account, purchase or new paid service is needed for this step.

This account will support the later retry/grace and renewal-control tests;
[Apple's TestFlight guidance](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/)
explains that ordinary TestFlight purchases already use sandbox, while those
additional scenarios use a Sandbox Apple Account. Do not change device account
sign-ins or start purchase tests until the current QA binary and exact server
test-owner binding are verified.

## Prepared continuation and remaining dependencies

The QA source patch is
`/Users/drew/Documents/StrideOS Launch Review/BILLING_QA_NEXT_BUILD.patch`.
Its receipt is `BILLING_QA_NEXT_PREPARATION_20261103.json`. Before building,
verify unused numbering and existing allowance, prepare an isolated source
checkout, inspect resolved configuration, and use the explicit billing-qa
profile. Keep this separate from the normal internal/public candidate. Archive
inspection and Apple availability follow the build; this patch is not an
installable artifact and is not a substitute for those checks.

For the controlled email-confirmation session, keep confirmation on. Do not
turn signup on unattended or substitute an admin-confirmed/invited identity
for a real signup-confirmation test. Before allowing a new registration,
agree its precise identity and bounded registration scope. Verify no password
session before confirmation, inbox delivery, cold/warm native return, correct
account, restart persistence, expired/reused-link behavior, and closure of the
registration gate after testing. Keep actual passwords and links private.

Phone/Watch recording, Health, offline/save/restart behavior, real provider
deletion and purchase prompts still need their separate owner sessions.
Support custody/coverage/retention and name clearance remain unresolved owner
or qualified-review decisions; this document does not invent a policy or hire
anyone. Completed domain, SMTP, Apple business and key setup need no repetition.

## Evidence

- `AUTH_CONFIRMATION_PREPARATION_20261103.json` — the saved flag and scoped checks.
- `STORE_ASSET_INVENTORY_20261103.json` — per-file hashes and use restrictions.
- `BILLING_QA_NEXT_PREPARATION_20261103.json` — source/configuration preparation.
- Private browser proof images are in Documents/StrideOS Launch Review, outside
  Git. No credential or financial record is part of the source package.
