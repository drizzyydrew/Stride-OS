# Rome Recovery Build 95 Release

Status: preparing 1.0.0 (95), explicitly authorized October 20, 2026.

## Candidate

- Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`
- Branch: `build-19-v3-foundation`; starting HEAD `9374f43`
- App: `com.mooremovement.strideos`, version 1.0.0 (95)
- EAS project: `f32ed63a-a22a-4360-8b1d-3ed4d2c329d9`
- App Store Connect app: `6782788130`
- Preserve production build/submission profiles, local versioning and existing signing.
- Scope and prior review: [Rome half marathon recovery](ROME_HALF_ACTIVITY_RECOVERY_2026_10_19.md).

## Release Gates

- Clean iOS prebuild passed; generated host plist, Watch and Live Activity targets are build 95.
- Fresh post-bump serial suite passed 998/998 tests, zero failures/skips, in 114.1 seconds. The unchanged native Swift deadline probe passed as part of that run.
- Runtime source is unchanged from the previously verified October 19 Hermes export (10 MB bundle, 119 assets). Today's edits add release metadata/documentation only.
- Final TypeScript 5.9.3 semantic typecheck passed, exit 0. Commit/push, signed artifact, submission and Apple state remain pending.
- Both independent Data Custody and Contrarian/UI release reviewers inspected the current diff and exchanged strongest objections. They found no remaining source blocker; actual Rome data and restart/device evidence constrain recovery claims, not this bounded beta distribution.
- Protected native Watch/bridge sources and package/lockfiles are unchanged. `git diff --check` passed.
- EAS latest build is 94. Apple's pre-release status read returned a server-side internal error; retry the supported readback after build/submission rather than treating it as proof of availability.

Local logs: `/tmp/strideos-build95-prebuild.log`, `/tmp/strideos-build95-tests.log`, `/tmp/strideos-build95-typecheck.log`.

Do not claim that submitting the fix recovers the user's actual race. Device data and specific tester access remain unverified. No public App Store release, expanded invitations or new tester groups are authorized by this beta request.
