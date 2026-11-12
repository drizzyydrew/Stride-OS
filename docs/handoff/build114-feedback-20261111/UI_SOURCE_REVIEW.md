# Build 114 feedback: source UI review

Scope: source changes and an extracted React Native Web / Expo UI fixture only. No app binary, submission, installed-build update, or device acceptance.

## Changes

- Today renders weather, current streak, then the lifecycle card and all remaining existing content in its original order. The lifecycle card gains the same 16-point bottom gap.
- Every bottom label keeps the shared 10/12-point typography and uses the whole equal-width tab cell; individual auto-shrinking is removed.
- Idle Running subtab controls use intrinsic minimum 44-point height instead of flex:1 inside an unconstrained vertical wrapper. The actual Active tracker and session state are unchanged.
- Section-root house controls navigate to Today and queue a scroll reset until Today is focused. Nested routes retain real Back and existing guards. Running owns hidden-tab presentation only while focused; blur restores the tab bar without stopping recording.
- Archive disclosure content matches height only in RNHostView, taking width from its parent. All archive wording, result semantics, saved data, and parsing remain unchanged. iOS disclosure label line height retains its original 44-point baseline; web uses normal line spacing.

## Verification

- `tsx --test scripts/tests/sourceUiNavigation.test.ts scripts/tests/navigationVisualContracts.test.ts scripts/tests/oct15Navigation.test.ts`: 26 passed. Includes cold/retained Today scroll requests, nested guards, and runtime focus/blur tab-bar cleanup extracted from the real Running effect.
- `tsx --test scripts/tests/build45Phase5ExperienceMode.test.ts scripts/tests/buildNextAdditionalCorrections.test.ts scripts/tests/buildNextUiAndControls.test.ts`: 26 passed. Legacy assertions now require uniform typography without per-label shrinking. The Today test inspects its JSX return instead of confusing the new useRef<ScrollView> type argument with a scrolling element.
- `git diff --check`: passed. Shared final typecheck and full suite are tracked by the root reviewer.
- CUA Chrome inspected synthetic 320 and 390 CSS-pixel columns at 1.35 text scale. RN Text font sizes/line heights are explicitly scaled in the fixture, and Expo UI receives fontScale 1.35. Long names, separate photo/identity buttons, inputs, switches, archive action wrapping, expanded archive content, expanded MAF text, its final contrast/source button sized to 44 times fontScale using supported UniversalStyle.height, and uniform bottom labels were inspected.
- Fixture DOM horizontal-bounds instrumentation reported **0 overflowing elements** at both widths, including expanded archive and MAF. This checks element rectangles against the main column, not native text measurement or every accessibility setting.
- Controlled original Running flex geometry remains visible in RN Web but compresses the row below the revised tap height. The experiment does not establish the cause of a completely missing native row. A persisted active/paused run also intentionally hides subtab chrome; that state was preserved.

## Evidence and reproduction

Cropped `ui-*.png` files show the fixture body only. Full original browser captures are private under `/tmp/strideos-source-ui-qa-20261111/full-screenshots/`. This fixture composes adjacent source excerpts for review; the header and fields are not a live final Profile screen. Leaf workout content, navigation hooks, icon glyphs, and persistence handlers are inert stand-ins. No real recording or account writes occurred.

From the canonical repository, run:

```sh
node docs/handoff/build114-feedback-20261111/generate-source-ui-fixture.cjs
python3 -m http.server 8098 --bind 127.0.0.1 --directory /tmp/strideos-source-ui-qa-20261111
```

Open `http://127.0.0.1:8098/?width=320&scale=1.35` or width=390. `&before=1` substitutes only the original Running button flex/height declaration for comparison. The final 390 expanded MAF screenshot was regenerated after the supported height:44*fontScale fix, with horizontal bounds again 0. The generator reads actual source components/styles and writes intermediate TSX and bundled dependencies to /tmp.

## Council verdict

SOURCE / EXTRACTED-BROWSER PASS for the bounded layout/navigation changes, with independent profile/design review. Native REVISE / acceptance held for an actual candidate: verify full Running idle controls, large text, expanded archive SwiftUI bridge width, Today Home scroll under real nested history, and active-run navigation on-device. Browser fixtures do not establish those native behaviors or resolve Watch crashes.
