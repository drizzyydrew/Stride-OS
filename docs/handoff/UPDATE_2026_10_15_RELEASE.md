# October 15 TestFlight Candidate

## Identity

- Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.
- Branch: `build-19-v3-foundation`.
- Submitted source: `4701c4100f60211b79e9dd8a1b01c0ddbdd58d04`, pushed and clean
  before EAS archive creation. Later release-record edits are documentation only.
- App: `com.mooremovement.strideos`, version `1.0.0`, build `93`.
- EAS build: `69a14acd-52b2-4bd0-aba2-b4fba59f4d4a`.
- EAS submission: `3ca0317f-69ea-4050-9605-b96646a3375d`.
- [Build](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/builds/69a14acd-52b2-4bd0-aba2-b4fba59f4d4a).
- [Submission](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/submissions/3ca0317f-69ea-4050-9605-b96646a3375d).

## Source Gates

- Full suite: **907/907 pass, zero failures/skips**, exit 0.
- Application typecheck: exit 0.
- iOS Hermes production export: exit 0, 10MB bytecode bundle.
- Clean iOS prebuild: exit 0; package/lockfile unchanged.
- Seven changed native Swift files: syntax parse exit 0. This alone is not a
  native archive or device test.
- Actual production component browser inspection at desktop, 390x844 and
  320x740; no horizontal overflow, scrub/share/live controls checked.
- Final relevant council gates passed at least 95/100 after documented failed
  rounds and corrections. Independent P3 R3: 95/100, 96 focused tests and actual
  store failed-write/retry durability probe. Scores are bounded judgments, not
  measured probabilities of reliability.
- Expo dependency check recommends four newer SDK56 patch packages. Baseline
  pins retained; no unrelated upgrade. Prebuild also reports the existing
  optional `expo-system-ui` background-color warning.

## Release State

Final readback on October 16:

- EAS build **FINISHED** at `2026-10-15T07:28:20.904Z`; signed native store
  artifact produced from the exact source revision above, build93.
- Matching EAS submission **FINISHED**.
- App Store Connect build `1.0.0 (93)`: processing **VALID**, internal state
  **IN_BETA_TESTING**, external state **READY_FOR_BETA_SUBMISSION**, not expired.
  Apple readback matches both EAS build and submission IDs above.
- Native archive compilation/signing completed for the iPhone app and embedded
  Watch/Live Activity targets. Compiler deprecation/toolchain warnings remain;
  these are not represented as warning-free builds or device validation.

Internal beta state does not prove that every particular Apple ID has tester
access. No external beta review or public release was submitted. The user was
directed to install build93 and perform the physical-device acceptance checks.

No public App Store release or new external tester invitations were requested.
Physical iPhone/Watch validation remains outstanding; see
`UPDATE_2026_10_15_ACCEPTANCE.md` for the device checks and model/Health-write
boundaries. Offline basemap downloads and unsupported universal watts are not
claimed.
