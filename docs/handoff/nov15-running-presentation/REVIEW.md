# November 15 Running presentation review

The duplicate Auto-pause runs switch is removed from Running's main and paused presentations. Settings → Workout Intelligence remains its source of truth. Voice announcements, saved preferences, detector state, manual pause, Apple Watch display/control, GPS and completion code are unchanged.

The hero previously kept Time left-aligned and Distance right-aligned after its responsive cells wrapped, creating a diagonal stack. Both value/label pairs now center within their equal-width cells. The existing font-aware basis, fitting floor, gap and wrap behavior are preserved. The only shared-component change adds `center` to `FittedMetricText`'s optional alignment type; existing Activity callers retain their left/right presentation.

## Evidence

- Baseline `4d12413`: the 320px extracted source fixture reproduces the diagonal stack.
- Current source: 390px normal text shows short Time/Distance values side by side. Long values stack. At 320px and 1.5x/2x text, the paired values and labels stack centered.
- All six current width/text cases report zero horizontal bounds violations. Full time and distance/unit strings remain visible.
- Existing `oct17LayoutRegression.test.ts` and `autoPauseControls.test.ts`: 13/13 passed. These retain the actual paused-screen scrolling/control placement and persisted auto-pause behavior checks.
- `git diff --check` passed.

The fixtures extract actual production functions and style objects, with synthetic values and an explicit font-scale adapter. They do not mount recording, ownership or native hooks. Current screenshots come from isolated headless Chrome with private /tmp profiles; they are cropped to the observed fixture bounds. The user's interactive Chrome was left alone after focus contention was detected. This is source/browser evidence, not physical iOS Dynamic Type verification.

## Council

Athlete: center each number with its label; retain simultaneous comparison when the pair fits. First principles: use the existing readable reflow, without changing recording or metric calculations. Accessibility: stack narrow/enlarged/long cases instead of clipping or hiding values. Countercase: edge-aligned columns can scan well when they stay on one row, but their diagonal wrapped arrangement obscures the pair. Equal centered columns address both states.

Chair verdict: **PASS for the bounded source/browser presentation change**. Native quick UI acceptance remains separate; this does not reopen the unchanged Watch protocol or claim a new device pass.

## Reproduce

From the canonical Developer checkout:

```sh
node docs/handoff/nov15-running-presentation/generate-fixture.cjs --baseline
node docs/handoff/nov15-running-presentation/generate-fixture.cjs
python3 -m http.server 8098 --bind 127.0.0.1 --directory /tmp/strideos-nov15-running-ui
```

Open `/current/?width=390&scale=1`, then 320/390 with scale 1.5 and 2. The baseline is `/baseline/?width=320&scale=1`. Runtime bundles and intermediate files remain in /tmp; screenshots, source hashes and observed geometry are in `receipt.json`.

## Profile measurement peer fixture

The companion generator extracts the actual `ProfileMeasurementFields` and `Wheel` functions. A same-origin phone-width iframe supplies a real 320/390/400px web viewport for the modal portal. The local fixture clicks actual Edit and unit buttons, uses synthetic values and an inert save callback, and scales explicit/default React Native Text fonts to 1.35x. It performs no profile write.

Closed rows, imperial/metric weight, metric height, and the date fallback were captured. Visible horizontal overflow is zero. Measured row actions are 44px high, unit actions 48px, Save/Cancel 46px. Open sheets have one intentional off-screen accessibility title from Expo UI/Radix (`Bottom sheet`, clipped to zero, left -1px, width 1px). The receipt records the raw count and excludes only that verified screen-reader label from visible overflow; no product clipping workaround was added.

`profile-fixture-receipt.json` contains exact source/generator hashes, observed viewport/target geometry, zero save-call counts and image hashes. These pictures show the web select/date fallbacks, **not** native wheels or an Apple calendar. Native presentation and hit targets remain hardware acceptance.

```sh
node docs/handoff/nov15-running-presentation/generate-profile-fixture.cjs
```

With the same local server, open `/profile-wrapper.html?width=320&scale=1.35&field=weight`, or `&field=height&units=metric`. Omit field for closed rows. Generated source and bundled dependencies remain private in /tmp.

## Settings/Profile navigation correction

The installed Expo Router TabRouter defaults to firstRoute for Back. A cross-tab Settings → legacy Profile link therefore returned Dashboard. Four one-line Settings-stack aliases now reuse the existing Profile, identity, calibration and availability screens. Profile chooses its three child destinations from its current pathname; within Settings its Back dismisses to Settings, including the cold Profile-root replacement fallback. Legacy Profile destinations remain unchanged, and no global tab history behavior changes.

`settingsProfileNavigation.test.ts`: 5/5 passing, executing the installed pure TabRouter/StackRouter reducers and actual source action handlers. It reproduces the original default-router failure and verifies all three normal child round trips. This is source/reducer verification, not live native navigation acceptance. `navigation-receipt.json` records hashes and the exact boundary. Cold direct child aliases are not public entry points and were left outside the requested normal flow; existing child screens/draft handlers are unchanged.
