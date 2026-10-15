# Weekly Distance Family Exports

## Approval and Scope

The user approved the revised 5K preview with "That looks great proceed" on
October 14, 2026. The eight existing milestones have now been exported in the
approved style. This is artwork/export work only; app integration, production
replacement, build numbers, builds, submission and release are not authorized by
this approval. Protected watch paths and other approved family artwork are unchanged.

Reference: `../lifetime-running/reference-sheet.jpg`, Weekly Distance section.
Approved baseline: `five-k-{unlocked,locked,transparent}.{svg,png}`. All six files
retain their original bytes, pinned in `approved-five-k-hashes.json`.

## Canonical System

`export-definitions.ts` reads actual app definitions and formatting helpers, then
saves `definitions.json` with IDs, thresholds, labels and source hashes. There
remain exactly eight achievements at 5, 10, 15, 25, 30, 50, 75 and 100 km. Artwork
always says `K`; unit preferences change external progress, not milestone identity.

`artwork.cjs` is the shared approved frame/state renderer. `family-artwork.cjs`
provides each source-defined milestone's fitted numeral and muted reference
palette. `outline-family.py` generates outlined Didot lining numerals, using the
approved .81 horizontal fit. Each numeral is centered by actual ink bounds.
`100K` uses size 26.5856 and width 48; others retain size 29 and baseline 51.
Supporting copy, frame and chevrons are shared unchanged.

The family uses sage, teal-blue, periwinkle, mauve, light cyan-blue, steel blue,
coral and gold, in milestone order. These reference-led colors do not overwrite
current production tokens. Didot's terminals remain a documented interpretation
of the reference, not an exact font or pixel match.

## States and Files

Exactly three canonical states: unlocked, locked and transparent. Both unlocked
and locked have opaque near-black interiors and transparent exteriors. The
transparent state has true alpha in the exterior and empty interior. Locked
artwork is wholly grayscale with the exact same geometry. `share-opaque` aliases
unlocked; `share-transparent` aliases transparent. No fourth artwork set.

`individual-exports/{unlocked,locked,transparent}/` contains 24 SVG/PNG pairs,
48 artwork files, plus a root `manifest.json`. Example:
`individual-exports/unlocked/weekly-distance-10k-unlocked.svg` and `.png`.
All PNGs are 800 x 800; SVGs use a 100-unit viewBox and outlined typography.

Contact sheets: `weekly-distance-{unlocked,locked,transparent}.png`.
Size sheets: `weekly-distance-{unlocked,locked,transparent}-sizes.png`.

## Validation and Council

`family-validation.json`: PASS. 432 lettering raster checks over all eight badges,
three states, three lettering elements and six sizes (48, 64, 96, 128, 256, 800).
Visible side margins differ by at most one pixel. No frame overlaps. Eight
transparent and eight grayscale checks pass, source hashes match, both share
aliases are exact, the asset inventory is exact and all six approved hashes match.

Reference Fidelity / Theme / Small-Size Lead: scoped family preview PASS; no high
or medium findings across all eight badges, three states and five review sizes.
Independently checked grayscale, sampled transparent alpha and approved 5K hashes.

System / Export / Product Lead: scoped family export PASS, no high or medium
findings. Independent readback checked all 24 fresh SVG/PNG pairs, four source
hashes, six approved hashes, all 144 state/size combinations and 432 margin
checks. IDs, thresholds and fixed-K semantics match actual production sources.
Scoped app/watch diffs are empty. Cross-examination resolved no outstanding
objections. Chair verdict: PASS for completed family artwork/export QA, not
native rendering, app integration or release signoff.

Full app tests and native/device verification were not run for review-only files.
No app replacement, EAS build or submission was performed. Existing Firsts edits
and all unrelated work are preserved.

## Reproduction

Run from `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`:

```sh
TSX_DISABLE_CACHE=1 node --import tsx docs/handoff/badge-review/weekly-distance/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/weekly-distance/outline-family.py
node docs/handoff/badge-review/weekly-distance/render-family.cjs
```
