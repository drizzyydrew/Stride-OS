# Power And Climbing Work Presentation

Local source update, October 23, 2026. Scope is the approved Power/Climbing work section only. No TestFlight submission, EAS build, version bump, commit or push. Activity spacing, refresh-button placement, feature-tour replay/bubbles and analytics integrations remain separate pending work.

## Presentation

- Latest heading direction: every supported section is the activity name followed by Work (Hiking Work, Walking Work, Running Work, Cycling Work, Indoor Cycling Work). This is a presentation title, not a relabeling of watts as total mechanical work. Source/quantity labels and units remain visible and unchanged.
- One primary quantity: climbing work in kJ for walking/hiking; recorded, entered or model power in W for supported running/cycling activities. The two units are not interchangeable. Climbing-component W stays in calculation details.
- Circled information icon expands what the result means, why it may help and how to read it. Quantity and coverage remain visible with help closed. Higher values are not presented as proof of better fitness.
- Native Expo UI Collapsible dropdowns for Everyday equivalent and Calculation details. Existing power history remains inside the latter; no new climbing-history system.
- Copy follow-up: info answers are shorter. Everyday equivalent shows one comparison sentence and a brief quantity/electricity qualification; appliance assumptions, operating draw and retryable reference links now live in Calculation details.
- Unavailable results stay unavailable, zero power stays zero, and positive values below one display as <1 instead of zero. Detailed availability reasons remain expandable.
- Calculations, saved model snapshots, automatic-save effect, Health recovery and Watch/recording paths are unchanged. Only secondary display values use current activity ascent/time inputs instead of redundant saved metadata. Comparison state never writes to activity history.

## Everyday References

- Exactly 120 source-backed scenarios: eight per 100 W band from 100 through 1000 W; four per band from 1100 through 2000 W. Scenarios use familiar single items, multiples or combinations with summed nominal operating draws, not fabricated device ratings.
- Unrounded valid W selects a floor band. The numerical comparison divides actual activity W by the selected scenario's summed draw, not by the band label. The actual result is never replaced with a band midpoint.
- Below 100 W, small single-item references allow fractional comparisons, including below 9 W. Values over 2000 W receive an explicit out-of-library message, not silent clamping.
- Climbing energy uses a separate pool of eight single common appliances. Runtime is kJ x 1000 / appliance W, independent of power bands, climbing duration or climbing W. It represents only the uphill-work energy component.
- No whole-activity energy is inferred from partial power recording coverage. Metabolic, mechanical and device quantities remain distinct. Comparisons explicitly say no electricity was generated or assumed recoverable; ratings, operating modes, startup and conversion limitations are disclosed.
- A random draw is retained through expansion, theme/unit changes and automatic metric updates. Refocusing or opening another activity chooses a fresh draw. The parent panel key is activity ID only so a unit change does not remount the session.
- Each scenario exposes its source links; failed links show a retryable error. No analytics, network lookup or external requests occur just to choose a comparison.

References checked October 23, 2026:

- FTC LED example: https://consumer.ftc.gov/articles/shopping-light-bulbs
- Honda approximate operating loads: https://powerequipment.honda.com/generators/generator-wattage-estimation-guide
- Jackery appliance examples: https://www.jackery.com/pages/jackery-buying-guide

## Verification

- Source/domain and contrarian/data-custody reviewers cross-examined the approach and reviewed the actual diff. Their small-value, provenance and finite-result findings were fixed and regression-covered. Both issued source GO; this is not device acceptance.
- Initial focused checks passed 23 existing plus 12 new tests. Expanded interaction tests also cover info/dropdowns, zero/missing data, random-draw stability across unit changes/refocus/identity changes, and source-link failure/retry.
- Final semantic typecheck passed: `/tmp/strideos-power-typecheck-final.log`.
- Final iOS Hermes export passed: `/tmp/strideos-power-ios-export-final.log`. Actual bundle `entry-98af6ab0d384ce4ca191ebcb23ac2fd2.hbc`, 10,706,677 bytes, contains all six checked help/dropdown/comparison markers. This is JavaScript export, not native compilation or a signed archive.
- Initial full serial suite: 1141/1142 passed; an unchanged Swift probe hit its existing 30-second subprocess deadline. Its isolated retry passed 5/5 including that probe. The clean final full serial suite passed 1148/1148, zero failures/skips, in 130.5 seconds (`/tmp/strideos-power-full-final.log`). No test deadline was loosened.
- Synthetic browser QA uses the actual panel, calculations, theme and Expo UI web controls, with in-memory fixture stores and focus events instead of real Health/device data. It checks both themes, widths 320/393/768/1280, info/dropdowns, stable selection across units/theme, zero/unavailable/small/above-library values, source/coverage labels and runtime errors. Enlarged browser layout is not a native Dynamic Type test.
- Final browser receipt: 23 checks passed, no page errors (`/tmp/strideos-power-browser-final.log` and `/tmp/strideos-power-preview/receipt.json`). Reviewed the collapsed dark phone, expanded narrow light phone, enlarged 320px dark layout and metabolic comparison screenshots. No overflow at the checked widths.
- Receipts and screenshots: `/tmp/strideos-power-preview/`; source and runner are beside this document. Native SwiftUI/Compose layout, VoiceOver/TalkBack, and physical-device acceptance remain unverified. `@expo/ui` 56.0.26 was added via the SDK-matched Expo installer; installation on a device requires an appropriate native build, not just an OTA JavaScript update.

## Reproduce The Synthetic Preview

Heading follow-up: 42 focused tests, semantic typecheck and 25 browser checks passed after the activity-name titles were applied. Local sample-data gallery renders the actual section, shared ScreenHeader and brand chevrons with an illustrative navigation strip. Images: `/tmp/strideos-power-preview/activity-work-gallery.png` and `activity-work-gallery-expanded.png`. These are browser component previews, not installed-device screenshots. Earlier full-suite/export receipts above precede this label-only follow-up; no new native build or TestFlight submission was made.

Copy follow-up: 42 focused tests passed (`/tmp/strideos-work-copy-tests.log`), including collapsed reference placement and link failure/retry. Semantic typecheck passed (`/tmp/strideos-work-copy-typecheck.log`). The synthetic browser runner passed 25 checks with no page errors (`/tmp/strideos-work-copy-browser.log`). The expanded gallery was visually reviewed. No analytics SDK was added or configured.

```sh
node docs/handoff/power-review/build-preview.cjs
node docs/handoff/power-review/check-preview.cjs
```

The second command needs Playwright available through normal Node resolution or `NODE_PATH`. It starts a temporary local server, checks the real component, writes a receipt/screenshots, and closes the server/browser. The preview has synthetic controls and is not the complete Activity detail route or a live iPhone session.
