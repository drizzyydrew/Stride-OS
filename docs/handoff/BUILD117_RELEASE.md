# Build 117 — cosmetic-only internal TestFlight delivery

**1.0.0 (117) is VALID / IN_BETA_TESTING** in the existing Team (Expo)
internal group with one installed tester. Actual group membership and exact saved
beta-note readback are verified. This is availability, not a device or launch pass.

## Identity

- Source: 194eb1708fe54e5731eabe65ab7b1b125c08cb82, committed/pushed on codex/launch-polish-20261115.
- [EAS build](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/builds/c4a2e44e-4f71-451c-aef6-dbb4fd58992b): FINISHED, billing-qa store profile.
- [Submission](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/submissions/545b10ad-6a16-483d-ac7f-2514aab77980): FINISHED.
- Apple build: 5389dc5a-6784-4b30-aa38-6cc5fc979d80.
- [TestFlight](https://appstoreconnect.apple.com/apps/6782788130/testflight/ios).
- [Signed IPA](https://expo.dev/artifacts/eas/6FjvlyjUdixlHI5jMRIpDKw32LbQPGa11AEBd2QMUyg.ipa): 129,902,329 bytes; SHA-256 d737a01109ef4e4ef014b23139e882b63e67a8ec9ea07ecc0416fc86f595ae78.
- Exact en-US beta notes: 1381 characters, SHA-256 4b34cd97136c029191c158c61d9e57d021f82925578babea9402aecd84725cc4.

## Chosen scope

The owner corrected the earlier report, attributing both symptoms to connectivity,
and explicitly chose logo/weight captions only. Both auth forms reuse the exact
existing three-chevron app icon at 64 points. Weight wheels hide only their visible
Hundreds/Tens/Ones captions; accessible labels, values, units, save/cancel and height
labels remain. Build numbers are 117 across phone, Watch and Live Activity.

All authentication, membership, navigation, dependency and release-profile files
checked against116 match byte for byte. The proposed reliability safeguards and
their new tests were preserved outside the checkout and are not included.

## Verification

Existing auth-input/picker checks 12/12 and native version/Watch-sync checks 22/22
passed, zero failures/skips. Canonical TypeScript, dependency alignment and diff
checks passed. The prior 1,924-test suite belongs to 116; no new full-suite run is
claimed for this cosmetic patch. Cloud Doctor 21/21 and the complete current-SDK
archive passed, with 0 compiler errors and 33 warnings.

All three strict/deep signatures, version/build numbers, unexpired store profiles,
expected team/app-group/HealthKit, signed webcredentials, callback, purpose strings,
privacy manifests, opaque 1024 icon and final Hermes bundle were verified. All
17 source-manifest files still match after archive creation.
Sentry worker reported the matching 117 source-map upload complete; native capture,
vendor event ingestion and native crash symbolication remain unverified.

## Next

Use BUILD117_OWNER_TEST_GUIDE.md. Update without uninstalling/resetting, keep the
usual account and history, and check the weight/height labels. There is no need to
sign out just to inspect the auth logo or repeat the whole recording checklist.

Apple showed the Monthly test purchase successful and the owner then reported
Your Pro subscription is active on 116. The owner also reported Pro active after relaunch plus Restore purchases.
Remaining lifecycle and authenticated server enforcement stay separate open gates. Do not repeatedly
Subscribe to test an existing entitlement. The temporary private server QA owner
was removed and absence verified; public server billing is off.

Fresh Apple public-version readback selects 109
/ PREPARE_FOR_SUBMISSION / MANUAL.
No public review/release, new testers, purchases, account deletion, signup reopening
or provider/DNS changes occurred as part of this delivery. Store/product captures,
paid privacy/reviewer/binary alignment and the remaining owner/device gates still
govern launch readiness.

Evidence: BUILD117_PREFLIGHT.json, BUILD117_CLOUD_VERIFICATION.json,
BUILD117_ARTIFACT_VERIFICATION.json, BUILD117_APPLE_ACCEPTANCE.json,
BUILD117_DELIVERY.json and BUILD116_SUBSCRIPTION_PLAN_READBACK_20261115.json.
