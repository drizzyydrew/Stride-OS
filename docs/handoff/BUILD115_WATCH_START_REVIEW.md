# Build 115 Watch start review

**CURRENT GATE: all three seats renewed favorable 95/100 bounded source confidence on final frozen source; 53/53 targeted tests pass. Root integrated checks, current-SDK cloud compilation and hardware verification remain required.** The earlier cold Stop/unknown-nonce and manual-control recovery counterexamples are now covered by the final affected tests described below. No build or submission is claimed here.

Recorded November 11, 2026 Pacific (2026-11-12 04:24:16 UTC). Source is frozen at the hashes in [BUILD115_WATCH_START_SOURCE_RECEIPT.json](./BUILD115_WATCH_START_SOURCE_RECEIPT.json). Root owns the separate integrated-check, current-SDK build and delivery records. This handoff does not claim a build has started or been submitted.

## Finding and bounded correction

The reproduced source fault was a phone-initiated live Start with cached `isReachable == true` followed by an asynchronous send failure. The old recovery queued the Start, while the Watch deliberately ignores queued/context Start commands; the initial launch helper had already skipped launch because reachability was true. An actual-source Swift probe reproduced no HealthKit launch in that ordering. This establishes a reachable startup fault; it does not establish the cause of the reported ten-minute disconnect or phone crash.

The new prepared protocol opts in outdoor sport recording only. A synchronous prepared nonce is registered before the queued Expo Start body. A current, positively advertised protocol capability permits one forced Watch launch after the asynchronous live failure, even if cached reachability remains true, and one live resend of the same original packet, command identity, logical session, nonce, owner epoch and `sentAt`. There is no general automatic running-session replay. Direct Strength, Mobility and indoor starts retain their legacy API path.

Every local prepared transport submission is serialized with cancellation. Matching End fences locally before pairing/install guards and before queued native Start execution. Benign same-owner refresh and Bridge/module cleanup stop new local retry work without remotely ending an existing workout, even when ACK was lost. Hard owner invalidation revokes the exact association. An accepted command ACK is explicitly not evidence that HealthKit recording began.

On Watch, an exact `(session ID, nonce, owner epoch)` revocation is persisted before a no-active-workout rejection. End-before-Start cannot resurrect that tuple. Start-before-End uses the existing End/save path once. On hard revocation the receiver's actual HealthKit running/paused state decides custody: preserve recorded Health work by End/save; discard only pending authorization or an unowned provisional startup. Old A controls cannot stop or clear B, including B's pending Pause.

Unknown OS provisional launches are discarded and recreated with a fresh builder before fenced ownership; prior provisional data or cumulative statistics are not relabeled into a new identity. Authorization, denial, watchdog, timeout and session/builder callbacks are guarded against stale attempts. Failure retires the exact identity and permits a deliberate Retry with a new nonce, with no hidden automatic permission relaunch.

Phone restart recovery requests fresh, nonce-echoed capabilities for the exact locally requested session ID. A running/paused original tuple can be retained for controls without starting or relabeling it. If End or owner revocation occurs before that capability reply, a bounded terminal-only expectation survives association retirement. The late correlated reply can only End/cancel the original tuple. It cannot adopt an owner, start a workout or control a new logical B. Peer reset clears the expectation. Temporary unpairing preserves the remote-End obligation until fresh correlated discovery after reconnection; local fencing or background queueing is not remote-stop confirmation.

The actual cold RecoveryPrompt Stop path does not mount a recording screen or prepare a new Start. Every explicit local End with a valid immutable recording ID now submits a distinct `endRecording` immediately, including when a new prepared nonce exists after phone restart. It does not wait for capability discovery or a known Watch nonce. Old Watch ignores the new command and still receives the existing legacy End fallback. With no native association, returning nil preserves that fallback. Temporary unpairing retains the terminal obligation for reconnection, and later owner revocation does not downgrade it. Every explicit valid-ID End registers that bounded obligation before association retirement, including an hour-old acknowledged association whose normal discovery queries were already pruned. If the bounded native intent map truly has no capacity, it reuses a same-ID discovery slot or throws rather than acknowledging exact cleanup. Actual transport errors propagate in both selected and cold branches, preserving the existing durable JS cleanup journal; the general UI End wrapper shows the error. Activation not ready also throws after local fencing. Success requires handing logical End to the OS background transfer queue even when the same packet is sent live; an in-memory activation queue is insufficient. The new command never constructs a PreparedStart, starts HealthKit or adopts an owner.

Watch validates the dedicated ID-only terminal command and persists a logical-ID tombstone before checking for an active session. Any later fenced Start with that same immutable recording ID is rejected before authorization, including an unknown already-dispatched nonce and a Watch relaunch. Only this explicit terminal event retires all attempts for that ID. Nonce-bearing `endWorkout` and `cancelStart` remain exact attempt operations: old N1 cannot stop N2, and retry after a failed attempt remains possible until the recording itself is terminally ended. New logical recordings must use a new UUID. Matching actual running/paused work ends/saves once; pending authorization is retired; an unrelated B remains untouched.

The actual owner-guarded outdoor Resume entry point first calls `recoverStrideWatchControlIdentity(id)`, which invokes only the existing optional native prepare method. It never calls startPrepared or submits a Start and has no HealthKit fallback. This read-only discovery caches the original actual running/paused tuple for future newly issued generic automatic controls. An initial persisted generic Resume is not replayed on discovery; missing capability leaves Watch control unavailable rather than inventing identity. The actual session and builder remain unchanged.

Manual Running and outdoor-activity buttons use optional synchronous `sendExplicitWorkoutControl` through the explicit JS wrappers. The actual immutable ID comes from the guarded active store. Older native modules use their legacy async fallback. Explicit wrapper signatures accept omitted/null IDs used by actual callers. Missing or empty IDs immediately use the legacy generic control API and cannot enter native explicit lookup. Automatic pause effects retain the generic API; generic controls cannot create a cold recovery lookup and invalidate older manual lookup intent for that ID.

Without any prepare/Start, a manual Pause/Resume can request the original tuple through a bounded 90-second, latest-explicit-intent capability lookup. A fresh same-ID actual running/paused tuple permits one exact live control under owner/peer/expiry guards, without adoption or Start. Older Pause replies, End, owner/peer changes, expiry and newer generic decisions suppress stale manual intent. Resolved Pause/Resume never enters userInfo or applicationContext queues. Normal prepared restart recovery also replays only a marked explicit follow-up, live only; persisted automatic Resume is not replayed. Terminal End wins independently.

A lost initial read-only capability reply must not leave an expired local token blocking later explicit controls. Explicit controls can renew discovery when the association is unconfirmed and unsubmitted or expired. The lookup captures that exact prepared nonce. A fresh actual running/paused reply can retire only that matching stale candidate and cache the original control identity, allowing subsequent newly issued generic controls to use it. A newer same-ID token, different B, terminal End, changed owner/peer or superseding intent prevents stale replacement. This caches controls only; it never relabels a Watch session or sends a new Start/HealthKit launch.

## Compatibility and persisted fence

New phone with old Watch does not expand retry without a fresh positive protocol advertisement. Old phone with new Watch continues the nonce-less legacy Start/provisional path. Queued Start remains ignored. Strength/Mobility/indoor starts use legacy signatures. Expanded startup retry, original-tuple adoption and control-discovery paths require the current peer/capability and current intent. The distinct terminal `endRecording` is deliberately submitted immediately without capability wait; older Watch ignores it while the legacy End still executes. Inactive/deactivated/peer-reset paths clear capability authority. Epoch milliseconds remain `Double`/`Int64` safe on 32-bit Watch targets.

The Watch fence stores opaque transport identities, terminal recording IDs and clock bounds, without account IDs or health samples. The optional logical-end JSON field is backward compatible with earlier snapshots. Exact revocations remain for four hours plus five seconds, covering four-hour context acceptance and two-minute live Start acceptance. Exact attempt revocations and logical recording ends share at most 128 slots, never evict an unexpired entry, and fails closed on corruption, read/write failure, saturation or excessive clock rollback. Matching negative Start ACK exposes the failure through the existing `lastError`; stale N1 errors cannot replace B's status.

Persistent corruption has no automatic repair in this change. Reopening can retry a transient write failure, but a corrupt or unreadable persisted file can continue blocking fenced Watch startup. Phone recording remains available. Do not instruct deletion of app data as an automatic remedy or describe this as self-healing. Saturation deliberately blocks unsafe starts rather than dropping live revocations.

The authoritative optional-absence exception applies only after local terminal fencing: if there has been no submitted, acknowledged or launched Watch attempt for the requested ID and an activated session reports no paired Watch or no installed Watch app, native returns nil and the existing JS optional guard permits phone-only completion. A mere read-only token or allocated but unsubmitted message is not Watch participation. The terminal intent remains best effort, and its queue capacity cannot block this absent-counterpart path. An unsupported platform is also optional. Inactive flags remain unknown and throw; actual known attempts retain strict error/retry handling; paired-but-unreachable counterparts still receive OS-queued terminal End. This describes current platform absence, not proof that the recording never used a Watch. Apple documents pairing and install flags as valid only after successful activation. ([pairing](https://developer.apple.com/documentation/watchconnectivity/wcsession/1615665-paired?language=objc), [app installation](https://developer.apple.com/documentation/watchconnectivity/wcsession/iswatchappinstalled))

## Source provenance and validation

Base source: `5c2791110333cb413a809154035ad6ce5237b503`. Compared against `watch-working-build90` (`aee249649697a5b95b21791d3e9973c2d9affbd7`) as required by the platform council. That comparison includes pre-existing later sport/route and diagnostic additions; it is not attributed wholly to this patch. The preserved baseline is the HealthKit authorization/session/builder path, exact phone-provided identity, queued-Start ignore, legacy provisional flow and exactly-once completion. Focused baseline Watch tests verify those contracts.

Six production files in this agent scope are frozen (root separately owns the two manual-button caller edits, the guarded RecoveryPrompt Resume caller and their actual-caller regression test):

- `modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift`
- `modules/stride-watch-connectivity/src/index.ts`
- `src/components/watch/WatchWorkoutBridge.tsx`
- `src/lib/localDataOwner.ts`
- `targets/StrideOSWatch/StrideWatchWorkoutManager.swift`
- `targets/StrideOSWatch/StrideWatchStartFence.swift`

Three new focused test files are `watchStartFence.test.ts`, `watchStartLease.test.ts` and `fixtures/watch-start-harness.swift` under `scripts/tests/`. Baseline assertions in `watchWorkoutSync.test.ts` and `build90Features.test.ts` now pin the actual running case and legacy normal-start/launch/timeout members independently from explicitly fenced cancellation branches. Global assignment counts were not simply increased. Exact SHA-256 values are in the adjacent receipt, copied from the frozen temporary receipt and rechecked against current files.

The final single serial combined native/JS/baseline run passed 53/53, including the legacy build-90 baseline suite, actual phone-completion optional-Watch integration, nil-ID fallback and expired read-only lookup recovery. After final activation/OS-background-submission assertions, the actual-source Swift test passed again (1/1). Root separately reports 9/9 passing actual-caller AST integration tests in `scripts/tests/watchExplicitControls.test.ts`, covering manual-only exact-ID controls and the shared guarded Resume/Continue discovery path. The coordinator is extracted from production source and compiled/executed; actual Watch receive/start methods execute with synthetic HealthKit/transport fakes. JS tests execute the actual wrapper, extracted Bridge callback and actual owner boundary. These are meaningful ordering tests, not radio or physical HealthKit proofs.

The adversarial matrix covers:

1. Reachable cached true, async live failure, one forced HealthKit launch and one exact packet retry.
2. Idempotent prepare, early accepted ACK, exact global End, benign same-owner cleanup.
3. Owner cancellation before queued registration or delayed callbacks.
4. Stale ACK, old End, new nonce, cancelled launch completion, peer capability reset.
5. Old Watch capability opt-out, synchronous callback reentrancy, terminal negative ACK.
6. Cold activation queue, synchronous Stop before queued Start execution, pending Pause preservation.
7. Watch End-before-Start and Start-before-End, duplicate End saves once and cannot restart.
8. Stale authorization granted/denied, failure retires attempt, explicit genuine retry.
9. Hard revocation with actual Watch running preserves Health workout by existing End/save despite lost ACK/status.
10. Unknown provisional fresh-builder handoff, stale timeout, B pause survives A cancel, legacy provisional path.
11. Persistent exact revocation, four-hour context retention plus skew, corruption, saturation, rollback.
12. Lost ACK soft cleanup keeps exact control association; temporary unpaired End still fences locally.
13. Phone restart fresh matching capability recovers original exact nonce/session for End.
14. Accepted ACK then authorization denial permits explicit new-nonce Retry without automatic relaunch.
15. Late capability after terminal rejection and End/revoke; peer reset; newer logical B; pending old authorization.
16. Unpaired End retains obligation: late reply cannot submit, reconnect requests fresh exact ID, original End/save once.
17. Matching negative ACK visibly updates lastError; stale older failure cannot overwrite current attempt.
18. Cold RecoveryPrompt Stop with no prepare/Start: actual running, pending authorization, unpaired/reconnect, unrelated ID, new B and legacy fallback; no Start or Health launch.
19. Latest explicit Pause/Resume before recovery applies once to the original tuple; terminal End wins; a delayed old Pause failure cannot queue after a new Resume.
20. Immediate logical End before unknown in-flight N1 or prepared restart B, without any capability response; persisted relaunch, all same-ID attempts blocked, new UUID B allowed.
21. Exact N1 End/cancel preserves N2 retry; old optional JSON schema reads; combined exact/logical 128-slot saturation fails closed.
22. Offline logical End survives owner revocation and later reconnects before unknown Start.
23. Cold manual Pause/Resume without prepare: latest-only, live-only, End, owner, peer, new B, expiry and obsolete failure; generic automatic Resume never looks up or replays.
24. Actual Resume read-only prepare without Start: no generic replay, no new builder/HealthKit launch; future generic controls use original identity; missing capability remains unavailable.
25. Hour-old acknowledged association, benign cleanup, pruned discovery and temporary unpairing: unconditional terminal intent registration preserves exact-once End/save on reconnection.
26. Native intent saturation preserves exact cleanup retry, fences local Start and permits terminal retry after expiry; JS exact wrapper rejects while general End shows the error.
27. Activation-not-ready and both cold/selected transport failure propagate; activated terminal End enters OS transferUserInfo before success even when live.
28. Optional activated absence after no actual Watch attempt, including read-only token, unsubmitted message and full queue; known actual attempt or unknown activation still rejects cleanup for retry.
29. Actual JS wrapper plus actual Run cleanup: no Watch, no app and read-only Resume permit phone GPS/store/journal completion with no Start.
30. Omitted/null/empty explicit-control IDs immediately use legacy generic fallback, preserving nullable actual-callsite compatibility.
31. Lost read-only reply, 91-second expiry and manual Pause renew exact discovery; next generic Resume/Pause uses original actual tuple; no Start or new builder.
32. Late explicit capability cannot retire/cache over a captured-token replacement with a newer same-ID nonce, B or terminal End.

Exact validation commands:

```sh
./node_modules/.bin/tsx --test --test-concurrency=1 scripts/tests/watchStartFence.test.ts scripts/tests/watchStartLease.test.ts scripts/tests/watchWorkoutSync.test.ts scripts/tests/build90Features.test.ts
./node_modules/.bin/tsx --test --test-concurrency=1 scripts/tests/watchStartFence.test.ts
STRIDE_WATCH_SDK=$(xcrun --sdk watchos --show-sdk-path)
xcrun swiftc -typecheck -parse-as-library -sdk "$STRIDE_WATCH_SDK" -target arm64_32-apple-watchos10.0 -swift-version 5 targets/StrideOSWatch/StrideWatchWorkoutManager.swift targets/StrideOSWatch/StrideWatchHealthSetup.swift targets/StrideOSWatch/StrideWatchStartFence.swift
xcrun swiftc -frontend -parse modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift
git diff --check
git diff watch-working-build90 -- modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift targets/StrideOSWatch/StrideWatchWorkoutManager.swift
```

Actual recording core typecheck passed for `arm64_32-apple-watchos10.0`, using Xcode 16.4 (16F6), Apple Swift 6.1.2 (`swiftlang-6.1.2.1.2`, clang 1700.0.13.5), Watch SDK 11.5 and Swift language mode 5. Installed iPhone SDK reports 18.5. Full phone source frontend parse passed; the actual phone coordinator also compiled/executed in the Swift harness. Full phone Expo linkage has not been proved by parse alone.

A whole-Watch-UI local check encounters an unchanged `.toolbar` overload ambiguity under this older SDK. The actual recording core passed separately. Current cloud SDK compilation is the authoritative remaining native build check; this receipt does not waive it.

The installed `@bacons/apple-targets/build/with-xcode-changes.js` creates a `PBXFileSystemSynchronizedRootGroup` for the target directory and attaches it to the native target. Its normal membership exceptions are `Info.plist` and the target config. The new `StrideWatchStartFence.swift` resides directly in that synchronized Watch target directory and is not excluded, so CNG includes it without a manual project-file edit. This is source evidence of target inclusion, not a completed cloud-build receipt.

## Independent review and decision

The optional-Watch integration objection is resolved with the authoritative-absence exception below. No GPS or completion-library reordering was required. The actual JS wrapper and extracted actual Run cleanup execute the no-Watch/no-app/read-only-Resume paths through GPS stop, store completion and journal acknowledgement.

Platform implementer, independent UI/navigation reviewer and independent training/data-custody reviewer each voted **95/100 subjective confidence in the bounded source regression gate**, with no remaining P1 after the late-capability and unpaired cases. Both independent peers renewed their favorable 95/100 votes after reviewing the final logical-ID terminal fence, manual-only cold controls, read-only Resume identity lookup, unconditional terminal retention, strict transport/capacity failure handling and authoritative optional-absence exception. Both independent reviewers renewed favorable 95/100 source votes after the final nullable-ID and expired-readonly actual delta, matching phone `301af280...`, module index `2dc07be6...` and fixture `bb72d6fa...` against the adjacent full-hash receipt. No remaining reproduced source P1 was identified; final targeted validation is 53/53. Both peers reviewed actual source and matching hashes. They challenged early designs and required fixes for lost-ACK benign refresh, actual HealthKit custody on hard revocation, authorization-failure retry, scoped pending Pause, synchronous End, and restart End-before-capability ordering.

The vote favors an internal hardware-verification candidate only after root's integrated checks and current-SDK native compilation pass. The score is not a measured device reliability probability, physical acceptance or a claim that the reported crash is fixed.

## Unattributed crash and read-only diagnostics

The owner reported a phone crash around 08:49 PST on November 11 during a run; the phone later recovered the same activity via Resume Activity. The exact build-114 Apple crash-feedback query returned zero reports. App-wide feedback contained only two older-build reports. The diagnostic-signatures endpoint returned 404. Xcode Organizer showed No Crash Logs with broad recent filters, and no StrideOS crash report was found in inspected local Xcode/device-log locations. Devices were disconnected/unavailable during inspection. Zero returned reports does not disprove a crash.

Existing source has native Sentry crash capture disabled; this work did not enable it, add telemetry, permissions or dependencies. Build-114 cloud metadata exposed the app artifact/build logs, but no separate dSYM artifact was confirmed. No causal crash stack, jetsam report or exception has been obtained. The display telemetry cache correction is separately tested for bounded memory and persistence equivalence; it must not be called a proven crash fix.

## Physical verification still required

Use updated phone and Watch apps together and retain the manual-open fallback while gathering evidence. Verify phone-initiated outdoor Run with Watch app closed, permission pending/granted/denied then explicit Retry, and the formerly reachable-then-failed delivery path if a controlled device reproduction is available. Observe actual Watch recording rather than accepted ACK alone.

Run beyond the prior ten-minute incident while checking HR freshness, pause/resume/auto-pause, a temporary connection interruption and recovery. Missing or expired HR must remain missing. Confirm benign reconnection does not End the Watch workout; End/save must occur once with the same identity and no duplicated Health/app activity.

Verify phone process restart followed by Resume Activity preserves the original actual Watch session and exact Pause/End, including immediate Stop before any capability response or delayed old Start, manual Pause/Resume without pressing Retry, and temporary disconnected/unpaired delivery. Exercise owner sign-out/block separately to confirm pending authorization cannot start late and an already recording Watch workout is preserved through its existing End/save path. Do not use real-owner data crossover as a casual test.

Collect the actual phone crash/termination diagnostic if the incident recurs or the device becomes available. Root records integrated checks, cloud compile, any build/submission and destination verification separately. No physical acceptance is asserted by this handoff.
