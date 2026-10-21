# Selected Apple Health Workout Recovery - Build 97

Status: candidate under verification, October 21, 2026. Continues the outstanding request to correct the unavailable race and deliver the correction through TestFlight. Actual recovery on the phone remains unverified.

## Evidence And Limits

- After build 96, the user showed Health read progress reaching 1,486/1,486, then another unavailable Activity screen. No restore-completion confirmation or failing route ID has been supplied. A clarification question is outstanding. These screenshots do not prove that the save stage completed or identify the original failure.
- Read progress completes before the restoration service starts committing activities. Existing full-history restoration performs a full-history persistence/readback per row; new rows also trigger per-row recalculation. This has cumulative quadratic cost. This patch does not claim to solve bulk-history scalability.
- The unavailable screen previously offered only local retained-run recovery, with instructions to repeat full Health restoration. It could not select a specific Health workout directly.
- Reproducible edge case: an already-imported exact Health UUID can lack old-link aliases. Add-only restoration preserves that edited row, so a successful restore need not repair an old unknown link. This is not a proven diagnosis of the user's phone.

## Scoped Correction

- Add **Find workout in Apple Health** directly to the unavailable Activity screen. Keep **Restore from this phone** explicitly local. Do not direct a failed local attempt back to another ten-year scan.
- List up to 250 recent supported workouts from the past 30 days or past year using metadata only: no route or statistic calls while listing. Date/time, duration, distance and source identify the choice for the user, not for an automatic match.
- Require confirmation for the selected workout, including consent to restore a previously removed entry. Fetch only its exact native UUID, without a date predicate. Validate UUID syntax before the native bridge, which otherwise discards an invalid UUID predicate. Reject missing, multiple or mismatched responses and changed source identity.
- Capture owner, deletion revision and request/route generation before awaits. Check these at the queued mutation boundary and after persistence. Close, unmount and route changes invalidate stale requests and confirmations.
- Use the existing add-only durable commit. Preserve edited existing records and return their actual canonical ID, including a same-UUID row with no old-link aliases. Do not bind the unknown old link by date, distance, schedule or proximity. Do not claim existing records were enriched when add-only preserved them unchanged.
- Keep pending/failed-save recovery reachable even if a new in-memory row resolves the old alias before persistence completes. Navigate only after the durable canonical result.
- Full-history restoration now reports a separate **Saving workouts** phase; reading 100% is not labeled save completion. Bulk batching and schema/storage changes remain separate work.
- No native Watch/transport/completion, dependency, earning-rule or power-model changes. No Health records are modified. Test data is synthetic; no personal recording IDs or biometric totals are published.
- Additive user request: fixed badge-only exports through both achievement sharing entry points, using unchanged canonical artwork and the StrideOS wordmark. Remove movable badge layers, repeated headings/titles and footer targets. App navigation remains unchanged. See `badge-share-build97/REVIEW.md` for scope and browser QA.

## Review And Verification

- Independent Platform and Contrarian/Data Custody reviewers cross-examined the design and actual diff. They identified the missing route-change fence and an unreliable zero-statistics assertion; both were corrected. Both report source GO, conditional on final verification, not device recovery.
- Targeted service, native-adapter and UI harness tests cover explicit selection, zero route/statistic list reads, exact UUID filtering, canonical edited records, stale owner/request/deletion fences, route changes, failed-save retry, early publication and saving-phase progress.
- Final full suite: 1,029/1,029 passed, zero failures/skips (`/tmp/strideos-build97-tests-final.log`). Semantic typecheck, clean iOS prebuild and final iOS Hermes export passed. Existing prebuild advisories about the pinned React Native version and optional expo-system-ui remain unchanged; no dependency upgrade is included.
- Both independent reviewers report scoped badge-share source GO after the second exporter and rounded capture wrapper corrections. Browser visual/geometry evidence and native-export limits are recorded separately in `badge-share-build97/REVIEW.md`.
- Signed artifact and Apple processing checks are pending.
- Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`; branch `build-19-v3-foundation`. Latest EAS build was 96 before selecting 97.
- App version 1.0.0 (97), bundle `com.mooremovement.strideos`; EAS project `f32ed63a-a22a-4360-8b1d-3ed4d2c329d9`; ASC app `6782788130`. Existing production signing/profiles retained.

## Device Acceptance

1. Update through TestFlight without uninstalling or changing accounts.
2. On the unavailable Activity screen, tap **Find workout in Apple Health**, not the local-phone restore action.
3. Select the original race using its Health date/time, duration, distance and source; confirm restoration of that selected record.
4. Verify the opened canonical activity, original measured totals and any actual available route. If an existing edited row was preserved, its current fields remain unchanged.
5. Restart StrideOS and reopen the activity from Activity. Repeat selected recovery and confirm one canonical entry, not a duplicate. An unknown old link may remain unresolved; no guessed mapping is created.

Physical-device Health recovery and visual layout remain unverified until tested on the phone. A signed build or TestFlight acceptance must not be reported as proof that the race has been recovered.
