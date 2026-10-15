# P1 Offline Identity And Run Completion Review

Date: 2026-10-15. Canonical checkout: Developer/StrideOS_App_clean_build19_v3_foundation_local.
Starting HEAD: 4ae752b. The shared checkout contains other agents' concurrent work.
No commit, push, EAS build, submission, or device validation was performed by this P1 worker.

## Round 1: Plan And Cross-Examination

- Revised P1 plan: 95/100 after the Chair adopted owner binding, durable logout fencing, captured-generation checks after awaits, and exact recording lineage. This is a judgment gate, not a measured reliability probability.
- Revised P2 plan: 95/100 with the parent-owned root custom header, focused Back-handler registry, registration/path cleanup guards, one safe-area owner, guarded modal dismissal, no global pan interception, and tour measurement cancellation/fallback. This worker did not implement P2.
- Contrarian resolution: retain useful completion entry points, but share the live completion command. Do not widen fuzzy merge windows, merge different recordings merely because they share a schedule, erase ambiguous old history, or namespace every store in this bounded patch.
- Unknown legacy ownership is quarantined. Only an existing SDK-cached identity can establish legacy ownership automatically. A new account must not silently claim existing records.

## Round 2: Implementation And Self-Review

This is self-review, not an independent council pass.

### Identity And Cloud

- `src/lib/localDataOwner.ts`: durable owner record and logout fence; local/cloud leases; generation invalidation; explicit owner-conflict, unclaimed, invalid, offline and storage-error states.
- `src/lib/supabase.ts`: ownership bootstrap before SDK credential replacement; existing encrypted native credential storage retained; foreground refresh lifecycle; owner-bound function headers without anonymous fallback for private requests.
- `src/store/authStore.ts`: retryable refresh failures can retain confirmed-owner local access without fabricating a cloud session. Invalid sessions and explicit logout remain distinct. Rejected accounts are not published as application user/session identities.
- `src/lib/syncService.ts`: capture owner before async work; recheck after session/user verification and cloud awaits; pin requests to that owner's verified access token; reject explicitly foreign record owners and stale/failed restore results.
- `src/components/sync/CloudBackupBridge.tsx`: no backup while blocked/offline; acknowledge snapshots only after success; preserve failed work for retry and fence callbacks by owner generation.

### Completion And Lineage

- `src/lib/runCompletionJournal.ts`: persist an owner-bound first-End snapshot before clearing a recording; serialized, validated, idempotent journal writes and owner-specific acknowledgements.
- `src/store/workoutStore.ts`: shared durable live-save command, original-owner recovery, actual start/end and source preservation, and deletion through the actual canonical Activity ID even when Health arrived first.
- `src/utils/runCompletionIdentity.ts`: instance/source lineage, collision-safe keys, and enrichment preserving GPS and measured fields. Schedule IDs and time proximity are not duplicate identity.
- `src/store/activityStore.ts`, `src/utils/activityMigration.ts`, `src/utils/healthKitImport.ts`: no automatic fuzzy/plan-only merge; replay recognizes exact aliases without recreating them; restore does not overwrite existing local records.
- Completion-only regions of `app/(tabs)/training/index.tsx` and `run-tracking.tsx`: save before active-state clearing; use persisted instance and actual times; fence async continuations against account or recording changes. Parent-owned modal/UI changes were preserved.

### Self-Review Corrections

1. Established ownership before a newly signed-in SDK session could overwrite legacy identity evidence.
2. Pinned cloud Authorization to the verified owner instead of relying on mutable SDK session state.
3. Distinguished terminal auth codes from retryable network failures and unknown/storage failures.
4. Preserved GPS, Health-first canonical aliases, and actual start/end through completion and migration.
5. Kept a failed disk save recoverable; retries do not repeat fatigue changes or add another completion.
6. Rechecked owner/instance after async save and native-stop awaits; stale completion must not clear a newer run.

### Verification

- Before Gauss R2 revisions: P1 behavioral suite 20 tests; expanded regression selection 81/81; application typecheck passed. These are earlier-stage results, not validation of the revised final shared tree.
- Initial Gauss R2 revisions: P1 behavioral suite 24 tests; expanded regression selection 85/85. This is superseded by the focused final readback below.
- Current focused readback after credential serialization, exact Watch metadata, conditional GPS cleanup, the generic Activity durability API, and B2 indoor/discard defenses: P1 behavioral suite **47/47**; expanded regression selection including Activity hydration UI, Run End recovery, and Outdoor completion **133/133**, 0 failed (3.38 seconds). Scoped `git diff --check` passed. Parent owns the single final-tree typecheck; this worker did not start another.
- Earlier full shared-tree snapshot: 765 tests, 754 passed, 11 failed. Later parent snapshot: 815 tests, 814 passed, with the SDK-storage cancellation test failing during concurrent credential-queue edits. That exact test passes in the current focused runs; a new full-tree result remains the parent's responsibility.
- Historical failures at the 765-test snapshot: Activity taxonomy; Activity split/share ordering; Build 56 payload-schema expectation; Phase 5 mode-gating presentation; phone auto-launch contract; watch route lifecycle contract; outdoor elevation payload; Build 53 identity expectation; Build 56 widget/schema expectation; streak-hub artwork mapping; watch emitter contract. These are not presented as current failures.
- Updated obsolete tests that required fuzzy overlap or plan-only deduplication to require exact lineage. No unrelated failing assertion was relaxed.
- Investigated the later shared-suite cold-navigation failure: the source assertion required `const`, but the elapsed value is now `let` so a retry can report the journal's original End snapshot. It is still initialized from persisted active-run state, not the screen timer. Added an execution-level test extracting the real Stop handler: persisted start/pause yields 600 seconds despite a reset display timer; a prior durable End snapshot yields 570 seconds/1.2 miles in the native completion. Only then widened the declaration assertion to `const|let`; all eight Build 39 regression tests pass.

## Round 3: Independent Review And Integration Gates

Gauss's independent R2 initially returned **88/100 REVISE**, then **94/100 REVISE** on partial re-review because overlapping explicit auth attempts could authorize a stale credential write. No independent implementation approval, native/device proof, or release signoff is claimed. The revisions below are awaiting independent re-review.

### Gauss R2 Revisions

1. Startup preferences: `hasRetainedLocalData()` now distinguishes reminder/integration preferences with no connected identity from actual retained data. Empty readiness history is benign; real readiness, custom programs, overrides, connections, and unknown stores remain protected. An ownerless unclaimed marker is reclassified only when the current scanner proves no retained records; no history is cleared or assigned from a new SDK identity.
2. Explicit auth races: each password/signup/Apple/Google attempt captures a separate attempt generation before its first await; logout and newer attempts invalidate it. Stale responses cannot call owner acceptance. Apple consent and OAuth browser returns are checked before credential exchange, and SDK persistence rejects an explicit attempt whose guard is no longer current.
3. Native Health lineage remains the native owner's revision and independent verification responsibility.
4. Screen-independent End: `src/lib/runCompletionCommand.ts` exports `completeRunCommand({ workoutInstanceId, endedAt, elapsedSeconds?, distanceMiles?, distanceSource? })`. It waits for hydrated stores under the captured owner lease, validates exact instance/time, snapshots actual state/telemetry, and commits through the shared journal without requiring Training or RunTracking to mount. A retry recommits the existing first-End record, including persistence flush, rather than accepting changed event totals. The existing Training request consumer no longer clears the request before a successful save; both screen completion paths use a persisted End timestamp when present.

The command returns `{ status: 'saved' | 'discarded', entry, activityId, ownerLease }`. Under-five-minute commands retain a durable discard marker, never an Activity/award. `pendingRunDiscards()` exposes original-owner markers after restart; `acknowledgeRunCleanup(instanceId, ownerLease)` removes only that owner's marker after matching-instance cleanup. Saved history itself remains durable cleanup evidence after journal acknowledgement.

Native/global caller contract: call this command directly for End, not merely `requestCompletion()` plus navigation. Preserve the watch's first End timestamp and exact instance; do not mark an event consumed before durable success. On failure retain/retry the original command and leave active recording/request state intact. Recheck the returned owner lease and active/native instance before each cleanup and after awaits. Never let a delayed old cleanup stop a newer run's GPS, Live Activity, watch session, or active store. Native compare-and-end must carry the exact instance. Failure to end a native presentation should remain retryable without locking a new local recording after matching local cleanup. This worker did not edit the watch bridge, native modules, or root.

Revised focused tests add real startup-discovery cases, late password/signup/Apple/OAuth returns, newer-attempt precedence, background End without a mounted screen, disk-failure retries, stable first-End values, discard recovery/acknowledgement, and rejection of unmatched End instances. This worker stopped its typecheck at the parent's request and will use the parent's single final-tree typecheck; no more full typechecks/builds are running from this worker.

### Subsequent Blocking Cross-Review Fixes

- **Credential exchange ownership:** `withExplicitAuthAttempt()` now serializes credential exchanges and binds persistence to the active exchange's own guard, captured before storage awaits. A queued, newer valid B attempt cannot authorize stale A credentials. New intent still invalidates A immediately while B waits. Stale native writes are removed only when readback equals that attempt's own value. An execution test holds A, queues B, revokes A, and proves A cannot persist; a second case logs out both and proves neither persists and B never exchanges credentials.
- **Watch evidence contract:** `completeRunCommand()` accepts optional `watchRecording`. `matchingWatchRecording()` requires the exact instance, valid confirmation time, and confirmed native recording state; projection, journal validation, completion retry, and Health enrichment preserve only matching evidence. A late matching confirmation can enrich the existing first-End record without adding a second completion or changing original time/distance. Connectivity, last-seen time, and a Health write receipt are not recording confirmation. C owns attaching exact native event evidence and its bridge readback.
- **Phone GPS Stop race:** both screen Save handlers now call C's `stopLocationTrackingWhen(completionStillOwned)`, not unconditional `stopLocationTracking()`. The RunTracking discard callback captures an owner lease and instance, checks before native cleanup and after each await, and uses the same conditional GPS stop. Training's under-five-minute discard already shares its guarded Stop path. Twelve execution regressions extract the actual handlers and run the real GPS operation queue with a delayed native `hasStartedLocationUpdatesAsync()` response. Across Training Save, short discard, RunTracking Save, and explicit discard, replacing the run or revoking its owner during that lookup never stops GPS, clears active state, or navigates back; a queued newer start remains intact. All four unchanged-owner/instance controls still clean up normally.

### Generic Outdoor Activity Durability Contract For C

`src/store/activityStore.ts` now exposes:

```ts
const canonicalActivityId = await useActivityStore.getState()
  .addActivityAndPersist(firstEndActivity, ownerLease);

// For an already-added canonical Activity:
await useActivityStore.getState().awaitPersistence(ownerLease);
```

- `ownerLease` comes from the owner-bound End operation, not a later account/session. The API requires a stable Activity ID or recording instance. It snapshots the supplied Activity on entry, waits for hydration and legacy migration, checks the lease before mutation and around storage awaits, and returns the actual canonical ID after exact saved-byte readback. Existing ID/instance matching is reused; no proximity deduplication is introduced.
- Durable commits and every normal Activity middleware write share write ordering, preventing a delayed older middleware write from overtaking the explicit flush. Failed commits do not poison later retries. `workoutStore` uses this shared flush instead of bypassing it with another direct Activity storage write.
- **This API is not the outdoor End journal.** C must first durably journal the original owner, exact recording instance, first End timestamp, and immutable Activity snapshot. Retry that same snapshot; do not rebuild metrics from a later active screen or overwrite first End on repeat. Keep the command pending when this API rejects. After it resolves, recheck lease and exact active/native instance before cleanup and after each native await. This worker did not edit C's active-activity store, start screen, global outdoor helper, or native modules.
- New execution tests cover delayed durability acknowledgement, middleware/direct-write serialization, failure/retry without duplication, Health-first canonical IDs, distinct nearby instances, owner revocation during disk I/O, queued stale additions, hydration races, and mismatched storage readback.

At the generic API stage, scoped self-review passed **42 behavioral tests and 106 expanded regressions**; B2's newer results are below. These fixes close the reproduced JavaScript races in this test environment; they do not establish device/native correctness or independently upgrade the council score. C's global outdoor End journal/cleanup integration and exact native Live Activity compare-and-end, plus the parent's final frozen suite/typecheck, remain separate gates.

### B2 Indoor Confirmation And Durable Discard Resolution

- `completeRunCommand()` now rejects every new active indoor completion with `Indoor completion requires TreadmillCompletionSheet confirmation`, before reading command distance or writing a completion. Supplying Watch distance or a `confirmed_speed_estimate` label cannot bypass the sheet. An existing confirmed history record may still replay through the durable flush; original End, distance, and source are preserved. A durable discard may also replay without reopening confirmation or creating history.
- Training's short outdoor Stop, short indoor sheet confirmation, RunTracking short End, and explicit Discard now await an owner-bound discard journal write before native cleanup or local clearing. Failed writes keep the recording/sheet snapshot available. Explicit discard never deletes an already-saved workout.
- Workout store API: `await discardRunEnd(entry, week, fatigue, recovery, ownerLease)` returns `RunCompletionResult` with `status: 'discarded'`, `activityId: null`, and the original journal entry. It preserves first End when replayed and does not add workout/Activity history, fatigue, or awards.
- Recovery API: `await getRunDiscardResult(workoutInstanceId, ownerLease)` returns that owner/instance's durable discarded result or `null`. It checks the lease before/after reading and includes cleanup-acknowledged tombstones. `pendingRunDiscards()` remains the current-owner list of discards still needing cleanup; it excludes acknowledged tombstones. `acknowledgeRunCleanup()` marks a discard resolved rather than erasing its evidence, so a crash between inner cleanup and outer End-queue acknowledgement cannot revive or permanently strand it.

**Required C consumer amendment, not edited by this worker:** in `outdoorCompletion.ts`, read `getRunDiscardResult(instance, lease)` before deciding run dispatch based only on active state or saved history. A matching discard is valid run resolution even if both active stores are now idle. Include it in the `allowRunDispatch && !item.activity` branch and route through existing exact-instance cleanup/queue acknowledgement. In `watchRunCompletion.ts`, consult this lookup before the new-indoor confirmation branch as well; the pending-cleanup list alone intentionally omits resolved tombstones. Keep owner/instance fences around these awaits. No Activity or award should be synthesized for the discard.

B2 tests execute actual short indoor confirmation with both successful and failed journal writes, the GPS handlers across recording/owner races, new indoor auto-command rejection despite Watch totals, confirmed indoor history replay, acknowledged discard replay while a newer indoor run is active, stable first-End discard retries, and stale-owner rejection. **47/47 behavioral tests and 133/133 expanded regressions pass.** The first expanded run found one obsolete source assertion expecting scheduled-session stamping inside `activity/start.tsx`; verified C's snapshot path and its execution test, then changed only that architecture assertion to require the global dispatch and exact scheduled-session projection. C's files/tests were not edited. The parent/C consumer amendment above still needs source readback and independent review; no new independent score or native/device claim is made.

Parent HealthActivityWriter readback shows a lease check after the awaited Health query before imports/writes, with automatic recovery limited to the watch bundle; ActiveLocationTrackingReconciler rechecks the lease after hydration and before resuming the second outdoor session. These are source checks, not proof of completed native I/O cancellation or device behavior.

Required parent/native integration checks:

1. Root routing and mounting: after loading, use `canAccessLocalData`, not `session` alone. Offline owner access intentionally has `session: null`. Keep protected content and data-writing bridges unmounted when false. Show `localAccessReason` for quarantined ownership/storage failures. No missing-configuration bypass into private local history.
2. Cloud hydrate application: `hydrateFromSupabase()` returns `ownerLease`. In `authRedirect.ts`, check `ownerLeaseIsCurrent(result.ownerLease, true)` immediately after the await and before applying records. This file was outside P1 ownership.
3. Native Health metadata: carry `strideOSActivityId`, `strideOSWorkoutId`, and `workoutInstanceId` through the candidate and imported Health metadata; top-level Activity may carry `workoutInstanceId`. These are exact identity, not temporal inference. `healthKit.ts` and `src/types/activity.ts` were not edited by this worker.
4. Recovered native recordings: journal recovery restores history but intentionally does not forcibly end native sessions. The native owner must reconcile a completed history record's `workoutInstanceId` only against the matching active instance; never clear a newer recording. Existing watch event ownership remains unchanged by this worker.
5. Unknown-owner recovery needs explicit user resolution; no implicit reassignment or destructive clearing was added. Historical duplicates without exact lineage remain untouched rather than guessed away.
6. Re-run the full suite/typecheck after other agents finish, then independently review the actual diff. Validate offline cold/warm launch, explicit offline logout, owner changes during queued work, disk-failure recovery, simultaneous phone/watch End, Health round-trips, and two legitimate nearby sessions on device before release claims.

### Exact Parent Gate Contract

Read `loading`, `canAccessLocalData`, `localAccessStatus`, and `localAccessReason` from `useAuthStore`. After loading, mount protected routes and data-writing bridges only when `canAccessLocalData` is true; do not additionally require `session`. Route `signed-out` and `invalid` to authentication. Keep `owner-conflict`, `unclaimed`, and `storage-error` blocked with their recovery reason and no implicit history clearing/reassignment. Supabase unavailability is not permission to bypass the gate.

In `src/lib/authRedirect.ts`, import `ownerLeaseIsCurrent` from `./localDataOwner` and immediately after `const result = await hydrateFromSupabase();`, before any store mutation, add:

```ts
if (!ownerLeaseIsCurrent(result.ownerLease, true)) {
  throw new Error('Account changed during cloud restore. Please retry.');
}
```

Final parent integration readback confirmed `NavigationGate` uses `canAccessLocalData`, removes the Supabase-unavailable bypass, and sign-in displays `localAccessReason`. Root `Stack.Protected` gates tabs/onboarding/modal routes, and the same flag conditionally mounts the writer/reconciler bridge group while leaving auth navigation available. `authRedirect.ts` now checks the cloud lease immediately after hydration and before applying any records. The two previously reported source-integration gaps are closed. This is source readback, not runtime/device or deployed-security proof. P1 implementation is complete and awaiting Gauss's independent R2; no independent verdict has been received by this worker yet.

## Documentation Checked

### Follow-Up Freeze: Training Run Delayed End

- R3 reproduced End drift from live `distanceMiles` and aggregate `pausedDurationMs`: later fixes inflated distance and later pauses shortened a past End. `trainingRunEndSnapshot.ts` now captures the full Training Run entry at a fixed End. It uses the existing telemetry pause clipping/union and excludes future observations; phone distance is recomputed from accepted fixes within start/End, skipping pause-spanning segments. Explicit measured Watch End distance/time remain authoritative. A scalar without GPS fixes is not used as phone distance evidence.
- `completeRunCommand()` deep-copies command input and captures before its first await. It freezes the matching outdoor recording, blocking later GPS, pause/resume, and telemetry mutation, including backdated sensor delivery after a failed first journal write. Hydration recovery without an initial snapshot reconstructs only End-bounded data. Owner/instance checks remain; a validated owner-bound snapshot may finish the old recording without adopting or clearing a newer active one.
- `completeWatchRunEnd()` captures the full snapshot before retry storage awaits. `RunEndRetryQueue` validates owner/instance/End binding and deep-clones the full command before retention; its first command wins through failed storage, retry, and restart. The existing authoritative completion journal still controls first committed End and durable history. No native or generic outdoor snapshot files were changed by this follow-up.
- Outdoor `requestCompletion()` now freezes End-bounded distance, route, and pause duration in the persisted active store. The existing screen Stop path therefore observes the same frozen timing and distance. Indoor requests retain their existing sheet-only confirmation behavior; new indoor auto-save remains forbidden and saved/discard replay remains allowed.
- Copernicus's **unchanged** `scripts/tests/delayedRunEndReview.test.ts`: **3/3 pass**, covering immediate versus delayed GPS, wholly post-End pauses, and failed-write retry equivalence. Final focused selection: **87/87 pass, 0 failed, 0 skipped** (4.02 seconds), including `p1OfflineCompletion`, `delayedRunEndReview`, `runEndRecovery`, `outdoorCompletion`, and `build39LiveActivityStabilization`.
- Added P1 behavioral checks for clipped/unioned pauses, explicit Watch totals, pre-await snapshot capture while the live recording changes, deep-copied retry/restart, and pre-End sensor samples delivered after a failed write. The existing point-free fixture now supplies its two-mile total explicitly as a Watch End measurement; its durability assertions were not relaxed.
- Scoped `git diff --check` passed. Source is frozen for independent R3. No full typecheck, full suite, export, build, commit, or device verification was run by this worker. The parent retains those gates; this is implementation/self-verification, not a self-issued independent pass.

- Supabase getSession: https://supabase.com/docs/reference/javascript/auth-getsession
- Supabase sessions: https://supabase.com/docs/guides/auth/sessions
- Supabase auth errors: https://supabase.com/docs/guides/auth/debugging/error-codes
- Supabase React Native lifecycle: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Expo SDK 56: https://docs.expo.dev/versions/v56.0.0/
- Expo SDK 56 SecureStore: https://docs.expo.dev/versions/v56.0.0/sdk/securestore/
- Expo SDK 56 Network: https://docs.expo.dev/versions/v56.0.0/sdk/network/

Installed SDK inspected: Supabase JS/Auth JS 2.108.2; project Expo constraint ~56.0.22. Source guards and local tests are not deployed RLS/security proof. No credentials or personal stored health records were inspected.
