# Health Distance Splits Follow-Up

Status: source implemented and verified locally, October 21, 2026. The user explicitly authorized submission with "Submit" after the local verification report. Preparing version 1.0.0 (99) for commit, push and TestFlight submission. Installed build 98 remains the latest confirmed released binary until the release receipt below is completed.

## Athlete Evidence

The user confirmed that build 98 opens the recovered Rome race. A subsequent screenshot shows GPS-gap split paces for miles 11, 12 and the final partial mile, with heart rate still present. Route-derived splits sum to about 13.4 miles, while the earlier Apple Health screenshot reported 13.1 miles. The user says Apple has the full workout and splits. This is reported device evidence, not access to the underlying private Health samples.

## Findings And Scope

- Current outdoor splits use geodesic GPS distance, not the workout's Health distance intervals. They intentionally withhold pace across discontinuities. Route reads were capped at 2,000 observations before analysis. These mechanisms are confirmed in source; neither proves which native samples are available for this specific race.
- Selected-workout reads now query all distance samples through the installed bridge's supported `limit: 0`, with the exact native workout proxy predicate and requested meter unit. Metadata-only lists and bulk restore do not fetch every distance stream. Require the workout source bundle, exclude manual samples, collapse identical sample UUIDs and reject conflicting IDs or invalid intervals. No date-only sensor query.
- Health distance evidence has its own original UUID/source/time/totals, retrieval timestamp, version, sample provenance and native pause events. It survives Activity sanitization and manual edits without rewriting the athlete's summary. No schema migration is necessary for the additive optional field.
- A dedicated split builder validates provenance, time/active coverage, pauses, overlapping intervals, missing intervals, total-distance agreement and resolution. Any unknown cumulative offset withholds the timeline rather than numbering later miles as reliable. No GPS fallback after Health evidence is present, no proportional route scaling and no invented GPS or heart-rate samples.
- Boundaries inside accepted distance intervals are linear estimates, not official Apple split timestamps. The conservative interval limit is 30 seconds, not an Apple guarantee. The result retains boundary/duration uncertainty; the UI labels accepted results `Health distance-derived` with approximate boundaries. Coarse or incomplete evidence remains explicitly unavailable even when Apple Fitness can display its own splits. The installed bridge has no quantity-series query API for finer underlying observations.
- New selected imports retain original returned route observations subject to explicit point/serialized-size limits. Existing activity refresh does not read, replace or extend the original phone/Health route. Bulk restore retains its existing display-thinned behavior.

## Existing Race Refresh

The resolved Activity page adds `Refresh splits from Apple Health` for linked running, walking, hiking and cycling records. It is user-triggered, single-flight, focus/unmount fenced and reports durable errors. It does not require a route read.

The service targets the activity's existing Health UUID/source, then commits only distance-analysis evidence against the latest exact activity row. Preserve summaries, manual corrections, sensor streams, phone pauses, route, canonical ID, training links, load and creation time. Do not insert an activity, run completion again or recalculate training load. Reject duplicate/contradictory identity claims, missing rows, owner changes, deletion and cancellation; confirm persistence through the existing bounded durable readback queue. Less, conflicting or older evidence and changed/disappearing known Health totals/time context cannot overwrite prior evidence.

An in-flight write may already be durable when cancellation/readback fails. Report not confirmed, never promise rollback or that no write occurred. Retry operates on the same row and cannot create a second completion.

## Verification

- Full serial suite: **1,102/1,102 passed**, zero failures/skips. Receipt: `/tmp/strideos-health-splits-final-tests.log`.
- Semantic typecheck: passed. Receipt: `/tmp/strideos-health-splits-final-typecheck.log`.
- iOS Hermes export: passed. Receipt: `/tmp/strideos-health-splits-export.log`; output `/tmp/strideos-health-splits-ios-export`, bundle `entry-54056ee6f3778a23859cb08c70956ec4.hbc`.
- Independent platform and custody reviewers issued source GO after cross-examining interval uncertainty, stale/conflicting prior context, route-independent refresh and exact-ID preservation. Focused coverage includes actual adapter/service/store/readback, concurrent edits, deletion, owner changes, cancellation, failed save and retry, duplicate claims, no route reads, and source-quality rejection.
- `git diff --check` passed. No native Watch/startup/transport, badge artwork, dependencies, signing or app-name changes in this follow-up.
- Release preparation for build 99: clean iOS prebuild passed; generated phone plist is `StrideOS`, version `1.0.0`, build `99`; Watch and Live Activity generated build settings are `99`; all 22 native-target contract tests passed (`/tmp/strideos-build99-prebuild.log`, `/tmp/strideos-build99-native-contracts.log`). Expo project, bundle identifiers and signing configuration are unchanged.
- No physical-device Health read, native archive or Rome split parity verification performed. No athlete data was invented, modified in Apple Health or committed as a fixture.

## Acceptance On A Future Build

Update without uninstalling. Open the already recovered race, tap `Refresh splits from Apple Health`, wait for durable confirmation and inspect the split source/quality message. Verify Health-derived distance, complete mile count and final partial distance against Apple. Check notes/totals/links remain unchanged and retry creates no duplicate. Restart and reopen the same race to verify persistence. If evidence is withheld, record the exact quality reason instead of repeating bulk history restore or manually guessing split times.
