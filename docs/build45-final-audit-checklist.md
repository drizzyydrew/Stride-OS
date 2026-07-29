# Build 45 — Final Fable Audit Checklist (final 10%)

Run after Codex completes Phase 12. Every item must pass (or be explicitly waived by the
user with rationale) before any release action. Items marked [device] require the physical
iPhone.

## 0. Pre-audit state
- [ ] Repo/branch/HEAD match Codex's final report; working tree contains only intended changes
- [ ] No commits were made; `git log -1` still shows `5a44753` (or the user's own commits only)
- [ ] `git diff --check` clean; no secrets in diff (scan tokens/keys)
- [ ] `app.json` diff limited to authorized plugin/infoPlist entries; buildNumber still 44; eas.json untouched

## 1. Architecture & schedule integrity
- [ ] `scheduledSessionIds.ts` formats unchanged (byte-level)
- [ ] One schedule authority: no new parallel schedule/analytics/adaptation system introduced
- [ ] Today/Calendar/Running/Strength/Activity/Coach resolve identical sessions — including after cross-week moves and adaptations (consistency tests + manual spot check)
- [ ] Planned vs completed still separate; duplicate completion still prevented
- [ ] Stress classifier is the single hard/easy authority (regex isHard removed/delegated)
- [ ] Deload logic consolidated to deloadModel; the four legacy call sites delegate

## 2. Migration & data safety
- [ ] Every store version bump has an idempotent migration; run twice → same result
- [ ] Selection-store override→ledger migration lossless (test + manual fixture)
- [ ] Simulated pre-Build-45 persisted state (readiness v4, adaptation v2, activity v2, legacy strength drafts) rehydrates without loss or invention
- [ ] All new Activity/strength/settings fields optional; old data renders correctly

## 3. Training intelligence correctness
- [ ] Decision engine: scenario table reviewed; no progress-by-calendar; no simultaneous multi-axis increase without rationale; rationale present on every non-maintain decision
- [ ] Deloads: 3+1 default, 4+1 alternative, 65–75% (70% default), early/delay/repeat/rebuild paths tested; post-deload resumes near prior high
- [ ] Quality eligibility: Week-1 guard; 7–10-day exposure logic; newer-runner ladder order; experienced re-entry
- [ ] Norwegian 4×4: all gates enforced; never time-elapsed-only; never in beginner foundation; never adjacent to hard lower-body
- [ ] Hard-day adjacency: acceptable/unacceptable matrix verified via axis overlap (not name matching); easy days not upgraded by accessory volume
- [ ] Strength periodization: phase mapping per plan type; volume falls as race specificity rises; no high-volume hypertrophy before key long runs; consolidation pattern (lower+quality then true easy) honored
- [ ] Readiness v4 actually feeds decisions; word-first UI untouched (no numeric 1–5 anywhere)

## 4. Prescriptions & eligibility
- [ ] Timed exercises show duration everywhere (plank 3×30s; grep test for banned "reps" rendering); distance/tempo/hold schemes render correctly; banks audited
- [ ] CompletedSet distance persists; summaries keep reps/hold/distance/external-load separate (no universal volume number)
- [ ] Continuous-run gate: explicit question present; <5K → encouraging alternatives (never a bare rejection); ≥5K → allowed

## 5. UI modes, Today, navigation
- [ ] Simple/Balanced/Data-rich affect the whole app per the mode matrix; default balanced; persisted
- [ ] Today: dominant card fields per spec; More Options groups exactly (Adjust today / Adjust the plan / Get help); "No plan changes today." absent (grep); change banner only on real change; no duplicated duration text
- [ ] Bottom nav: six tabs; identical wrapper/scale/label/baseline/spacing/padding/touch targets; AI Coach readable at 320px [device: also on-device]

## 6. Training Outlook & Stride Report
- [ ] Outlook derives status + load state from live data (placeholder constants gone — grep); updates on all specified triggers via recalculation; insufficient-history/data states honest; no unsupported race-ready dates
- [ ] Report math: distance trio; elevation trio with treadmill/missing-elevation EXCLUDED from averages (fixture test); weekly-only forward look; monthly/yearly retrospective; not overloaded
- [ ] Sharing: exactly three designs; 9:16 / 4:5 / square; privacy defaults verified (no routes/locations/symptoms/readiness/notes/health data in payload builder test) [device: snapshot + share sheet]

## 7. Search, gear, achievements
- [ ] All specified filters work incl. classification states; search performant on large history (FlatList virtualization confirmed)
- [ ] Shoe mileage derived (edit/delete recomputes); most-used shoe correct; no "unsafe" mileage claims (copy audit); equipment model present with BLE linkage field
- [ ] Achievements: healthy set only; no rankings/feeds/percentiles/shame-streaks/rest-punishment (copy audit)

## 8. Voice coaching [device]
- [ ] Pipeline states implemented (played/queued/suppressed/cooldown/failed/unavailable) with log store
- [ ] Categories correctly tagged at every emit site; relevance filtering per activity; levels behave per matrix
- [ ] Test Voice Coaching button reports true delivery state
- [ ] [device] Audible during a real run with music playing (ducking), silent-switch behavior defined, interruption recovery, background delivery

## 9. Live Activities [device]
- [ ] workoutInstanceId threaded through contract + command matching; every start creates a fresh activity; clearing one never blocks the next (regression test + device check)
- [ ] Per-type layouts show only pertinent metrics (treadmill shows estimate label, never GPS pace)
- [ ] [device] Lock screen + Dynamic Island for run/treadmill/run-walk/intervals/walking/cycling/strength/custom/mobility variants; no clipping at minimum sizes; controls round-trip

## 10. Bluetooth [device]
- [ ] Parsers fixture-tested (FTMS treadmill/bike, HR, RSC, CSC w/ rollover, power incl. malformed frames)
- [ ] Arbitration: preferred source, staleness, dropout, manual fallback, source metadata on every value
- [ ] Honesty: no HR→distance, no power-alone→distance, estimates never labeled measured (invariant tests)
- [ ] `npx expo prebuild --platform ios --no-install` succeeds with plugins
- [ ] [device] Scan/pair/reconnect per profile; mid-workout dropout handling; arbitration switchover; gear linkage
- [ ] Web/Expo Go: feature honestly unavailable, no crash

## 11. AI Coach
- [ ] New sections priority ≥ 8, non-required, compact-capable; budget tests prove ≤ 4500/5000 envelope with all sections present; coach output sane with new context

## 12. Validation gates
- [ ] `npm run typecheck` clean
- [ ] `npm test` — full suite green (record count vs 411 baseline)
- [ ] `npx expo export --platform web` green; `npm run expo:check` green
- [ ] Browser QA doc complete: 320/375/390/430/desktop × all touched screens incl. new ones; persistence-after-refresh verified
- [ ] Swift edits parse (`swiftc -parse`) and full native build succeeds (EAS step below)
- [ ] Regressions: previously accepted features spot-checked (treadmill flow, indoor ride, custom strength, adaptation preview, readiness check-in)

## 13. Release actions (only after ALL above + explicit user authorization)
- [ ] App Store Connect check: Build 44 submission state resolved; 45 confirmed unused
- [ ] Staged-file audit: `git add` list reviewed file-by-file; nothing unintended
- [ ] Bump `ios.buildNumber` → "45"; rerun typecheck/tests/export after bump
- [ ] Commit "StrideOS Build 45 — …" (accurate scope summary); push to origin
- [ ] `eas build --platform ios --profile production`; record build ID + commit hash match
- [ ] [device] Install the EAS artifact; execute the device items above on THIS artifact
- [ ] `eas submit --platform ios --id <exact-build-id>` (the verified artifact only)
- [ ] Record submission in docs ("docs: record Build 45 TestFlight submission" pattern); update memory

## Build 46 correction-pass audit addendum (2026-07-29)

- [x] Repository path verified: `/Users/drew/Documents/StrideOS_App_clean_build19_v3_foundation`
- [x] Branch verified: `build-19-v3-foundation`
- [x] Starting HEAD for this correction pass: `2e6c9543f35d31146334eace854767ff2213b9bc`
- [x] Build 45 confirmed already released in history; Build 46 is the target.
- [x] EAS iOS build history compact query: latest 30 builds returned `build46: []`; latest was Build 45, `11298b8b-0fbb-4d72-9b55-8d57e11b1f0d`.
- [x] App version remains `1.0.0`; iOS buildNumber bumped to `46`.
- [x] `expo config --type public` confirmed bundle identifier `com.mooremovement.strideos`, version `1.0.0`, buildNumber `46`.
- [x] Typecheck passed.
- [x] Full tests passed: 487/487.
- [x] Web export passed: 117 static routes.
- [x] `expo:check` passed.
- [x] Clean CNG iOS prebuild passed after the build-number bump.
- [x] `git diff --check` passed.
- [x] Diff secret scan found no likely credentials.
- [x] Generated `dist/` and `ios/` output remained ignored and unstaged.
- [ ] Production Build 46 EAS build started, finished, and exact artifact verified.
- [ ] Exact Build 46 artifact submitted to App Store Connect/TestFlight.
- [ ] App Store Connect/TestFlight processing result recorded.
