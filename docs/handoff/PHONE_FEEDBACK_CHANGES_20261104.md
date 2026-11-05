# Phone feedback implementation — November 4, 2026

Prepared in the canonical Developer checkout after the owner's partial build-111
checklist. These changes are not in the installed 111 artifact. No new EAS build,
TestFlight delivery, App Store submission or public app release was performed.

## Implemented source changes

- A cold relaunch retaining one running/outdoor activity offers Resume activity
  or Stop activity after authenticated owner verification, local hydration and
  pending Watch/Live Activity completion recovery. Resume opens the same controls
  and retains its current paused/running state. Stop uses the existing durable
  completion path. Runs under five active minutes need a second explicit warning
  before the existing short-recording discard policy can apply. Ordinary screen
  unlocks, new sessions, saved/ending sessions and wrong-owner callbacks do not
  create this prompt. Strength and indoor rides are outside this initial scope.
- Profile supports first name, last name and a separate display username, with
  independent visibility choices. Names, initials, settings/profile labels,
  dashboard greeting and new Coach context honor those choices. Existing compound
  names remain intact until explicitly edited. The username is a device-local
  display alias, not a unique/public account name or a new sign-in identifier.
  Saving awaits persistence, preserves drafts on failure and rechecks the owner
  and active athlete around asynchronous writes. No identity was added to share
  exports and no backend schema/public directory was created.
- Forgot password receives the entered sign-in email, trimmed and bounded,
  while retaining an editable destination field. No password travels in a route.
- Credential fields identify existing/new passwords and username context for
  iOS/Android system autofill. Successful reset offers Continue for the current
  authenticated owner without retyping the changed password. The Android-only
  native module commits the system autofill context after accepted success;
  it accepts no credential arguments. iOS ends editing using system field hints.
  The OS, selected password provider and settings control save/update UI.

## Apple association applied

The owner-controlled `strideosfitness.com` apex was not assigned to a Vercel
project. A minimal static association deployment now serves only public app
identity metadata in the existing Vercel account. The apex was assigned to that
project with verified ownership; no DNS record edit, email-service change, new
account, paid plan/add-on or credential rotation was performed.

Origin HTTPS and Apple's association CDN both returned 200 for
`QBAVJD9497.com.mooremovement.strideos`. Source Expo configuration and native
entitlement introspection match `webcredentials:strideosfitness.com`. This does
not accept a future signed provisioning profile or a device password prompt.
See `IOS_PASSWORD_AUTOFILL_ASSOCIATION_20261104.md` and the validation receipt.

## Validation and review

- Full suite with two workers: **1,673 / 1,673 pass**, no skipped/cancelled tests.
- Semantic TypeScript and Expo dependency compatibility pass.
- New focused coverage: 19 recovered-session scenarios, nine actual auth-screen
  scenarios, 17 identity/persistence scenarios and four credential-helper cases.
- Android autolinking discovers the new module. No Android SDK/toolchain was
  available locally, so Android native compilation and provider UI are unproven.
- Expo native introspection generates the associated-domains entitlement. No
  newly signed iOS binary or physical UI was tested for these changes.
- The initial broad run with default worker concurrency failed two local
  PostgreSQL initializations and one 30-second Swift execution deadline. The
  affected files then passed 56/56 in isolation; the final complete two-worker
  run passed 1,673/1,673. No unrelated production code or tests were weakened.

Council reviewers exchanged first passes and objections across data custody,
platform and contrarian seats, then reviewed the actual implementation. The
short-recording warning, private alert text, hydration race checks, account
guards and awaited profile saves address their consequential concerns. Their
bounded source regression-confidence judgment meets the historically reported
95/100 council gate after the final checks; this is subjective engineering
review, not a measured probability of phone/Watch reliability or launch approval.
The `watch-working-build90` reference was inspected. Existing later differences
were preserved; this change does not alter native Watch/GPS/completion code.

## Continue the owner's existing checklist

The owner clarified the reopened activity was still recording. That accepts
their reported active-session persistence only. Finished-save durability,
offline save/reconnect duplicates, plausible route/distance, Health and Watch
behavior remain untested in the submitted form. Use the original form rather
than asking for passing checks again.

Finish the current recording before another test. Once at least eight active
minutes have accumulated, stop and confirm Run saved. Reopen its completed
detail after closing the app to test finished-save durability. The separate
offline-save block can then complete the original blank fields.

Before delivering these corrections, allocate a new native build number above
the existing candidates, verify signed app/Watch/extension identities and the
main associated-domains entitlement, and coordinate installation around any
unfinished recording. Do not relabel existing 111 receipts, select private
QA112 as the normal release, or switch on signup, payments or general deletion.
Retest the new prompt, profile save/visibility and native password-manager flows
on that candidate; source checks do not replace these device results.
