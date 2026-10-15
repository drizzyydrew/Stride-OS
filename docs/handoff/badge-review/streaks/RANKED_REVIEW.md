# Daily Streaks and Milestone Awards

The user approved the champagne three-day drawing and requested daily-count
badges, with colors changing when entering the next existing flame rank.
The existing app code was inspected before work; no historical ranges were
guessed. This completion is review artwork, not an installed app update.

The user subsequently approved the full set with "Perfect" and requested
each individual file. Separate first-year daily and specialty award files
are now exported under `individual-exports/`; see `INDIVIDUAL_EXPORTS.md`.
This artwork acceptance does not imply a phone app update or build approval.

## Existing Rankings

| Days | Rank | Color |
| --- | --- | --- |
| 1-10 | Ember | Green |
| 11-50 | Kindle | Yellow |
| 51-100 | Blaze | Orange |
| 101-150 | Inferno | Red-orange |
| 151-200 | Phoenix | Hot pink |
| 201-250 | Violet Flame | Violet |
| 251-300 | Blue Flame | Blue |
| 301-364 | White Hot | Blue-white |
| 365+ | Eternal Flame | White-hot |

`system.json` is exported from `STREAK_HEAT_TIERS`, `STREAK_HEAT_COLORS` and
the canonical milestone definitions. Hex colors, labels and day boundaries
are unchanged. It records source hashes and both sides of every transition
using the app's actual `streakHeatTierForDays` helper. Its null maxDays means
unbounded. There is no independent award ladder or new three-day award.

## One Renderer

`frame.js` owns the approved frame, flame, title, wordmark, chevrons and state
transforms. Both the preserved champagne reference and ranked daily/milestone
art import it. All six champagne three-day SVG/PNG files remain byte-identical,
verified by `approved-reference-hashes.json`.

`ranked-artwork.js` composes any safe positive integer from ten outlined Didot
lining glyphs. Counts increment without needing a separate artwork definition
for every day. Numeral ink is centered and fitted for width; the flame and
footer remain unchanged. Input is floored and limited to positive safe JS
integers in this review renderer; this does not change app streak calculation.
The latest written color requirement controls ranked artwork, so a ranked
three-day badge is green, while the approved champagne reference stays intact.

The same current-day selector drives the ten existing milestone awards:
7, 30, 50, 75, 100, 150, 200, 250, 300 and 365. IDs, thresholds, titles and
unlock/streak rules remain unchanged. Milestone artwork calls the daily
renderer with its threshold count rather than duplicating geometry.

Unlocked, locked and transparent are the only three canonical states.
Share-opaque aliases unlocked exactly. Locked is fully grayscale, even when
the selected current rank has a color. Transparent removes background/ambient
fill and has true alpha through the exterior, empty interior and flame center.
Daily display is a mode/count, not a fourth visual state or achievement ID.

## Review Controls and Exports

`daily-viewer.html` is a self-contained local review tool. Daily Streak has a
day input; Milestone Awards selects an existing award; State selects the
canonical artwork state. Rank controls jump to the first day of a category.
It uses the same JavaScript frame and ranked renderer as the exported assets.
This is not a new preference/control added to the phone app.

`flame-ranks-{state}.png` shows all nine ranks with source labels/ranges.
`milestone-awards-{state}.png` shows all ten existing awards.
`daily-boundaries.png` shows every transition side by side.
`ranked-{state}-sizes.png` covers 48/64/96/128/256 px across all ranks.
`ranked-exports/daily/` contains 23 representative/boundary counts in three
states; `ranked-exports/milestones/` contains the ten awards in three states.
All 99 SVG/PNG pairs use the same renderer. Arbitrary additional daily counts
render dynamically rather than producing thousands of duplicate files.

## Reproduce

From the canonical Developer checkout:

```sh
TSX_DISABLE_CACHE=1 node --import tsx docs/handoff/badge-review/streaks/export-system.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/streaks/outline-digits.py
node docs/handoff/badge-review/streaks/render-system.cjs
node docs/handoff/badge-review/streaks/qa-viewer.cjs
```

## Verification

All 403 modeled counts pass centering, clearance and alias checks, including
1-400, 1,000, 99,999 and Number.MAX_SAFE_INTEGER. All 18 source-derived
boundary selections pass. All 115 raster fitting checks pass across
48/64/96/128/256 px. All 99 SVG/PNG pairs pass state geometry, source palette,
neutral locked pixels and real alpha checks. Approved reference SVG/PNG
hashes and source hashes are unchanged. Reports: `ranked-validation.json`.

Playwright passed the review tool's 18 rank transitions, ten milestone
selections, three states and 1280x900 / 390x844 layouts, with no script errors
or horizontal overflow. Screenshots: `daily-viewer-desktop.png` and
`daily-viewer-mobile.png`; report: `viewer-validation.json`. It uses installed
Chrome with an isolated temporary profile because the bundled Playwright
browser executable was unavailable. No browser package was downloaded.

Scoped Git readback shows no edits to production Streaks, watch/connectivity,
the watch bridge, app configuration or package dependencies. Existing Firsts
changes and accepted Running/Cycling artwork are preserved. No full app
tests, native compile, EAS build/submission, device or release verification
was performed for this preview-only work.

## Council

Independent visual review: scoped Preview PASS, no high or medium findings.
Approved geometry, hole, lettering and chevrons are consistent. Source color
identities follow the user's latest written request. Rank, award and sampled
daily numerals fit cleanly, including long counts. The small-size sheets keep
the approved delicate hierarchy. Locked/transparent checks and all six
reference hashes pass. Native/app integration remains outside this verdict.

Independent Architect / Export QA review: scoped Preview PASS, no high or
medium findings. It independently checked all 403 models against the live
selector, source parity for nine ranks and ten awards, six reference hashes
and all 99 fresh export pairs. Geometry, aliases, milestone/daily parity,
alpha and grayscale pass. Its expanded 150 raster checks include 99,999 and
MAX_SAFE_INTEGER, with no clipping and left/right margins within one pixel.
It confirmed the viewer embeds the same engine and data.

Cross-examination: colorless locked artwork does not change the selected rank;
the rank is named outside the art. A daily count is not a new award or fourth
state. Champagne reference colors do not override the user's newer request
for existing ranked colors. Null upper bounds are treated as unbounded, and
the source helper selects the same tier at every boundary. Chair verdict:
PASS for completed daily/milestone review artwork and tested local controls,
not phone/watch integration or release verification.
