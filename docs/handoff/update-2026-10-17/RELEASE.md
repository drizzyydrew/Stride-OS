# October 18 TestFlight Release

Status: 1.0.0 (94) submitted successfully and verified in internal TestFlight testing on October 19. Explicitly authorized by the user on October 18, with continuation requested October 19.

## Identity

- Checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`
- Branch: `build-19-v3-foundation`
- Bundle: `com.mooremovement.strideos`
- EAS project: `f32ed63a-a22a-4360-8b1d-3ed4d2c329d9`
- App Store Connect app: `6782788130`
- Production build and submission profiles, local version source, existing credentials.
- Previous latest EAS/Apple build: 93, verified before selecting 94.

## Release Gates

The correction report and device checklist are in [README.md](README.md).
- Clean iOS prebuild passed; host plist, Watch and Live Activity versions are 94.
- Full post-bump suite passed 968/968, zero failures/skips, concurrency 2, run without concurrent typecheck/export. An initial run alongside those jobs timed out in the unchanged 30-second Swift deadline probe; the isolated full suite passed in 46.2 seconds. No assertion or timeout was weakened.
- Repository TypeScript 5.9.3 semantic check passed.
- iOS Hermes export passed: 10 MB bundle, 119 assets.
- `git diff --check` passed; package/lockfiles and protected Watch/native transport/bridge sources unchanged.
- Independent General and Design release reviewers found no new source blockers and agreed that physical-device checks remain separate TestFlight acceptance work. Exact archive and Apple readback are required before an availability claim.

Logs: `/tmp/strideos-build94-prebuild.log`, `/tmp/strideos-build94-tests-isolated.log`, `/tmp/strideos-build94-typecheck.log`, `/tmp/strideos-build94-export.log`.

## Verified Release

- Feature commit: `96229452c679932dbed41be03737e835ca6730b1`, pushed to the existing branch.
- Exact binary source commit: `274d093325d96d46212001006fe19fc167583d9d`, pushed; adds only upload exclusions and their documentation after the feature commit.
- EAS build: [`cec12c77-5e9b-4957-9007-97ab45e7a0c1`](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/builds/cec12c77-5e9b-4957-9007-97ab45e7a0c1), production STORE/IOS, FINISHED October 19 at 11:12:05 UTC, version 1.0.0 (94), matching exact source commit.
- Downloaded IPA: `/tmp/strideos-build94.ipa`, 140,393,294 bytes. ZIP integrity passed. SHA-256: `8911b897c12160eb0840424386d6e543795e009d295905cd3e0b36f794179ffe`.
- Embedded IPA plists confirm host `com.mooremovement.strideos`, Watch `com.mooremovement.strideos.watch`, and Live Activity `com.mooremovement.strideos.liveactivity` are each 1.0.0 (94).
- EAS submission: [`c261a16c-9a7c-4475-9ea5-46b8592c19bb`](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/submissions/c261a16c-9a7c-4475-9ea5-46b8592c19bb), FINISHED October 19 at 11:34:49 UTC. Submitted the explicit build ID, with automatic TestFlight group setup disabled.
- Supported CLI Apple readback: app 6782788130, build 94, `processingState: VALID`, `internalState: IN_BETA_TESTING`, `externalState: READY_FOR_BETA_SUBMISSION`, `expired: false`, matching EAS build and submission IDs.
- No new tester invitations/groups, external beta review submission, or public App Store release performed. A specific tester's account/device access was not independently tested.

Readback artifacts: `/tmp/strideos-build94-view.json`, `/tmp/strideos-build94-submission.json`, `/tmp/strideos-build94-apple-status.json`; submission log `/tmp/strideos-build94-submit.log`. Raw local CLI responses contain temporary artifact/log URLs and are not committed.

Open TestFlight > StrideOS and select 1.0.0 (94) for device testing. The focused checklist is in [README.md](README.md#device-test-guide). Watch unlock/retry and exact-session control, fresh heart-rate samples, native Dynamic Type, and native share export framing/alpha still require physical-device acceptance.

## Upload Recovery

The first source commit `96229452c679932dbed41be03737e835ca6730b1` was pushed successfully. Its 165 MB upload failed with a network `EPIPE` at 137 MB before a build was created. The retry keeps build number 94. EAS-only exclusions remove duplicate elevation thumbnail/share copies and documentation previews; runtime elevation images are loaded by static `require` from the retained `artwork/` directory. Source artwork remains unchanged and in Git.

The supported `build:inspect --stage archive` verified the reduced archive. A TypeScript AST check found all 60 static relative asset imports intact and byte-identical. An iOS Hermes export from that archive succeeded using the existing dependency directory via symlink: all 119 exported asset manifest entries and asset bytes match the original verified export. No runtime source or artwork changed for upload recovery. Archive export log: `/tmp/strideos-build94-export-archive.log`.

The second upload failed with another network `EPIPE` at 65.7/117 MB, again before creating a build. The October 19 retry uploaded the same committed 117 MB archive successfully in 3m13s and created the verified build above. No duplicate build or submission was created by the failed uploads.

This authorization does not include a public App Store release or expanded tester invitations. Physical iPhone/Watch behavior and native image-export fidelity remain device-test boundaries, not claims established by source or browser tests.
