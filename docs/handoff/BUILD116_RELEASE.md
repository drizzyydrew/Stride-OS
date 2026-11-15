# Build 116 — internal TestFlight delivery

**1.0.0 (116) is VALID / IN_BETA_TESTING** in the existing Team (Expo)
internal group with one installed tester. Apple processing, actual group assignment
and exact saved beta-note readback are verified. This establishes availability;
it does not establish native-device, purchase-lifecycle or public launch acceptance.

## Identity and destination

- Branch: `codex/launch-polish-20261115`.
- Built source: `f036de1d8b1eb6e3907f7ba23e4f21a15b188935`, pushed and verified on GitHub.
- [EAS build](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/builds/c24aa00d-e197-491a-a658-2c4f1269b997): `c24aa00d-e197-491a-a658-2c4f1269b997`, FINISHED, billing-qa store profile.
- [Signed IPA](https://expo.dev/artifacts/eas/g37tms3iD_OLgYSjJqeFQGti6qcDKAUy9NPoNpItqQw.ipa): 129,865,666 bytes, SHA-256 `96c06e026c89f814e5d6f13daf6337771a44e5a752d2161197b737970617b112`.
- [EAS submission](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/submissions/a97bbf08-3502-4624-9df3-9ccc12b0c308): `a97bbf08-3502-4624-9df3-9ccc12b0c308`, FINISHED.
- Apple build: `39c7404f-638a-4830-9221-46d71a932ede`.
- [TestFlight](https://appstoreconnect.apple.com/apps/6782788130/testflight/ios).
- Saved en-US What to Test: 1,939 characters, exact readback,
  SHA-256 `e39b5fc9d49e994856eb8441c3d7c25093b504fc3b5b29433b3017cc79120ba3`.

The existing pinned EAS CLI 23.2.0 built the source snapshot and submitted that
exact build ID using the existing production submit configuration. That submit
profile selects the Apple destination; it does not rebuild or change the QA IPA.
No new testers, external beta review or public App Review/release was requested.

## Included requested changes

Auto-pause is edited in Settings → Workout Intelligence, with the duplicate
Running controls removed. Time and Distance values and labels are centered side
by side when they fit, with readable centered stacking for large text/long values.
Profile now has one Settings card; duplicate demographics/photo/name editors are
removed from Settings. The same Profile page and Today shortcut are preserved.
Profile identity, calibration and availability stay within the Settings navigation
stack, with verified Back round trips and a cold Profile-root fallback.

Profile uses an actual optional birth date with Apple's native calendar and
height/weight wheels. Existing age is preserved until a date is chosen; no birthday
is fabricated. Opening/canceling or changing entry units does not silently overwrite
saved measurements. Metric/imperial entry is supported. Exact DOB remains local,
is excluded from automatic cloud/coaching payloads, and may be in OS backups.
Age-derived calibration detects stale birthday-dependent values while preserving
manual/test anchors. History measurements display at most two decimals without
changing saved precision or normal duration/pace formats.

Five compatible direct SDK 57 patch updates and thirteen transitive version
changes align the installed Expo packages. No SDK-major/Hermes switch was made.
Watch, HealthKit, GPS, recording/recovery and auto-pause policy source are unchanged;
the TaskManager patch still warrants a brief new-binary background/save check.

## Verification and practical limits

- Full integrated suite: **1,924 passed, zero failed/skipped**. Typecheck, Expo
  dependency check, diff check, final iOS module graph export and22 generated
  native version checks passed.
- Three council seats renewed favorable95/100 subjective bounded source reviews.
  This is not a native reliability probability or public release approval.
- Source/browser fixtures cover320/390 widths, large text, Profile fallback
  interactions and actual installed router transitions. They are not native UI
  passes or App Store screenshots.
- Cloud Doctor21/21; current-SDK phone/Watch/Live Activity archive compiled with
  zero errors and33 existing nonblocking warnings, detailed in the cloud receipt.
- All three116 target signatures/versions/store profiles, expected capabilities,
  webcredentials entitlement,21 privacy manifests, opaque1024px icon, callback
  scheme and final Hermes bundle were verified. All40 manifest files still match.
- Matching116 source-map upload was reported complete by the worker. Vendor
  event ingestion/native crash symbolication remain unverified; native capture
  remains disabled. No earlier crash is newly attributed by this delivery.

## Paid launch and next actions

This private candidate enables the purchase client. **Public server billing remains
off**, the normal production build profile remains billing-off, and no private QA
owner is bound. The current app email is pending owner confirmation so any server
QA is restricted to the correct account. Keep the usual StrideOS login/history;
Apple Sandbox payment identity is separate. Do not uninstall, reset or change app
accounts for the payment test.

Follow **BUILD116_OWNER_TEST_GUIDE.md** in order: update phone/Watch, inspect changed
Profile/Running/history paths, perform the six-active-minute background/offline-save
check, then execute the controlled real Sandbox purchase/client/server lifecycle.
Build115's owner-reported successes retain their original scope; no full20-minute
repeat is required without a regression. The guide includes result fields.

Fresh readbacks find public signup disabled with email confirmation required and
account deletion disabled with no scoped owners/active worker jobs. Complete a
controlled signup/native-return/reviewer pass and approved fresh disposable-account
deletion before public opening. Both first subscriptions remain MISSING_METADATA
with absent review screenshots; current large-iPhone store coverage is missing.
Genuine accepted-candidate images and final paid privacy/reviewer text are needed.
Store drafts are prepared in store-package-20261115/ and are not saved Apple metadata.

The USA monthly$9.99/annual$79.99 and one-week eligible trial match the prior approved
configuration. Sandbox testing does not require product App Review; missing review
screenshots still block submission. Do not assume a missing product is explained
solely by that status: capture the actual StoreKit/RevenueCat error and check the
[Apple Sandbox configuration guidance](https://developer.apple.com/documentation/technotes/tn3186-troubleshooting-in-app-purchases-availability-in-the-sandbox).

Public1.0 still selects109 / PREPARE_FOR_SUBMISSION / MANUAL. No public review or
release, purchases, data deletion, signup reopening, provider/DNS/custom-domain
purchase, new support promise or global server billing activation occurred here.
Google shared-project branding and working-name decisions remain as previously
recorded. After acceptance, reconcile the paid binary/app+first-subscription package
and obtain the public submission/manual-release decisions. Apple review/publication
controls the date; November16 public availability is not guaranteed.

Evidence: nov15-launch-polish/SOURCE_PREFLIGHT.json, PLATFORM_RELEASE_REVIEW.json,
AUTH_READBACK.json, SERVER_READBACK.json, PUBLIC_READBACK.json; BUILD116_CLOUD_VERIFICATION.json,
BUILD116_ARTIFACT_VERIFICATION.json, BUILD116_APPLE_ACCEPTANCE.json and BUILD116_DELIVERY.json.
