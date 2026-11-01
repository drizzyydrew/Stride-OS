# SDK 57 runtime review and migration boundary

Review: November 1, 2026 UTC / October 31, 2026 Pacific.
Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.
Inspected baseline: `04158fc924692611e6f4bbef4b4ff9128f96ed2b`.

This is the independent Contrarian contribution to the parent's council. It
records primary facts and the owner's accepted engineering direction. It does
not clear a new startup path, Watch integration, native binary, device behavior,
TestFlight submission, or public release. This sidecar changed only this file.

## Decision and authorization

- Prefer the supported, matched SDK 57.0.31 set as the remediation candidate for
  the SDK 56 Hermes/Worklets memory regression. The owner accepted this direction;
  Halley and Carver agree, per their assessments supplied through the parent.
  The Chair accepted isolated source preparation with final regression,
  generated-target comparison and native archive gates before a 106 internal beta.
- Proceed with reversible migration and investigation in the parent's isolated
  worktree. The explicit authorization to do the work covers this engineering;
  another owner confirmation is not needed merely because package/native files
  will change in that isolated checkout. Parent bootstrap started with npm
  lifecycle scripts disabled; no successful migration is claimed from bootstrap.
- Preserve Build 105 and its exact SDK 56 source/artifact as the baseline. Hold
  public promotion. Prefer submitting only a qualified fixed Build 106 rather
  than automatically creating two successive internal betas. A Build 105
  TestFlight upload is not required merely to preserve its baseline value.
- Do not change paid plans, purchase credits/services, enable billing, alter
  customer/backend data, or publish/release as a consequence of this decision.
  The earlier EAS Starter 45-credit/0-used receipt is historical availability,
  not a reserved future balance; check the current allowance before another
  authorized cloud build. No new purchase is authorized by this document.

No permission blocker to isolated engineering was identified. A demonstrated
technical incompatibility can pause promotion while engineering investigates;
Carver's completed assessment supports reversible preparation. Discovery of
unavoidable new cost, destructive owner-data
operations, or public-release scope would cross the existing authorization.

## Primary facts and baseline exposure

The baseline declares Expo `~56.0.24`, React Native `0.85.3`, Reanimated `4.3.1`
and Worklets `0.8.3`, with Hermes configured. Actual app imports include
`src/navigation/TabIcon.tsx`, `src/layout/AppHeader.tsx`,
`src/layout/FloatingActionButton.tsx`,
`src/components/achievements/AchievementUnlockModal.tsx` and
`src/components/ui/RecoverableModal.tsx`.

The parent reports cloud Expo Doctor **20/22** and Hermes
`250829098.0.10`. These are reported cloud observations; this sidecar did not
independently extract the completed Build 105 binary. A local legacy Hermes
version file, a clean export, or a JavaScript test result cannot establish the
engine actually embedded in an IPA.

| Primary evidence | Consequence |
| --- | --- |
| [Expo maintainer's affected-version and no-backport explanation](https://github.com/expo/expo/issues/46519) identifies Hermes `.15` and earlier, including apps that merely import Worklets/Reanimated; no SDK 56/RN 0.85 backport | The reported `.10` baseline is within the affected range. This is a credible runtime risk, not proof that StrideOS has already lost a workout or crashed |
| [SDK 57 release notes](https://expo.dev/changelog/sdk-57#known-regressions) place the memory fix at Expo 57.0.9/RN 0.86.2, and the additional development-startup fix at 57.0.17/RN 0.86.3 | Do not conflate development startup delay with the production memory problem, or assume every SDK 57 patch is fixed |
| The same release notes describe Worklets Bundle Mode as unsupported/experimental for production | Do not substitute that workaround for a supported release qualification |

Risk inference: extra or growing memory consumption can reduce headroom for
long-running tracking, camera/media work and background transitions, increasing
the chance of OS termination. The magnitude and resulting user impact in
StrideOS are unmeasured. The previous 1,412 passing tests, native prebuild,
Hermes export and isolated Swift tests do not measure this release-device risk.

## Independently checked target contract

Read-only npm metadata confirmed that Expo **57.0.31** is published. This sidecar
read `package/bundledNativeModules.json` directly from the
[exact published package archive](https://registry.npmjs.org/expo/-/expo-57.0.31.tgz)
in memory, without installing it or running package scripts:

| Package | SDK 57.0.31 manifest entry |
| --- | --- |
| React | `19.2.3` |
| React Native | `0.86.3` |
| Reanimated | `4.5.1` |
| Worklets | `0.10.1` |
| Gesture Handler | `~2.32.0` |
| `@expo/ui` | `~57.0.26` |
| React Native Skia | `2.6.2` |
| Sentry React Native | `~7.11.0` |

This verifies the package's intended set, not successful resolution, installation,
native linkage, embedded Hermes version, or compatibility of every StrideOS
native module. Use [SDK 57 versioned documentation](https://docs.expo.dev/versions/v57.0.0/)
and preserve a reviewable lockfile; do not mix a standalone newer RN/Hermes with
the SDK 56 native set and call it the supported SDK 57 fix.

## Carver platform cross-examination: assessment received

The parent supplied Carver's assessment: proceed with the SDK 57.0.31 matched
set, remove the incompatible SDK 56 config-plugin override, preserve Purchases
and security overrides, use the recommended SDK 57/Xcode 26.6 image without a
scene-lifecycle change, and require actual native/device evidence for the
HealthKit, Mapbox, Skia, BLE/Nitro and Watch countercases. This supersedes the
earlier pending-assessment note. No native execution pass is implied.

1. **Override objection resolved for preparation.** The canonical manifest forces
   `@expo/config-plugins: 56.0.9`; read-only npm metadata for Expo 57.0.31 declares
   `@expo/config-plugins: ~57.0.11`. The inspected `100806e` manifest contains the
   old override, but neither that manifest nor its commit message supplies a
   separate reason to retain it under SDK 57. Absence of a documented reason is
   not proof of complete historical intent; the direct target-version conflict
   is the positive reason to remove this specific override in isolation. Confirm
   the resolved plugin set and actual generated output. Do not remove unrelated
   security overrides or change `react-native-purchases: 10.16.0` by association;
   preserving its pin does not itself prove compatibility with RN 0.86.3.
2. **Toolchain objection resolved conditionally.** Expo's current
   [image table](https://docs.expo.dev/build-reference/infrastructure/)
   maps `sdk-57` to `macos-tahoe-26.5-xcode-26.6` (Xcode 26.6, 17F113).
   That supports Carver's choice and gives no reason to introduce scene support
   solely for this migration. Record the actual image from the next EAS log;
   aliases can move. Selecting Xcode 27/iOS 27 instead would reopen the explicit
   SDK 57 scene-lifecycle requirement. No unnecessary image or scene change is
   approved by this assessment.
3. **Strongest objection remains native integration.** A supported RN/Hermes set
   and successful JavaScript/TypeScript checks cannot establish C++/Swift linkage,
   runtime initialization, capability retention or extension embedding across
   HealthKit, Mapbox, Skia, BLE/Nitro, WatchConnectivity, Live Activity and pose
   modules. This is a material qualification gap, not a demonstrated vendor
   incompatibility and not an owner-approval blocker for source preparation.
   Compare generated phone/Watch/extension targets, entitlements, bundle IDs,
   deployment targets and background modes, then require a real EAS native
   compile/archive. Preserve custom targets through supported plugins or reviewed
   native changes; regenerate only in isolation.
4. **Startup clearance remains withheld.** Actual device evidence is still needed
   for initialization, deletion fencing, ownership/hydration, Watch handoff,
   tracking and memory behavior. The read-only council and prior isolated Swift
   tests do not clear the new startup path. A real native failure can stop the
   candidate; a hypothetical failure cannot justify silently staying on the
   affected runtime or demanding another owner confirmation for reversible work.

Final preparation decision: **proceed now in isolation**, within the owner's
existing reversible-engineering authorization. Final regression, generated-target
comparison and native archive verification gate the first fixed **106 internal
beta**. That controlled candidate enables the remaining device qualification;
neither its compile nor its internal distribution is public-promotion or native
startup acceptance. Preserve 105 as the baseline and avoid an automatic second
beta upload solely to circulate that baseline.

## Qualification before promoting the fixed candidate

- Resolve both reported Doctor findings individually. Preserve the complete
  diagnostic text; do not equate a score alone with runtime acceptance.
- In isolation, verify the resolved dependency/peer set, clean install, semantic
  checks and relevant regression suite, generated phone/Watch/extension projects,
  and release Hermes export. Preserve unrelated features and data-store contracts.
- Verify an actual native archive with the fixed RN/Hermes artifacts and intended
  target/toolchain settings. A source dependency bump is not proof the archived
  engine changed; an OTA JavaScript update cannot replace this native runtime.
- Qualify release-mode memory and startup on suitable devices: repeated navigation,
  media use, prolonged tracking, background/foreground transitions, save/recovery,
  HealthKit and Watch handoff. Inspect sustained growth, peak/headroom, memory
  pressure and OS terminations. Set the acceptance criteria before comparing
  results; do not invent a universal safe RAM limit.
- Retain all owner data. Native installs can replace an existing app/container;
  use an existing dedicated test environment and disposable fixture accounts.
  Do not clear the original owner's stores, credentials or media to make a
  migration test pass. Installation/data-migration actions need their own scope
  review even though isolated source engineering is already authorized.
- Before a fixed **Build 106** internal candidate, complete the Chair's final
  regression, generated-target comparison and actual native archive gates.
  Preserve source/build identities and report compiled, uploaded, processed,
  installed and device-accepted states separately. Device/memory and fresh startup
  acceptance still gate public promotion; billing/StoreKit acceptance and legal
  clearance remain separate decisions.

## What would change the decision

An authoritative supported SDK 56 backport or proof that the actual baseline
binary avoids the affected engine/import path could change the migration
preference. A demonstrated critical SDK 57 native incompatibility could pause
that migration while it is resolved; it would not automatically authorize public
promotion of Build 105. Strong release-device evidence of bounded, stable memory
and reliable critical journeys could change the assessed baseline release risk;
one short simulator run or absence of observed crashes would not.

## Scope and receipt

This pass inspected existing source/configuration, official Expo guidance, npm
metadata and an in-memory published-package manifest. It did not run the
migration, edit dependencies/native/startup code, create or change a worktree,
run package scripts, initiate a build/submission, deploy, change billing/plans,
or access/delete owner records. No new native or device pass is claimed.
