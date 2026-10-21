# Rome Apple Health Restore - Build 96

Status: 1.0.0 (96) submitted and verified VALID / IN_BETA_TESTING, October 21, 2026. Continues the user's request to correct Rome half marathon recovery and submit to TestFlight. No public App Store release or expanded tester distribution. Actual race recovery on the phone remains unverified.

## Evidence And Cause

- The user showed the Rome half marathon in Apple Health, sourced from StrideOS with exact `StrideOSWorkoutInstanceId` metadata, including an actual route and measured totals. Personal recording IDs and biometric values are intentionally omitted from committed fixtures and this report. Mac access does not expose that phone's Health database.
- Build 95's local retained-record restore found no exact local run. Its separate Apple Health restore then reported no workouts despite the Health screenshots.
- Installed `@kingstinct/react-native-healthkit` 14.0.2 exports its methods on `default`, but `WorkoutActivityType` only through named exports. The adapter selected default and then required its absent enum to map workouts. Valid running samples therefore became null candidates.
- A regression test using the installed generated enum, split exports and a representative proxy reproduced zero candidates before the fix and one afterward. This establishes an adapter defect, not the sole proven cause on the user's phone; read permission or protected-data failures remain possible.
- Native workout query errors also became empty arrays. These now report read failures instead of asserting that Health contains no workouts. Successful empty reads explicitly do not establish the absence of the race or a read grant; see [Apple's authorization documentation](https://developer.apple.com/documentation/healthkit/hkauthorizationstatus).

## Bounded Changes

- Retain the named sport enum while preserving the library's bound public methods; no dependency changes or native bridge rewrite.
- Preserve exact Health UUID and StrideOS recording metadata, measured totals, summaries and actual route coordinates. No inferred recording identity or synthetic GPS.
- Explicit restore captures account ownership before permission/query awaits, waits for safe hydration, cancels on new deletions and uses add-only durable commits. Existing edited rows are never overwritten; failed prior persistence is retried before success.
- Confirm that this bulk action can restore previously removed supported Health workouts. Do not change the ongoing Health sync preference.
- Requested route-read exceptions stop restoration before any candidates are written. Successful empty route results remain possible under Health's privacy model; missing signals are not invented.
- Stop outbound Health writes when duplicate lookup fails. This stops the current attempt; no automatic retry queue is claimed.
- Remove uncertain startup Health-only imports: absence cannot distinguish a deliberate deletion from a missed Watch completion. Such sessions use explicit restore. The normal Watch bridge/completion journal remains unchanged.

## Review And Verification

- Independent Platform and Contrarian/Data Custody reviewers identified and cross-examined the default-export defect, false-empty errors, failed-lookup duplicate writes and startup deletion resurrection. Their source verdict is conditional GO subject to final tests/build/Apple checks, not device recovery proof.
- Before final sync guard tests, the serial full suite passed 1,007/1,007. Targeted current tests passed 26/26, covering the exact library shape, routes, metadata, failed reads, durable retry, owner/deletion fences, edits, duplicate prevention and no startup resurrection.
- Final post-anonymization serial suite passed 1,012/1,012 tests, zero failures/skips, in 91.97 seconds. TypeScript 5.9.3 semantic typecheck, clean iOS prebuild and `git diff --check` passed. Hermes export produced a 10 MB iOS bundle and 119 assets; the compiled bundle contains the corrected empty-state message.
- Generated host plist and Watch/Live Activity build configuration use build 96. Final signed IPA verification passed; supported Apple readback confirmed VALID / IN_BETA_TESTING.
- Native Watch/bridge/completion files and dependency manifests/lockfiles are unchanged. Local logs: `/tmp/strideos-build96-tests-final.log`, `/tmp/strideos-build96-typecheck.log`, `/tmp/strideos-build96-prebuild.log`, `/tmp/strideos-build96-export.log`.
- Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`; branch `build-19-v3-foundation`.
- App `com.mooremovement.strideos`, version 1.0.0 (96); EAS project `f32ed63a-a22a-4360-8b1d-3ed4d2c329d9`; ASC app `6782788130`. Existing production profiles/signing retained. Latest EAS and Apple builds were 95 before selecting 96; Apple's supported readback confirmed 95 VALID / IN_BETA_TESTING.

## Signed Build And Submission

- Binary source: `3f2ccfd91d65a371f6850d09f73bc3ba5d520c44`, pushed to `build-19-v3-foundation` before upload from a clean tree.
- EAS build: [`60142e72-6e40-45c3-8f46-085768c93cb1`](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/builds/60142e72-6e40-45c3-8f46-085768c93cb1), production STORE/IOS, FINISHED at 17:29:32 UTC October 21, matching source commit and 1.0.0 (96).
- IPA: `/tmp/strideos-build96.ipa`, 140,400,735 bytes. ZIP integrity passed. SHA-256: `e6417d7e63860ff687b2610b1792075272ce04cd42824202780fe349abea5b6b`.
- Embedded phone, Watch and Live Activity plists each have the intended bundle identifier and version 1.0.0 (96).
- Exact-build submission: [`0c2bdbf7-6497-4baa-91bf-67f0a6a2289b`](https://expo.dev/accounts/drizzyydrew/projects/StrideOS/submissions/0c2bdbf7-6497-4baa-91bf-67f0a6a2289b), FINISHED at 17:49:57 UTC October 21. Automatic TestFlight setup disabled. The upload spent approximately 17 minutes processing before completion; no duplicate submission was created.
- Supported Apple readback: app `6782788130`, version 1.0.0, build 96, processing VALID, internal IN_BETA_TESTING, external READY_FOR_BETA_SUBMISSION, expired false, matching EAS build/submission IDs and fingerprint `4dd3baa30062d97f07d41f0f8431f8335bfec073`.
- No new invitations/groups, external beta review or public App Store release performed. This establishes internal beta availability, not a specific tester's device/account access or recovery of the race.
- Local receipts: `/tmp/strideos-build96-view.json`, `/tmp/strideos-build96-submission.json`, `/tmp/strideos-build96-apple-status.json`; submission log `/tmp/strideos-build96-submit.log`. Temporary signed URLs remain local, not in this report.

## Device Acceptance

1. Update in TestFlight without uninstalling StrideOS or changing accounts.
2. More > Settings > Data & backup > Restore from Apple Health; confirm the explicit restoration.
3. If Health returns no readable workouts, unlock the phone and verify read access to Workouts and Workout Routes for StrideOS in Health. Connected alone does not prove read permission.
4. In Activity, verify the race's original date, distance, active duration, average heart rate and Rome route against Apple Health, subject to what Health actually returns.
5. Restart StrideOS and reopen it. Repeat restore and verify exactly one race and unchanged edits. Verify deliberate deletion is not reversed by startup Health import; explicit restore can restore it with consent.

Do not claim the actual Rome race has been recovered before device confirmation. Apple Health remains unchanged by this import.
