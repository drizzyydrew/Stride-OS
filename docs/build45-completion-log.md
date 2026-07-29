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

## Build 46 correction-pass addendum (2026-07-29)

Target release: StrideOS Build 46. App version remains 1.0.0; iOS buildNumber was changed from 45 to 46 only after EAS iOS build history confirmed no Build 46 artifact in the latest 30 iOS builds. Latest EAS iOS production builds before the bump were 45 (`11298b8b-0fbb-4d72-9b55-8d57e11b1f0d`, commit `4a3c3253e1fc0994aa26ce7d768b33106113a777`), 44, 43, 42, and 41.

Implemented correction scope:

- Light-theme semantic color tokens were strengthened without changing the dark identity. Measured light ratios include `primary #6F513A` on `#EFE7DA` 5.87:1, `textMuted #5F6B68` on `#EFE7DA` 4.52:1, `warning #7A5A28` on `#EFE7DA` 5.15:1, `critical #8A332D` on `#EFE7DA` 6.60:1, and selected surface `#E4D5C5` against muted text 3.86:1.
- Today now places Weather/AQI directly under greeting; More Options is a visible button and opens collapsed Adjust Today, Adjust the Plan, and Get Help disclosure buttons.
- Daily check-in uses picker wheels for sleep quality, body, energy, stress, and training factor; Other reveals editable text only after selection.
- Running Active idle layout uses natural ScrollView flow, preserves selected ScheduledSession visibility, separates Start Run from Log Completion, and opens a canonical workout detail route.
- Activity manual logging supports date, start time, local time zone, shoe selection, and a visible Refresh Training Plan action.
- Training Paths user copy replaces goal-plan preset wording while preserving the adaptive engine and faster-than-recommended acknowledgment flow.
- Performance Forecast is restored as a separate dynamic Today section with confidence/limitations info buttons.
- Healthy Progress taxonomy expanded to sustainable, noncompetitive awards with dedupe plus optional supporting activity/session IDs.
- Gear supports optional local shoe images from camera/library, replace/remove controls, fallback shoe artwork, and a horizontal visual catalog.
- Half-Kneeling Hip Flexor Stretch is duration-based (`2 × 30s per side`) with `Gentle stretch, no pain`; static-stretch validation rejects reps, strength tempo, and load progression.
- Strength Volume Summary separates repetition work, timed holds, distance work, and loaded volume; no universal total volume is shown.
- Paired interval-unit helpers and hundredths distance composition were added for track-friendly display and exact picker value composition.

Validation:

- `PATH=/usr/local/bin:$PATH npm run typecheck`: PASS.
- `PATH=/usr/local/bin:$PATH npm test`: PASS, 487/487.
- Focused Build 46 tests: PASS, 25/25 in `scripts/tests/build46Corrections.test.ts`.
- `PATH=/usr/local/bin:$PATH npx expo export --platform web`: PASS, 117 static routes.
- `PATH=/usr/local/bin:$PATH npm run expo:check`: PASS, dependencies up to date.
- `PATH=/usr/local/bin:$PATH npx expo prebuild --platform ios --no-install --clean`: PASS after Build 46 config bump.
- `git diff --check`: PASS.
- Secret scan over diff for key/token/password/private-key patterns: no matches.

Visual QA note: no new browser/simulator screenshot pass was completed in this correction pass before commit. Current evidence is automated/source/static-export validation plus the prior Build 45 browser QA record. Native behaviors still requiring TestFlight or device validation: voice audio delivery/silent switch/interruption, Live Activity/Lock Screen sizing and controls, BLE scan/pair/stream/dropout/arbitration, HealthKit/location permission prompts, background lifecycle, camera/library shoe-photo flows, and share-sheet flows.
