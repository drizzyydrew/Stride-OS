# Password reset after closing StrideOS — build 111 fix

## Report and scope

The owner reported the first reset worked. After requesting another reset and
closing the app, the email opened StrideOS but stayed on **Finishing sign in…**.
Two screenshots establish the OS handoff and stuck callback screen. Email inbox
delivery, sender and TLS remain accepted separately. The repeated cold-start
recovery flow is **not accepted**, and build 109 is not corrected by changing
SMTP settings. No raw reset link, private password or account data was retrieved.

## Confirmed defects and correction

- Router search parameters can omit the email's token fragment. Remember the
  actual OS-delivered callback and preserve it across cold launches. A later live
  reset wins over the original launch URL; identifiable current route credentials
  win over a different old initial URL. Raw URLs remain process-memory-only.
- Root and callback previously exchanged the same one-use link and navigated
  independently. Root now captures transport only. Callback and Google sign-in
  share one bounded auth operation with explicit owner acceptance.
- Password recovery previously awaited cloud history restoration and could spin
  indefinitely. Cloud restore remains owner-fenced background work. The UI has a
  20-second failure/escape path, tied to coordinator cancellation. Missing,
  expired, foreign or already-used links cannot become ambient-session success.
- NavigationGate now preserves callback/new-password during session/onboarding
  transitions. Successful SDK recovery metadata selects the reset form.
- Credential writes remain serialized until their original SDK operation drains.
  Acceptance-time cancellation waits for durable logout fencing and scoped
  credential cleanup; failures surface a storage error. Newer credentials are
  preserved. Stale restore failures cannot revoke newer access.
- Password submission is bound to the verified recovery user/attempt, checks SDK
  identity before and after update, and is invalidated by logout/new sign-in.
  No retained history, owner association or unrelated backend was deleted.

The exact cause on the owner's iPhone is inferred from these confirmed defects;
source checks are not a physical-device reproduction or acceptance result.

## Review and verification

Two independent automated code reviewers examined platform behavior and contrarian/data
custody risks, cross-examined findings, and reviewed revisions. Final security
verdict: **proceed with scoped source; no P1 remains in reviewed paths**. No claim
of whole-app security or device reliability follows from that verdict.

- Focused callback/coordinator/credential tests: 42/42 passed before the final
  full regression. Includes real component behavior and real ownership/storage
  adapter with synthetic storage and SDK I/O, not customer identities.
- Final serial regression: **1,623/1,623 passed**, zero failures/skips/cancellations.
  Semantic TypeScript and Expo compatibility passed. Signed archive/cloud/Apple
  results remain separate and are recorded in the build receipt as they finish.
- Existing generated iOS metadata was stale at build 108. Its 336 KB directory
  was backed up under `/tmp/strideos-ios-before-reset111-20261102215811`, then
  regenerated with clean prebuild/no install. Native Watch/Live Activity source
  is unchanged by this fix; target build numbers follow app build 111.
- Existing Expo Starter page showed $12 / $45 of included build usage. The next
  medium build is within that observed allowance. No plan/add-on purchase.

## Delivery and release

Build **111**, production profile, client payments explicitly off. Private billing
QA build 110 remains separate. Public draft was previously 109/manual release;
do not submit it as though this fix were installed. Build 111 is built, signed-archive inspected, uploaded, and confirmed
**VALID / IN_BETA_TESTING** in the existing owner-only group. See
`BUILD111_RELEASE.md` and the artifact/Apple receipts. Device acceptance remains
separate and pending.
No App Review/public release, signup reopening, subscription activation or
account deletion is performed by this change.

## Owner retest result

The owner reports the corrected build 111 reset worked in response to the
requested closed-app retest. This closes the reported stuck-callback incident
on owner evidence. The full device suite, signup confirmation and all recovery
edge cases are not implied. See the dated reset entry in
`BUILD111_APPLE_ACCEPTANCE.json`.

## Additional device acceptance

1. Install the corrected internal TestFlight build once confirmed available.
2. Request a reset for a dedicated account; close StrideOS before opening the
   newest email. Verify new-password screen, private save and new-password login.
3. Request a second reset and repeat. Verify an old/used link fails safely.
4. Repeat while the app is warm and with interrupted connectivity: no indefinite
   spinner, no duplicate navigation, history preserved, failure exit usable.
5. If the Apple review account's password changes, the owner updates App Review
   Information privately before review. Keep passwords and reset links out of chat.
