# October 18 TestFlight Release

Status: preparing 1.0.0 (94), explicitly authorized by the user on October 18.

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

Source commit, push, native archive, submission and Apple processing results will be recorded here after execution.

## Upload Recovery

The first source commit `96229452c679932dbed41be03737e835ca6730b1` was pushed successfully. Its 165 MB upload failed with a network `EPIPE` at 137 MB before a build was created. The retry keeps build number 94. EAS-only exclusions remove duplicate elevation thumbnail/share copies and documentation previews; runtime elevation images are loaded by static `require` from the retained `artwork/` directory. Source artwork remains unchanged and in Git.

The supported `build:inspect --stage archive` verified the reduced archive. A TypeScript AST check found all 60 static relative asset imports intact and byte-identical. An iOS Hermes export from that archive succeeded using the existing dependency directory via symlink: all 119 exported asset manifest entries and asset bytes match the original verified export. No runtime source or artwork changed for upload recovery. Archive export log: `/tmp/strideos-build94-export-archive.log`.

This authorization does not include a public App Store release or expanded tester invitations. Physical iPhone/Watch behavior and native image-export fidelity remain device-test boundaries, not claims established by source or browser tests.
