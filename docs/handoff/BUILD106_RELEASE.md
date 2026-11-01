# Build 106 runtime candidate

November 1, 2026 UTC. Canonical source is
`/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local` on
`build-19-v3-foundation`. This candidate follows the owner's standing approval
for launch engineering and TestFlight, with public release and new paid plans
outside scope.

## Why another candidate

Build 105 compiled and its actual IPA passed signature/entitlement/target/icon
checks, but fresh cloud Doctor identified Expo 56's Hermes memory regression.
The app imports Reanimated/Worklets, matching the upstream affected conditions.
Independent platform and contrarian reviews preferred the supported SDK 57 fix
over an unsupported engine override. Build 105 remains an exact preserved
baseline, with no Apple submission or public promotion. See `BUILD105_RELEASE.md`
and `SDK57_RUNTIME_REVIEW.md`.

## Bounded migration

- Installed exact Expo **57.0.31**, React Native **0.86.3**, Reanimated **4.5.1**
  and Worklets **0.10.1** through Expo's version alignment. Purchases remains
  **10.16.0** and the Babel/Zod/XML/URI safeguards remain. Removed the incompatible
  global SDK 56 config-plugins override so SDK 57 resolves its supported family.
- A clean lockfile install succeeded in an isolated worktree. Dependencies and
  generated native files were then promoted to the canonical checkout, preserving
  the SDK 56 versions outside it. No original source or customer data was deleted.
- Pinned the documented SDK 57 image `macos-tahoe-26.5-xcode-26.6`. No scene
  lifecycle, custom Hermes build or experimental Worklets mode was introduced.
- Added the SDK-required Font/SecureStore/StatusBar plugins. SecureStore's unused
  Face ID description is explicitly disabled; no authentication/storage option
  requiring biometrics was added.
- Refactored dynamic config to the official root-return pattern. Full and public
  resolved JSON were exactly equal before/after under default and synthetic
  environments on the same SDK; the unused-static-config marker clears.
- Adapted the dependency regression tests to the actual new Metro parser and
  nested consumers, retaining bounded malformed-input tests and patched parser
  lock/installed-version verification. Ten focused tests pass; no skip or fake
  dependency replaces a removed upstream package.

Migration commit `fcfa53b` merged into the canonical branch as
`69480ab95545b4e27a2c3f6c39796c95de7f45f8`. These are source-preparation
identities; the final build source is recorded below when queued.

## Generated-native and local evidence

- Independently parsed both PBX projects. All three targets and six Debug/Release
  configurations retain their bundle identifiers, product types, host-to-Watch/
  Live Activity dependencies, entitlement/plist paths, deployment minimums,
  device families and Swift setting.
- AppDelegate, Podfile/properties and launch scheme are identical. Host, Watch
  and Live Activity entitlements are identical; Watch/widget plists are identical.
  The final host plist differs only in build **105 → 106**, after removing the
  unused Face ID declaration. No application, Watch handshake or Swift source
  was changed by the migration.
- The independent review gives **96/100 scoped source/generated-native readiness**,
  not a measured reliability probability or device acceptance. Native compilation
  and signed archive inspection remain separate gates.
- Canonical semantic TypeScript and Expo dependency checks passed. Local Doctor
  is **20/21**: the sole remaining failure is this Mac's Xcode 16.4 versus the
  required 26.4 or newer. The cloud profile explicitly uses 26.6. The Hermes and
  dynamic-config warnings clear; no check was disabled.
- Fresh audit: **16 findings, 15 moderate and one low; zero high/critical**.
  This is an inventory result, not independent security clearance.

Full serial regression, final iOS export, exact cloud source/build, signed IPA,
fixed linked runtime, source-map upload and TestFlight/Apple processing are
recorded only when actually verified. Payments and automatic deletion remain
off/default pending their intended-user acceptance. Physical memory, recording,
Watch, Health recovery, cleanup/restart and StoreKit lifecycle tests remain
unperformed by this preparation record. No public readiness is claimed.

## Final local gate

Canonical full serial suite: **1,412/1,412 passed**, no failures/skips, 172.3 seconds
(`/tmp/strideos-build106-tests.log`). Semantic TypeScript, Expo compatibility and
the final clean-cache iOS Hermes export passed. No compiler timeout or test
assertion was weakened. Final iOS bundle is about 15 MB.

Fresh account-portal readback before queuing: existing Starter plan, **$4 used
of $45 included build credit**. No plan/add-on change was selected; the candidate
uses the existing allowance. The production client billing flag remains false.
