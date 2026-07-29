# StrideOS Build 47 Release Evidence

Date: 2026-07-29

## Scope

- Shared picker-sheet layout now separates header, picker viewport, divider, fixed action footer, and bottom safe-area padding in `src/components/ui/PickerWheel.tsx`.
- Running distance and race distance use whole, tenths, and hundredths wheels; duration uses the same corrected picker-sheet architecture.
- Editable calendar dates use `src/components/ui/StrideDateField.tsx` with `YYYY-MM-DD` storage and `MM/DD/YYYY` display.
- Manual Activity logging asks for Activity Date only. Compatibility timestamps are derived at local midday via `dateOnlyToLocalTimestamp()`.
- Training Outlook presents plan decision, focus, action, rationale, history, and confidence without a duplicated Load card.
- Performance Forecast owns Load Trend and renders compact confidence-safe summary states with info buttons.
- The Stride Report uses canonical unit formatting and adds a period-scoped Shoe Report.

## Date Policy

- Internal date-only storage: `YYYY-MM-DD`.
- Editable user-facing display: `MM/DD/YYYY` with leading zeros.
- Legacy `MM-DD-YYYY` parsing remains accepted for migration safety.
- Date-only timestamps are derived deterministically at local midday so timezone conversion cannot shift the selected calendar day.
- Calendar month navigation uses real month lengths, including leap years and 28-, 29-, 30-, and 31-day months.

## Distance Policy

- Running distance picker values are composed as integer hundredths from separate whole, tenths, and hundredths wheels.
- Example: `3 | . | 1 | 2 | mi` stores `3.12 mi`.
- Metric picker display stores the selected metric value for run-goal configuration; run start converts to canonical miles using the existing centralized conversion path.
- Common race distances are no longer forced into half-mile increments; 5K can be represented as `3.11 mi` or `5.00 km`.
- Summary screens continue using sensible one-decimal report formatting unless the editor requires hundredths.

## Validation

- Focused Build 47 tests: `50/50`.
- Full test suite after Build 47 implementation: `495/495`.
- Typecheck passed before test execution.
- Expo Web production export passed with `117` static routes.
- `expo:check` passed with dependencies up to date.
- Clean iOS CNG prebuild passed with `npx expo prebuild --platform ios --no-install --clean`.
- `git diff --check` passed before release versioning.

## Visual and Native QA

- Production web export was served locally and rendered through Playwright Chromium screenshots at `320x568`, `375x667`, `390x844`, and `430x932`.
- Direct protected app routes rendered the onboarding entry state in the static export, so authenticated picker/calendar interactions could not be exercised through web routing on this host.
- Local iOS simulator QA was attempted through XcodeBuildMCP after clean prebuild. The generated project exists, but this host lacks `xcodebuild` and `simctl`, so native simulator interaction was unavailable.
- The picker, date, report, and presentation changes are covered by focused source and utility tests; physical TestFlight QA remains required for native wheel scrolling and device-specific interaction behavior.

Further release evidence for EAS build and TestFlight submission is recorded in the final Build 47 release report.
