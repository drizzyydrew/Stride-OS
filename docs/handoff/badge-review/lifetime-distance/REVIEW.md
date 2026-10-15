# Lifetime Distance Running and Cycling

The user approved the one-mile three-state preview and asked to update the
design council and finish both families. That approval establishes the common
art direction; these complete family exports remain review artwork pending
full-family acceptance and a request to replace production files.

Update: after confirming the individual one-mile exports match the sheet
exactly, the user said "That is great move to the next one". Running and
Cycling family artwork is now accepted. No explicit replacement/build request
was made in that message; the app integration and release gates remain separate.

## Coverage

Running: 1, 5, 10, 26.2, 50, 100, 250, 500, 1,000 and 10,000 miles.

Cycling: 10, 50, 100, 250, 500, 1,000, 2,500, 5,000 and 10,000 miles.

All 19 existing achievement IDs and meter thresholds come directly from the
app's canonical family definitions. Imperial/metric labels use the existing
family formatting and unit helpers. `definitions.json` records en-US review
formatting, not support for every runtime locale. No independent conversions,
new achievements, threshold changes or unlock logic were added.

Every badge has three canonical states: unlocked, locked and transparent.
Opaque share aliases unlocked exactly, without a fourth drawing or file set.
There are 57 canonical SVG/PNG pairs and 57 metric-display pairs. Metric
exports are alternative labels on the same achievements, not extra states.
Files are in `exports/{running|cycling}/{imperial|metric}/`.

## Source of Truth

Approved frame and typography: `../lifetime-running/one-mile-unlocked.svg`
and the corresponding PNG. Full reference: `../lifetime-running/reference-sheet.jpg`.
All six approved one-mile state SVG/PNG files are frozen by
`approved-one-mile-hashes.json` and remain byte-identical in the family output.

`artwork.cjs` derives both families from the same approved frame/state renderer.
The frame, regular unit labels, tracked wordmark and two chevrons do not vary
by activity, milestone or state. Tier colors follow each reference ladder in
a muted treatment rather than changing the whole family to one color.

Didot lining numeral paths are individually fitted, not nudged with arbitrary
x overrides. Visible ink is centered at x=50. The approved 1 remains size 30,
baseline 51. Long numerals reduce uniformly in size, preserving letterforms;
exact rotated Bezier bounds enforce diamond clearance. Actual comma/zero
descenders align to an ink bottom of 51 to maintain clearance above MI/KM.
Typography is outlined from the exact Didot/Avenir Next faces, eliminating
SVG/native/export font fallback. Font hashes, bounds and fit sizes are in
`typography.json`.

## Preview Sheets

- `running-unlocked.png` and `cycling-unlocked.png`: complete colored families.
- Same-stem locked and transparent sheets: all states, same geometry.
- `*-metric.png`: metric versions of each sheet.
- `*-{imperial|metric}-sizes.png`: all badges/states at 48/64/96/128/256 px.

The transparent boards deliberately present alpha artwork on gray. That
background is not baked into any individual transparent badge.

## Reproduce and Validate

From the canonical Developer checkout:

```sh
TSX_DISABLE_CACHE=1 LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 node --import tsx docs/handoff/badge-review/lifetime-distance/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/lifetime-distance/outline-family-type.py
node docs/handoff/badge-review/lifetime-distance/render-families.cjs
```

Local checks cover all canonical IDs, retained source thresholds/units, state
geometry, alias equality, no runtime text or embedded reference pixels,
all six approved-file hashes, grayscale locked pixels, transparent background
samples, diamond clearance and equal numeral margins. All 24 distinct labels
pass pixel checks at 48/64/96/128/256/800 px (144 checks), with at most 1 px
left/right difference from antialiasing. Long-numeral comma descenders do not
collide with the unit. SVG/PNG files derive from the same vector source.
The report is in `validation.json`.

Current Git readback shows no edits to Running/Cycling production assets or
renderers, watch/connectivity code, or the watch bridge. Earlier Firsts changes
are preserved. Only review helpers/exports and the explicitly requested
design-council skill update belong to this task.

No full app tests, native compile, device verification, EAS build, submission
or release were run for this preview-only completion.

## Council Evidence

Independent Architect / Export QA review: PASS for the preview implementation
and exports. All 19 source IDs, thresholds, number strings and unit labels
match the existing app helpers. All 114 SVG/PNG pairs are fresh; the six
approved one-mile hashes remain identical. State geometry and share aliases
pass with no fourth opaque state. All 144 numeral checks, 38 transparent
checks and 38 grayscale checks pass. Scoped app/watch Git readback is empty.

Cross-examination confirmed importing the original outliner has a main guard
and does not rewrite approved typography. Equal visible bounds do not imply
perceived mass centering of asymmetric numerals. Low-resolution reference
pixels do not establish exact font geometry, colorimetry or native appearance.
Long strings are scaled uniformly rather than stretched into condensed type;
the largest milestones therefore use smaller numerals to keep equal margins
and frame clearance. The approved one-mile hierarchy is not altered.

The design-council skill records this family's approved direction and passes
skill validation. No update to general memory was requested or performed.

Independent Reference Fidelity / Theme / Small-Size review initially found
two medium palette issues: Running 500/805 was too pink, and Running
1,000/1,609 read orange rather than coral-red. Only those Running palettes
were corrected; Cycling and all numeral/frame geometry remained unchanged.
The regenerated imperial and metric boards passed the targeted visual recheck
with no remaining visual fixes. Uniform numeral reduction, including size
16.5 for long labels, and ink-bottom alignment at 51 passed. Reduced fine
detail at 48/64 px is an accepted preview tradeoff, not a reason to thicken
the approved art.

Chair verdict after independent reviews and cross-examination: PASS for the
complete 19-badge preview/export set. User acceptance of the full sheets,
production integration, native/device fidelity and release remain separate.
