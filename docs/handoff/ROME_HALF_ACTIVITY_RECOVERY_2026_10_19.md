# Rome Half Marathon Activity Recovery

## Incident And Evidence Boundary

The user reported an Activity unavailable screen for the Rome half marathon. The screenshot establishes a failed detail lookup, not deletion of the original recording. No phone database, race route, Apple Health entry or account backup was retrieved in this investigation. Actual race recovery is not yet verified.

Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.
Starting commit: `9374f43` (build 94 release record). These recovery changes are not in the previously shipped build 94. The user explicitly authorized correction and TestFlight submission on October 20; candidate 1.0.0 (95) is tracked in [the release record](ROME_HALF_BUILD95_RELEASE.md).

## Reproduced Mechanisms

1. A detail link using `activity_workout_<run-record-id>` failed after exact-record deduplication retained another Activity ID. The resolver previously checked only the Activity ID and raw legacy ID, not the canonical legacy alias or recorded Health lineage.
2. A completed workout could exist in run history while its Activity projection was absent. The existing-history branch skipped creation, and completion could flush an empty Activity list, acknowledge its journal, then return a fabricated fallback projection ID. This could report successful completion while the resulting detail link pointed at no Activity.
3. These mechanisms are reproducible in source-level/store tests. They are plausible explanations for the screenshot, not a confirmed diagnosis of the user's particular recording.

## Bounded Fix

- Resolve direct IDs first, then unique exact recording/legacy/Health lineage. Do not infer identity from race date, schedule, distance or proximity. Ambiguous aliases fail without writes.
- Require durable readback of the actual Activity before acknowledging run completion; return the confirmed canonical ID, never an assumed ID.
- Missing existing projections require explicit restoration. Absence cannot distinguish an interrupted save from a historically deliberate deletion. Pending ambiguous entries remain retained and do not prevent intact entries from recovering.
- Add Restore saved recording to the missing-detail screen with explicit confirmation that previously removed Activity entries may be re-added. Recover only the exact saved local workout. No cloud/Health bulk replay or new GPS recording is triggered.
- Retain one owner lease through hydration and persistence. Reject foreign owners and ambiguous matches. A new deletion cancels queued restoration. A row arriving during the queue is preserved untouched rather than overwritten by a historical projection.
- Preserve the original workout history, timestamps, duration, raw route, sensor samples and totals. Do not reapply fatigue/load or create another workout.
- Keep save-pending/failure status and retry visible even when the recovered row appears in memory before disk confirmation. Retrying an existing row must flush and verify persistence rather than infer success from memory.
- Keep the Back header available during loading and make recovery controls scrollable. Stale dialogs/results cannot navigate over another activity; duplicate confirmations share one recovery attempt.

## Council Review

- General/Contrarian R1 rejected automatic reconstruction because retained run history does not prove permission to undo a deletion. Explicit informed restoration replaced that plan.
- R2 found an ambiguity path that could overwrite edited data before throwing. The service now rejects ambiguity before writing; queued add-only restoration preserves a newly arrived edited record.
- Design/Platform found that publication before a failed disk write could hide recovery errors. Pending/failure feedback now remains on resolved detail, and retry explicitly verifies persistence.
- General and Platform source closure found no remaining scoped blocker. Their bounded source judgments are not probabilities of device reliability. Final automated results are recorded below after execution.

## Verification

- Full suite: 998/998 passed, zero failures/skips, serial execution. An initial concurrency-2 run passed 997 and timed out in the unchanged 30-second Swift compiler probe; the probe then passed alone in 8.4 seconds, and the complete serial suite passed in 98 seconds. No assertion or deadline was weakened.
- Actual Activity-detail JSX tests: 6/6 passed, including publication-before-persistence rejection, visible error/retry after resolution, duplicate confirmations, and stale dialogs/results. The initial failures were missing VM test harness bindings, corrected without weakening assertions.
- Real-store tests cover queued preservation of a newly arrived edited Activity, deletion cancelling queued recovery, exact original workout data, failure retention, and no duplicate fatigue/load side effects.
- iOS Hermes export passed: 10 MB bundle, 119 assets, `/tmp/strideos-race-recovery-export`.
- Final source-stable repository TypeScript 5.9.3 semantic check passed, exit 0.
- `git diff --check` passed. Protected native Watch transport/bridge source, dependencies, build number and production data are unchanged.

Logs: `/tmp/strideos-race-recovery-tests-serial.log`, `/tmp/strideos-race-native-probe.log`, `/tmp/strideos-race-ui-final.log`, `/tmp/strideos-race-recovery-export.log`, `/tmp/strideos-race-recovery-typecheck-verified.log`.

## Current Device Recovery

Keep StrideOS installed and remain on the original account. Check Activity directly rather than relying only on an old Calendar/detail link. If the race is present in Apple Fitness/Health, the existing More > Settings > Data & backup > Restore from Apple Health action can import the data saved there. Health recovery cannot guarantee fields that were never saved to Health.

Once a binary containing this patch is installed, open the affected detail and choose Restore saved recording. Confirm only if restoring that retained run is intended. Verify the original duration, distance, map, timestamps and available sensor metrics, restart the app, and reopen the same activity. Ensure there is one race, not another workout. If no exact saved record is found, keep the app installed; do not fabricate a replacement route or race result.

## Remaining Boundaries

- The screenshot does not identify the failing Activity ID or prove which mechanism occurred. The user was asked whether this happened immediately after Finish or on reopening, and whether the race exists in Apple Fitness/Health.
- Pre-existing startup legacy migration can reproject deleted workout history; this scoped change is not a global persistent-deletion-tombstone redesign.
- The authorized October 20 build/submission and verified Apple state are tracked in the separate release record; source verification does not establish actual race recovery.
- No claim that the user's actual race is recovered, that all sensor fields exist in Health, or that the fix is verified on iPhone/Watch.
