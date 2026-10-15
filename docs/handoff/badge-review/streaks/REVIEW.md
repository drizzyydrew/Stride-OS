# Streaks: Three-Day Reference Preview

Status: the user approved the Streaks art direction with "Excellent" and
requested the daily-count option and existing automatic heat-rank colors.
Ranked daily/milestone completion is described in `RANKED_REVIEW.md`.

The user accepted the Running/Cycling family sheets and asked to move to the
next family. This single Streaks preview follows the first badge in their
reference sheet, not an independently invented achievement or award rule.

Reference: `../lifetime-running/reference-sheet.jpg`, Streaks panel.
The crop in `three-day-comparison.png` is QA evidence only; no reference pixels
are embedded in any badge SVG or standalone badge PNG.

## Artwork

`outline-preview.py` defines a custom three-tongue flame with an open,
negative-space center. Exact curve bounds center the filled silhouette.
Typography is outlined from Didot's lining numeral and Avenir Next Medium,
not runtime fallback. The first reference tier uses restrained warm bone and
champagne rather than the app's current green heat token.

The shared `render-preview.cjs` supplies all three canonical states: unlocked,
locked and transparent. Opaque share aliases unlocked exactly, without a
fourth file set. All states preserve the narrow vertical hexagon, flame,
number, DAY STREAK label, tracked wordmark and two chevrons. Transparent
artwork removes the background and ambient fill, retaining true alpha in
the exterior, empty interior and open center of the flame. Locked is neutral
grayscale. No masks, embedded images or runtime text are used.

Outputs: three `three-day-{state}.svg` / `.png` pairs at 800 px,
`three-day-states.png`, `three-day-sizes.png` and `three-day-comparison.png`.
The presentation board's gray canvas is not part of transparent artwork.

## Scope and Milestone Difference

The reference illustrates 3, 7, 14, 30, 60 and 100 days. The app's existing
specialty award list is 7, 30, 50, 75, 100, 150, 200, 250, 300 and 365 days;
its renderer also displays arbitrary current streak lengths. Do not silently
replace the award ladder, add a 3-day achievement ID or change streak rules.
Confirm the desired milestone list separately before any full-family app
integration. This three-day illustration exists only for art-direction review.

Production Streaks, Running/Cycling, Firsts, Mountains/Elevation and
watch/connectivity files are untouched in this preview task. Running/Cycling
artwork acceptance is recorded in their review notes; app replacement and
release have not been requested in this turn.

## Validation

Reproduce from the canonical Developer checkout:

```sh
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/streaks/outline-preview.py
node docs/handoff/badge-review/streaks/render-preview.cjs
```

Automated checks cover alias equivalence, identical state geometry, centered
flame/lettering bounds, glyph/title/footer clearance, no embedded image or
runtime text, true alpha including the flame center, grayscale locked pixels
and zero flame/frame overlap at 48/64/96/128/256/800 px. All 18 state/size
cases pass. At tiny sizes, empty-background sample points are selected clear
of glyph antialiasing; pixels adjacent to numeral edges are not evidence of
an opaque background. See `validation.json` for the live scoped Git readback
and measured bounds/margins.

No app integration, full app tests, native compile, device verification,
EAS build, submission or release was performed for this preview.

## Council

Independent Fidelity / Theme / Small-Size review: PASS for presenting the
single three-day artwork. Tall central tongue, shorter side tongues, curved
flanks and open negative center preserve the reference direction. The narrow
single-outline frame, warm bone/champagne palette and glyph/number separation
are appropriate. No high or medium visual fixes were found. Fine numeral and
wordmark details diminish at 48/64 px; do not compensate by silently changing
the approved styling.

Independent Architect / Export QA review: PASS with no technical findings.
All 18 checks passed, including real alpha through the flame center, grayscale,
state geometry, exact aliases, zero clipping/frame overlap, centered font
outlines and fresh SVG/PNG pairs. Lettering raster margins differ by at most
one pixel; flame margins are equal.

Cross-examination: a photographed low-resolution reference does not prove
pixel-identical geometry, typography or native antialiasing. The illustrated
3-day value does not authorize a new award ID or ladder change. Chair verdict:
PASS for user presentation of this single reference-art preview. User approval,
full-family completion, production integration and device/release verification
remain separate gates.
