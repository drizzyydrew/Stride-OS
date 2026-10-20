# Rome Recovery Build 95 Release

Status: 1.0.0 (95) submitted and verified VALID / IN_BETA_TESTING on October 20, 2026. Explicitly authorized by the user the same day.

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
- Final TypeScript 5.9.3 semantic typecheck passed, exit 0. The release results below complete the source, artifact and Apple gates; actual device/race recovery remains unverified.
- Both independent Data Custody and Contrarian/UI release reviewers inspected the current diff and exchanged strongest objections. They found no remaining source blocker; actual Rome data and restart/device evidence constrain recovery claims, not this bounded beta distribution.
- Protected native Watch/bridge sources and package/lockfiles are unchanged. `git diff --check` passed.
- Before selecting 95, EAS latest build was 94. Apple's initial status read returned an internal server error; a later supported retry succeeded and confirmed 94 was the latest Apple build. Final Apple readback below succeeded for 95.

Local logs: `/tmp/strideos-build95-prebuild.log`, `/tmp/strideos-build95-tests.log`, `/tmp/strideos-build95-typecheck.log`.

## Verified Release

- Exact binary source commit: `195f44a2c99be09b30f4f7067cf580b3195e66eb`, committed and pushed to `build-19-v3-foundation` before the build. The tree was clean when uploaded.
- EAS build: [`25e0cbba-78b9-4cbd-86d1-1e5ff20e9910`](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/builds/25e0cbba-78b9-4cbd-86d1-1e5ff20e9910), production STORE/IOS, FINISHED at 12:58:02 UTC October 20, matching source commit and 1.0.0 (95). The 117 MB archive uploaded successfully in 8m22s.
- IPA: `/tmp/strideos-build95.ipa`, 140,399,585 bytes; ZIP integrity passed. SHA-256: `3bceb447d09438b2ace9a1c2e692f4fea103c11d5685359eca3a42e053c48ebf`.
- Embedded IPA plists: host `com.mooremovement.strideos`, Watch `com.mooremovement.strideos.watch`, and Live Activity `com.mooremovement.strideos.liveactivity` are each 1.0.0 (95).
- Submission: [`ca9fa8c5-8811-4f18-9d6f-2b8f71565194`](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/submissions/ca9fa8c5-8811-4f18-9d6f-2b8f71565194), FINISHED at 13:03:05 UTC October 20, exact EAS build ID submitted with automatic TestFlight setup disabled.
- Supported Apple readback: app `6782788130`, version 1.0.0, build 95, processing `VALID`, internal `IN_BETA_TESTING`, external `READY_FOR_BETA_SUBMISSION`, expired false, matching EAS build/submission IDs.
- No new invitations/groups, external beta review request or public App Store release performed. A particular tester's device/account access has not been independently verified.

Local readback: `/tmp/strideos-build95-view.json`, `/tmp/strideos-build95-submission.json`, `/tmp/strideos-build95-apple-status.json`; submission log `/tmp/strideos-build95-submit.log`. Raw CLI responses with temporary artifact/log URLs remain local.

## Device Acceptance

1. Update through TestFlight > StrideOS to 1.0.0 (95), without uninstalling the app or switching accounts.
2. Open the affected race link or its Activity entry. Exact supported aliases now resolve directly. If unavailable, tap Restore saved recording and confirm restoration of the retained exact run.
3. Confirm the original duration, distance, route, timestamps and available heart-rate/sensor data. Restart StrideOS, reopen the same activity, and verify there is exactly one race.
4. If no exact saved run is available, keep the app installed. Check Apple Fitness/Health and the existing Health restoration option rather than inventing replacement GPS or claiming the race was recovered.

Do not claim that submitting the fix recovers the user's actual race. Device data and specific tester access remain unverified. No public App Store release, expanded invitations or new tester groups are authorized by this beta request.
