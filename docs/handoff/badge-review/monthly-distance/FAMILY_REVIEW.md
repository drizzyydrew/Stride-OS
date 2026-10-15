# Monthly Distance Family Review

October 15, 2026. The user requested the full Monthly Distance and Run Levels
families without another sample gate. This is artwork/export authorization only,
not app integration, rule changes, builds, submission or release.

## Inventory And Artwork

Seven existing milestones: **25K, 50K, 100K, 150K, 200K, 250K, 300K**. Canonical
IDs are `monthly_run_{kilometers}k`; thresholds remain 25,000..300,000 meters.
There is no invented 500K award. Three states each produce **21 SVG/PNG pairs,
42 artwork files**, in `individual-exports/{unlocked,locked,transparent}/` with
definitions, filenames and SHA256 values recorded by the manifest.

This family extends the accepted Weekly Distance vector treatment: one thin
softened hexagon (100-unit viewBox, x=14.8..85.2, y=7.5..92.5, width .95), Didot
lining numerals at baseline 51 with .81 horizontal fitting, centered Avenir
`PER MONTH` at baseline 64, tracked wordmark at baseline 76 and two chevrons.
Every numeral is fitted from its actual visible ink bounds to a maximum width of
48, not shifted with arbitrary per-number x offsets. The longer period label is
measured independently. All lettering is outlined paths, not runtime fonts.

Source color identities are retained in muted palettes: green/sage 25K, teal 50K,
blue 100K, violet 150K, mauve/magenta 200K, coral 250K and gold 300K. These are
Monthly identities, not the Challenges review palettes for reused 150K/200K IDs.
The supplied full reference has no dedicated Monthly block; this treatment is an
explicit extension of approved Weekly art and existing Monthly source identities,
not an assertion of a photographic Monthly match.

Each milestone has one drawing for unlocked, locked and transparent. Locked is
neutral grayscale. Transparent removes the interior/ambient treatment for real
alpha, preserving glyph and lettering geometry. `share-opaque` is an exact alias
of unlocked; `share-transparent` aliases transparent. No fourth artwork set.

## Verification

Local result **PASS**: `family-validation.json` records 504 per-part/state/size
checks for equal horizontal ink margins within one pixel, no clipping and no
frame collisions at 48, 64, 96, 128, 256 and 800 px. All 21 SVG/PNG pairs match
fresh rendering; seven grayscale checks and seven real-alpha checks pass.
SVGs contain no raster image, runtime font text or external image references.

Six source hashes include the evaluation source. The shared batch also preserves
Foundation's six files and existing Weekly/Challenges/Strength/Recovery exports.
Monthly Distance source and production assets remain unedited. Canonical fixed-K
identity is preserved under imperial settings; existing accessibility converts
remaining distances as before. Local calendar-month rules are not replaced with
rolling thirty-day windows, and no achievement is registered twice.

## Council Closeout

**Chair: scoped PASS for all seven Monthly Distance artworks and exports.** The
visual reviewer checked each state and 48..256px sheet, with no high/medium
findings. Numeric fitting, period label width, source-derived hue identities and
footer clearance passed. Tiny supporting copy softens at 48px as expected.

The technical reviewer independently checked all 21 SVGs against the renderer,
all 21 PNGs against fresh pixels, six source hashes, canonical IDs/thresholds,
shared geometry, exact aliases, locked grayscale, alpha and PER MONTH copy.
Across both completed families, 42 pairs / 84 files match, as do all six frozen
Foundation hashes and all 228 preceding Weekly/Challenges/Strength/Recovery file
hashes. The bounded readback did not repeat the 504 local raster loops.

Cross-examination confirmed that Monthly retains its own violet 150K and
mauve/magenta 200K identities rather than copying the Challenges palettes, and
explicitly labels the approved Weekly extension as an inference, not a match to
a nonexistent Monthly photographic reference. No high/medium findings remain.
No app tests, native compilation, EAS, Apple processing or device testing was run.

## Reproduce

From the canonical Developer checkout:

```sh
npx tsx docs/handoff/badge-review/monthly-distance/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/monthly-distance/outline-family.py
node docs/handoff/badge-review/complete-run-monthly.cjs
git diff --check
```

Boards: `monthly-distance-{unlocked,locked,transparent}.png`, plus corresponding
`monthly-distance-{state}-sizes.png`. Colored transparent-board panels are not
part of individual transparent artwork.
