# Build 37 Post-Build 36 Stabilization Log

Date: 2026-07-16  
Build target: next iOS release after Build 36  
Status: automated implementation and validation complete; physical-device acceptance remains pending

## Baseline

- Canonical repository: `/Users/drew/Documents/StrideOS_App_clean_build19_v3_foundation`
- Branch: `build-19-v3-foundation`
- Canonical Build 36 release commit remains in history: `bc75f40`
- Build 36 EAS build `87185aa7-bcc0-44a2-9ea1-3bfd22599c15`: finished
- Starting checkout was clean but already pointed to committed Build 37 work at `0526d81`, with iOS build number 37. That inherited state was preserved and not amended.
- Read-only EAS history confirmed Build 37 was already consumed by finished iOS build `16354be1-a181-4953-82f5-b9eae9b93a18`; the next authorized iOS build must therefore be Build 38.
- No commit, push, EAS build, TestFlight submission, branch switch, reset, clean, stash, or build-number change occurred.

## Completed checklist

- [x] Created and indexed Skill 08 — StrideOS Autonomous Execution Agent.
- [x] Rebuilt Movement Lab capture around front-camera live setup, repeatable camera switching, explicit capture start, countdown, safe interruption, metadata, and review.
- [x] Accepted valid older and iCloud-backed videos with stable staging, retry, and media validation.
- [x] Corrected anatomical hip flexion/extension convention and evidence-safe display.
- [x] Centralized view/movement permissions, closest-side filtering, raw/effective saved data, legacy display migration, overlays, charts, key frames, and Coach context.
- [x] Added locked marker editing and exclusive scrub/marker gesture ownership.
- [x] Centralized AI Coach prompt budgeting under the 5,000-character hard limit.
- [x] Added non-destructive route actions, detach/reverse/reattach persistence, and keyboard-safe route naming.
- [x] Integrated the full hydration/fueling planner, sweat-rate and sweatiness distinction, carb tolerance, corrected units, weather override, and persisted inputs.
- [x] Added separate one-minute hydration and fuel voice-reminder intervals with merged cues and pause/resume duplicate protection.
- [x] Added persistent Strength Preset detail, execution, RPE/load, completion feedback, history, and Live Activity flow.
- [x] Unified Training Block and Preset active-session ownership with explicit conflict handling.
- [x] Moved Morning Readiness Reminder to Notifications settings with daily/weekdays/custom schedules, startup migration, duplicate-safe rescheduling, and permission recovery.
- [x] Created 18 high-fidelity prototype images and completed screenshot QA.
- [x] Created a normalized 141-entry exercise inventory and resolution tests.
- [x] Created the physical-device checklist and product-decision record.
- [x] Preserved all approved Dion PNGs and Movement Lab manifests.

## Files changed

- Product screens: Coach, Dashboard, Movement Lab analyze/readiness/video analysis, Settings, Strength, Training hydration/run/route screens, root startup.
- New Strength screens: preset detail, active preset session, preset completion.
- Shared UI: timed camera, angle chart, scrubber, marker editor, accessible picker wheel, recommendation/override copy.
- Stores/contracts: movement, route, hydration, integrations/notifications, strength history, active strength session, movement/strength/recommendation types.
- Logic: capture workflow, media import/validation, anatomical pose geometry, sequence analysis, measurement matrix, AI prompt budgeting, route attachment, hydration engine, run reminder scheduler, speech queue, notification schedules, strength/training/analytics evidence language.
- Tests: camera, media, hip geometry, view filtering, AI prompt budget, route attachment, hydration/fueling, notification migration, strength preset/session ownership, inventory, scrub gestures.
- Documentation: Skill 08, product decisions, screenshot QA, physical-device checklist, prototypes, exercise inventory, measurement rules, this log.
- Dependency alignment: Expo SDK 56 package versions and lockfile were aligned with `expo install --fix`; no new implementation dependency was required.

## Executive decisions

- Raw Movement Lab landmarks and bilateral raw sequence material are retained; athlete-facing values are materialized separately through the view/closest-side contract.
- Hip sagittal output has one stable measurement identity and renders flexion or extension by anatomical direction instead of negative flexion.
- One persisted active-strength contract owns either a Training Block Workout or Preset Workout and therefore the single Strength Live Activity.
- Reminder timing uses active elapsed run time rather than wall-clock time, preventing pause/resume duplicates.
- Morning-reminder migration runs after persisted stores hydrate at app startup and does not trigger an unsolicited permission prompt.
- Existing 45-degree persisted movement values remain readable only as an unsupported legacy/unknown view; no 45-degree capture option or measurement approval exists.

## Verification

- `npm run typecheck`: passed.
- `npm run test`: passed, 92 tests, 0 failures.
- `npm run expo:check`: passed, dependencies up to date.
- `git diff --check`: passed after correcting one trailing-space finding.
- iOS Metro export: passed, 2,903 modules, 8.2 MB Hermes bundle.
- Lint: no lint script is configured in `package.json`.
- Static sweeps: no Apple Music/MusicKit app-source references; no 45-degree capture option; no combined `Lunge / Single-Leg` label; no hydration `/h` unit; no unsupported certainty in Movement Lab; no negative hip-flexion display; no user-facing `Adaptive Workout` terminology.
- Dion: all 32 production movement PNGs resolved in tests/export, plus three canonical reference PNGs. No PNG or manifest was modified.
- Visual QA: 18 prototype PNGs rendered with production tokens and reviewed for clipping, overlap, hierarchy, destructive-action separation, and affordance integrity.

## Limitations and device-only risks

- Native camera remount timing, repeated front/rear switching, AppState interruption, phone lock, and incoming-call behavior require physical iPhone validation.
- Front-camera preview/save mirroring and anatomical left/right confirmation require real captured media.
- iCloud latency/offline retry and temporary asset lifetime require device testing.
- Voice cues while iOS fully suspends the app cannot be guaranteed; resume state and duplicate prevention are implemented.
- VoiceOver rotor behavior, large Dynamic Type, keyboard safe areas, marker gestures, nested scrub gestures, notification permission recovery, and Live Activity updates require device validation.
- Dependency audit reports transitive vulnerabilities; no force upgrade was applied because that would exceed this stabilization scope and may introduce breaking dependency changes.
- The current checkout intentionally still says build 37 because build-number changes were prohibited in this task. Increment to 38 only after physical-device acceptance and explicit release authorization.

## Confidence

Automated implementation confidence: 96%  
Release-readiness confidence before physical-device execution: 93%

The patch is not labeled release-complete until the physical-device checklist is executed and the remaining device-only evidence is reviewed by the release approver.
