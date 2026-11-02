# Owner launch steps — November 2, 2026

**New native candidate: 109; signed archive verified, VALID and available in
internal TestFlight.** The saved App Store draft also selects 109 with manual
release; it has not been submitted for public review. Source, backend deployment and
scoped checks are complete. The final installed binary and device acceptance
must be matched before submission. Prior builds do not establish these results.
Financial, reviewer-account and medical setup are already complete; leave them
alone. SDK 57 and the accepted bounded build-tool dependency scope stay in place.

- **Before public launch — verify AI spending control:** Owner must verify the
  Anthropic spending limit or enforced vendor hard cap covering the actual server
  credential, including its scope/reset period and whether it stops usage rather
  than only alerting. Source limits are 20 request reservations/account/UTC day,
  500 globally/UTC day and `max_tokens: 1024` output tokens/request; these do not
  establish a dollar budget. Vendor enforcement remains unverified. No budget
  amount or configuration is prescribed.

## 1. Verify Sign in with Apple credentials privately

**Key setup completed in the subsequent owner session.** The owner registered
and downloaded **StrideOS Sign In Key**, ID `RZ49DF832J`, scoped only to primary
`QBAVJD9497.com.mooremovement.strideos`. Main matched the downloaded filename to
Apple's Downloaded confirmation, verified PKCS8/P-256 format and a local signature,
then installed the two missing values only in StrideOS server secrets. All four
setting digests matched fresh server metadata. The key remains outside both
checkouts, with file mode 0600 and containing folder mode 0700. No key contents
were printed, committed or uploaded with the app. Bet Desk's key was untouched.
The numbered creation instructions below are retained as reference; do not create
another key. Real Apple exchange and revocation acceptance remain pending.

1. In Apple Developer, select team **QBAVJD9497**. Under Certificates,
   Identifiers & Profiles → Identifiers, inspect App ID
   **com.mooremovement.strideos** and verify **Sign in with Apple is enabled**,
   with its primary/group association understood. Record the verification
   without changing unrelated capabilities. [Apple capability instructions](https://developer.apple.com/help/account/identifiers/enable-app-capabilities/)
2. Main verified the key list and prepared this separate StrideOS draft. In the
   prepared tab, review the scope, click **Register**, then **Download**, and save
   the `.p8` privately. Tell main that it is saved; keep its contents out of chat.
   The Bet Desk key remains unchanged. A **Sign in with Apple key is distinct
   from the RevenueCat/App Store Connect `.p8` credential**. The prepared key will
   be used only by the StrideOS Supabase server for Apple authorization and
   account-deletion disconnection.
   [Apple Sign in with Apple key documentation](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key/)
3. Once the matching key is verified and main confirms deployment readiness,
   provide the missing key material through the existing **server secret storage**, not
   chat, source control, screenshots, logs, app config or `EXPO_PUBLIC_*`:

| Server variable | Value/source |
| --- | --- |
| `STRIDEOS_APPLE_PRIVATE_KEY` | **Saved and digest-verified:** matching private `.p8`; never print contents |
| `STRIDEOS_APPLE_KEY_ID` | **Saved and digest-verified:** `RZ49DF832J` from Apple's registered key |
| `STRIDEOS_APPLE_TEAM_ID` | **Saved and read back by main:** `QBAVJD9497` |
| `STRIDEOS_APPLE_CLIENT_ID` | **Saved and read back by main:** `com.mooremovement.strideos` |

Main verified the native bundle identifier, team and Sign in with Apple
entitlement against the signed 108 archive before saving the two non-secret
settings. The key ID and private key were subsequently installed using the
official CLI and a private temporary environment file, removed after upload.
Fresh authenticated account-deletion GET now reports `appleCodeExchange:true`;
all seven endpoint boundary checks, reviewer authentication and the signup guard
still pass. Secret presence/capability reporting is not a successful Apple exchange.
[Supabase server-secret instructions](https://supabase.com/docs/guides/functions/secrets)

## 2. Require email confirmation and verified delivery before reopening signup

- **Temporary restriction is active:** main reviewed `config diff`, then pushed
  only `auth.enable_signup=false`. Public Auth settings read back signup disabled,
  and existing reviewer authentication plus authenticated backend GETs passed.
  No accounts were removed; confirmation, SMTP, hooks and other defaults were
  unchanged by that operation.
- **Before eventual reopening:** intentionally require email confirmation
  (`mailer_autoconfirm=false`) and verify SMTP/Send Email Hook delivery plus app
  confirmation/recovery links. Confirm unverified password access is refused
  and same-email OAuth does not retain an unverified signup password, using only
  owner-approved disposable identities. This is a separate production-security
  acceptance step, not a confirmation toggle during the temporary restriction.
  [Supabase confirmation policy](https://supabase.com/docs/guides/auth/passwords#enabling-email-and-password-based-authentication),
  [automatic identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking#automatic-linking)
- Existing auto-confirmed accounts are **not retroactively mailbox-verified** by
  restricting signup or changing the future confirmation policy. Preserve their
  accounts and existing logins; any trust/remediation review is separately
  scoped. Do not mass-reset passwords, delete accounts or unlink identities.

- Main inspected the actual dashboard: custom SMTP is **off** and Auth Hooks has
  **no configured hook**. The SMTP setup page is left open. No sender service,
  domain or paid plan was added. An approved production sender setup is needed;
  live delivery/recovery remains **unverified**.
  The owner was asked whether an existing sender can be reused. A new provider
  has not been selected or connected. See `EMAIL_DELIVERY_OPTIONS_20261102.md`
  for the researched free-tier candidate and its limitations; it is not setup
  or delivery acceptance.
  Public Auth settings reported **auto-confirm true**; signup can succeed without
  sending a confirmation message. Do not toggle confirmation, CAPTCHA, rate
  limits or other safeguards to manufacture a passing check.
- An enabled Send Email Hook handles delivery instead of SMTP. Otherwise inspect
  custom SMTP and its sender settings. Supabase's default mail service is not
  intended for production delivery. Reuse an already approved service if one
  exists; do not buy or connect a new paid service without approval.
  [Email hook behavior](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook),
  [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- With main's agreed disposable test account and an owner-controlled inbox,
  request password recovery from the actual app. Confirm receipt, sender and
  inbox/spam placement; follow the link into the correct app recovery flow,
  change the disposable password, then sign in again. Test signup under the
  intended production confirmation policy; do not expect confirmation mail while
  auto-confirm remains enabled. API success alone is not delivery evidence.
  Keep passwords and recovery links private. Record pass/fail and time only.
  [Supabase mobile deep-link guidance](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)

## 3. Accept the final native candidate on real devices

After main records the exact candidate/build and backend revision, update rather
than erase the owner's retained-history installation. Record device/OS, build,
test date and pass/fail; keep health data and tokens out of the handoff.

| Remaining acceptance | Practical check |
| --- | --- |
| GPS | Record outdoors; lock/background and return; pause/resume/end; reopen the saved activity and check route/distance without duplicates. |
| Health | Check permission-denied/recovery behavior and intended workout association; confirm imported/saved history survives reopening. |
| Watch | Pair/connect; start/end the supported workout; verify phone/Watch synchronization and one durable completion. |
| Apple deletion | Use a confirmed disposable Apple-backed account after grant capture is deployed/configured. Verify retained-grant deletion and actual provider revocation; test fresh credential repair when needed. |
| Google deletion | Use a separate disposable Google-backed account. Verify actual provider handling, truthful pending/manual status, completion, local fencing/cleanup and restart recovery. |

Never run deletion acceptance on the owner's retained-history account. Pending
or manual provider disposition is not confirmed automatic revocation. Main must
verify backend completion and secure cleanup; do not copy tokens or deletion
receipts into chat. [Apple token-revocation procedure](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)

**Paid lifecycle remains deferred by the owner.** Do not activate billing or run
purchases from this checklist. Before any later paid activation, separately
accept purchase, restore, renewal, expiration, grace, refund/revocation and
failed-access-refresh behavior using the agreed sandbox scope. Deferred tests
must not be reported as passed.

Main closes the full-suite/backend issues, identifies the accepted candidate and
records the results above before proposing submission. This document does not
authorize App Review submission, public release, new keys or paid services.
These are operational verification steps, not legal advice.
