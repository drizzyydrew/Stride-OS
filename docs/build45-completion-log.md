# StrideOS Build 45 Completion Log

## Phase 7 Web QA Environment Limitation

Status: conditionally satisfied by substituted evidence.

Evidence:

- A clean Expo sample reproduced extreme Metro web transform latency on this machine. The sample dev-server bundle request timed out after 60 seconds and later logged a web bundle completion after roughly 514 seconds.
- Localhost networking was healthy. A local Python HTTP server returned `200 OK`, and browser command-line access could retrieve simple localhost HTML.
- Expo Router route registration was healthy. StrideOS dev-server route output registered the expected application routes, including `/more` and `/more/gear`.
- StrideOS production web export passed before the waiver and generated the expected static route artifacts.
- Static exported routes and JavaScript bundles served successfully from the production export.
- Automated browser execution was unavailable or unreliable on this machine: Playwright had no installed bundled browser, the Browser plugin had no browser available, Chrome headless was unreliable on Expo app execution, and Safari WebDriver session creation timed out.

Decision:

- Do not redesign StrideOS, Metro, Expo Router, or the web architecture to compensate for this machine-specific Expo Web development-server latency.
- Use production-export artifacts, static route verification, source-level browser-safe rendering tests, and native-safe fallback review for remaining middle-80% phases.
- Do not claim browser visual validation without working-browser evidence.

Remaining visual interactions for Fable/native validation:

- Full interactive visual pass in a working browser or native build.
- Any native-only share, voice/audio, Live Activity, Lock Screen, Bluetooth, permission, background execution, and lifecycle behavior.

## Phase 10 Native Bridge Decision

Status: implemented through the safe fallback path.

- The planned positional-to-dictionary Swift bridge refactor was intentionally deferred because the existing positional bridge is already live and release-sensitive.
- Phase 10 instead threads explicit `workoutInstanceId` through the TypeScript Live Activity payload contract while preserving `sessionId` compatibility for the existing native bridge.
- Per-activity Live Activity metric/layout selection is centralized in a pure module and covered by tests.
- The existing Swift widget sizing discipline remains in place (`minimumScaleFactor`, compact metric cells, one compact action row) and still requires device validation by Fable.

## Phase 11 Native Prebuild Note

Status: clean CNG prebuild satisfied; local reused-project path is not used as release evidence.

- `npx expo prebuild --platform ios --no-install` against the existing ignored local `ios/` tree failed in `@bacons/apple-targets` while updating an already-present `StrideRunLiveActivity` target (`removeFromProject` was undefined).
- The normal CNG path for Expo Apple targets is a clean prebuild. Running `npx expo prebuild --platform ios --no-install --clean` regenerated the ignored `ios/` tree and finished successfully.
- No tracked native project files are committed from `ios/`; release validation should continue from a clean CNG/EAS generation path.

## Final Fable Audit (2026-07-26)

Independent re-validation: typecheck clean; tests 475/475 (474 from Codex + 1 final-audit
regression test); web export 115 routes; expo:check clean; `git diff --check` clean; clean CNG
prebuild (`--clean`) passed independently; secret scan clean; app.json diff limited to the
authorized expo-audio + react-native-ble-plx plugin entries; eas.json and buildNumber untouched
by the middle 80%.

Defect found and fixed during the audit: the consecutive-day validator checks
(`consecutive_hard`, `recovery_spacing`) fired on hard classification alone, wrongly flagging the
explicitly-acceptable "hard upper-body strength followed by intervals/hills/4×4" pairings. Fixed
via `hasOverlappingHardStress` in `src/utils/sessionStress.ts` (leg = lower-muscular ⊕ impact as
one shared system; cardio/neuromuscular/upper overlap at high intensity) and axis-overlap gating
in `validateAdaptationSchedule`. All Build 44 validator tests still pass; new regression test
covers the full acceptable/unacceptable adjacency matrix from the product rules.

Training-quality audit: generated and inspected real plans for beginner/intermediate/experienced,
half and marathon race prep, hybrid, deload week 4, return week 5, taper, high-ACWR, and a
couch-to-half run/walk plan (weeks 1/4/8). Plans are credible: no week-1 quality, beginners never
receive VO2/hills, hard days spaced with rest days, deload weeks visibly reduced, taper preserves
only strides, beginner recovery every 4th week with conservative long-session growth.

Browser visual QA completed with real screenshots (see build45-web-qa.md final-audit addendum).
Web-only cosmetic finding: bottom-tab labels ellipsize on react-native-web (native font
auto-scaling is a no-op on web) — device confirmation required, not release-blocking.

Release decision: PASS at ≥95% confidence, conditional on post-upload device QA for voice audio
(ducking/silent switch/interruption), Live Activity & Lock Screen sizing per activity type, and
BLE hardware behavior (scan/pair/stream/dropout/reconnect/arbitration) — none of which can be
physically exercised before TestFlight on this machine.

## Release record

- Release commit: `4a3c3253e1fc0994aa26ce7d768b33106113a777` — "StrideOS Build 45 — adaptive periodization, Stride Report, coaching, and connected equipment"
- Pushed to `origin/build-19-v3-foundation`; local HEAD verified equal to remote HEAD
- App version 1.0.0, iOS buildNumber 45 (bumped from 44 only after EAS history confirmed 45 unused)
- EAS build: `11298b8b-0fbb-4d72-9b55-8d57e11b1f0d` — platform IOS, profile production, status FINISHED,
  appVersion 1.0.0, appBuildVersion 45, gitCommitHash `4a3c325…` (exact release commit)
- Artifact: `https://expo.dev/artifacts/eas/ALR8edPNK5b_S6Ap4QCyCCxhlZPUiFFW6NkjksTiigg.ipa`
- TestFlight submission: `42cc9ceb-c2c5-40be-9801-10a60758db19` — upload to App Store Connect succeeded;
  Apple-side processing was still pending at submission time (processing/export-compliance state must be
  confirmed in App Store Connect)
- Exactly one Build 45 EAS build was created; no duplicates; Build 44 was not resubmitted
