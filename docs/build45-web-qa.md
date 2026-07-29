# StrideOS Build 45 Web QA

## Web QA Environment Limitation

Status: Phase 7 browser-QA gate is conditionally satisfied through substituted evidence.

Evidence:

- Clean Expo sample reproduced extreme Metro web transform latency on this machine: the sample web bundle request timed out after 60 seconds and later completed after roughly 514 seconds.
- Localhost networking was healthy: simple localhost HTTP served and returned `200 OK`.
- Expo Router route registration was healthy: StrideOS dev-server route output registered expected routes including `/more` and `/more/gear`.
- StrideOS production web export passed and generated static route artifacts.
- Static exported routes and bundles served successfully from `dist/`.
- Automated browser execution was unavailable or unreliable on this machine: Playwright had no bundled browser installed, the Browser plugin had no browser available, Chrome headless was unreliable for the Expo app, and Safari WebDriver session creation timed out.

Decision:

- Do not redesign StrideOS, Metro, Expo Router, or web architecture to compensate for this machine/tooling-specific blocker.
- Use production export, static route verification, browser-safe source tests, and native-safe fallback review as substituted middle-80% evidence.
- Do not claim interactive browser visual validation without a reliable browser.

## Substituted validation performed

- `npx expo export --platform web` completed successfully during the remaining phases.
- `dist/_expo/.routes.json` exists and is non-empty.
- 115 exported HTML route artifacts were generated.
- Static artifacts for the new/changed Build 45 routes were present:
  - `/more/gear`
  - `/more/stride-report`
  - `/coach`
  - `/training`
  - `/training/route-builder`
  - `/training/run-tracking`
  - `/activity`
  - `/activity/indoor-ride`
  - `/strength`
  - `/calendar`
  - `/dashboard`
  - `/settings`
- Source-level browser-safe contracts cover:
  - web fallback for share-card generation
  - web fallback for Bluetooth manager availability
  - bottom-tab sizing constants and route registration
  - Coach prompt budget and compact optional context sections

## Screen and width matrix

The following screens still require true visual/browser review at 320 px, 375 px, 390 px, 430 px, and desktop width. Static export verifies that their route artifacts exist; it does not verify layout, gesture behavior, or rendered viewport screenshots on this machine.

| Screen / route | Static export | Browser-safe source tests | Interactive visual status |
|---|---:|---:|---|
| Today / Dashboard (`/dashboard`, `/(tabs)/dashboard`) | yes | yes | not visually verified |
| Calendar (`/calendar`, `/(tabs)/calendar`) | yes | yes | not visually verified |
| Running (`/training`, `/(tabs)/training`) | yes | yes | not visually verified |
| Route Builder (`/training/route-builder`, `/(tabs)/training/route-builder`) | yes | yes | not visually verified |
| Run Tracking (`/training/run-tracking`, `/(tabs)/training/run-tracking`) | yes | yes | not visually verified |
| Strength (`/strength`, `/(tabs)/strength`) | yes | yes | not visually verified |
| Activity (`/activity`, `/(tabs)/activity`) | yes | yes | not visually verified |
| Indoor Ride (`/activity/indoor-ride`, `/(tabs)/activity/indoor-ride`) | yes | yes | not visually verified |
| AI Coach (`/coach`, `/(tabs)/coach`) | yes | yes | not visually verified |
| More (`/more`, `/(tabs)/more`) | yes | yes | not visually verified |
| Gear (`/more/gear`, `/(tabs)/more/gear`) | yes | yes | not visually verified |
| Stride Report (`/more/stride-report`, `/(tabs)/more/stride-report`) | yes | yes | not visually verified |
| Settings (`/settings`, `/(tabs)/settings`) | yes | yes | not visually verified |

## Interactions not visually verified in this environment

- Bottom-tab layout and label wrapping at 320/375/390/430/desktop.
- Today simple/balanced/data-rich mode presentation.
- Gear registry pairing fallback UI flow.
- Activity search/filter controls.
- Stride Report period switching and share-card previews.
- Voice Coaching settings test button behavior.
- AI Coach chat/send/error states with the added compact context.
- Route Builder interactions and route detail transitions.
- Run Tracking live-mode UI.
- Treadmill, indoor cycling, and custom strength live logging flows.

## Fable final-audit requirements

Fable must validate these later through a working browser or native build:

- Interactive browser visual QA across the required widths.
- Native voice/audio behavior, including silent switch, ducking, interruption, and Test Voice Coaching.
- Live Activity and Lock Screen sizing for run and strength states.
- BLE scan/pair/stream/dropout/reconnect behavior for HR, FTMS treadmill/trainer, RSC, CSC, and power.
- Bluetooth permissions copy and foreground-only background-mode behavior.
- Native lifecycle behavior for active workouts, backgrounding, and app relaunch.

## Final-audit addendum — real browser visual QA (Fable 5, 2026-07-26)

The interactive-browser gap above was closed during the final audit using headless Chrome 150
against the production static export (`dist/`) served locally with `.html` route rewrites and a
same-origin localStorage seed (onboarding complete + experienceMode variants). Screenshots were
captured and visually inspected.

| Screen | Widths | Result |
|---|---|---|
| Today (balanced) | 390 | PASS — dominant workout card (name, What/Feel/Why, Start Run, View Details, **More Options** disclosure); no "No plan changes today" copy |
| Today (simple) | 320 / 390 / tall | PASS — minimal set only: workout card, word-first Daily Check-In, weather; no outlook/analytics cards |
| Today (data-rich) | 390 / tall | PASS — adds Training Outlook card showing honest "Building Your Baseline" / "Need More Data" / "History 0 weeks … confidence limited" for a fresh profile; no fabricated race dates |
| Daily Check-In | 390 | PASS — sleep duration picker prompt, five word-based options per question, no numeric 1–5 scale, Save disabled until complete |
| Stride Report | 390 | PASS — Week/Month period tabs, privacy-exclusion copy visible, "Outdoor elevation only" labeling, honest zero/no-qualifying states, weekly Next-focus (forward look on weekly only), share-card section |
| Activity history | 390 | PASS — search field, filter pills, honest empty state, load panel with no-cross-conversion copy |
| Gear | 390 | PASS — renders with empty-state |
| Settings | 390 | PASS — renders incl. new controls |
| Bottom navigation | 320 / 390 | PASS with a web-only cosmetic finding: labels truncate with ellipsis ("AI C…") because `adjustsFontSizeToFit` is a no-op on react-native-web; native scales instead of truncating — confirm on device |

Not visually verified (state-driven, unreachable by URL): live treadmill/ride/strength sessions,
share-sheet flow (native), voice test button behavior (native), Live Activity surfaces (native),
BLE pairing (native). These are covered by the 475-test suite and listed as post-build device QA.

## Build 46 correction-pass web QA addendum (2026-07-29)

`PATH=/usr/local/bin:$PATH npx expo export --platform web` completed successfully after the Build 46 corrections and generated 117 static routes. Newly covered/static-exported routes include `/training/workout-detail` and `/(tabs)/training/workout-detail`.

Source-level browser-safe contracts added or updated for:

- Today Weather/AQI placement under greeting.
- More Options button and Adjust Today / Adjust the Plan / Get Help disclosures.
- Daily check-in picker-wheel persistence/cancel/Other-note behavior.
- Running Active scroll-flow layout and canonical workout detail navigation.
- Training Paths copy.
- Performance Forecast confidence and info controls.
- Gear shoe-image catalog metadata and controls.
- Strength prescription validation and Volume Summary category separation.

Interactive visual/browser status: not re-run with screenshots in this correction pass. Required follow-up remains a working browser or native device pass at 320, 375, 390, and 430 point widths for Today, Running Active, workout detail, check-in sheets, Activity manual entry, Gear shoe catalog, Strength Volume Summary, Training Paths, and Performance Forecast.
