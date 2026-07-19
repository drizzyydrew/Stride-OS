# Build Next Screenshot QA

Date: 2026-07-19  
Method: source inspection plus deterministic tests. iOS Simulator screenshot validation was not claimed in this pass.

## Results

- Bottom navigation: retained exactly six visible tabs and modestly increased icon/label size to 24 / 9.5 while preserving hidden detail routes.
- Date input: race and program dates display MM-DD-YYYY and open picker sheets instead of ISO free text.
- Settings, calibration, and manual log dates: expose MM-DD-YYYY user-facing fields and normalize to ISO internally.
- PR time: finish time uses Hours / Minutes / Seconds picker columns.
- Activity: production default is empty; screenshot records are not seeded by the app source.
- AI Coach: keyboard scroll/dismiss contracts added; responses are sanitized for raw Markdown syntax and pictographic emoji; prompt instructs no markdown or emojis and uses exact scheduled-session details when present.
- Calendar: day cards now read scheduled-session details and avoid today-specific actions on other dates.
- Running: Plan and Active subtabs read scheduled sessions, including run/walk prescriptions.
- Today: primary/supporting/optional scheduled sessions drive card copy and deep links; AQI display and information sheet added.
- Movement Lab markers: full-image normalized dragging with edge clamping and parent-gesture blocking is covered by deterministic tests.

## Validation evidence

- `npm run typecheck`: passed.
- `npm run test`: 198/198 passed.
- `npm run expo:check`: passed.
- `git diff --check`: passed.
- `npx expo export --platform ios`: passed.
- `swiftc -parse` over affected ActivityKit/App Intent Swift files: passed.

## Rendering limitation

`xcodebuild` was unavailable locally because the selected developer directory is Command Line Tools, not full Xcode. No iOS Simulator screenshots or browser-rendered screenshots were produced in this environment, so final visual confirmation remains assigned to the Build 40 TestFlight physical-device checklist.

## Remaining physical-device-only checks

- iOS keyboard animation and safe-area behavior in AI Coach.
- GPS run/walk start, voice prompt timing, and background behavior.
- AQI provider behavior on real location permissions.
- Live Activity native pause/complete behavior on Lock Screen/Dynamic Island.
