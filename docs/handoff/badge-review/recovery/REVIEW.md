# Recovery: Recovery Week Completed Preview

This is preserved V1. Latest user feedback requested outside vines and a central
relaxation/recovery symbol instead. See `vine-hammock/REVIEW.md` and its preview
files for V2, which the user has now approved. The completed seven-badge family
under that direction is recorded in `FAMILY_REVIEW.md`. V1 remains historical.

Created October 14, 2026 after completing Strength under its approved direction.
This first Recovery artwork remains awaiting user approval. It is not a full
Recovery-family redesign or app replacement. See `../REDESIGN_PROGRESS.md` for
six of ten in-scope families complete, 60%; this preview is not counted as done.

## Source and Composition

Reference: `../lifetime-running/reference-sheet.jpg`, Recovery Week Completed.
`export-definitions.ts` reads the seven canonical Recovery definitions and four
source hashes into `definitions.json`. The preview represents existing
`recovery_week_completed`, not another First Activity or sunrise badge. Its title,
threshold and registry identity are unchanged.

One 100-unit SVG renderer uses a softened hexagon x=12..88, y=5.5..94.5, stroke 1,
near-black sage interior and muted sage border/glyph/copy. Glyph: three filled
leaves, a thin renewal loop, two small arrowhead cues and a tiny central node.
All geometry is manually defined vector paths in `glyph-data.json`, not traced
pixels or stock artwork. FontTools computes actual glyph bounds and centers the
whole composition by visible ink. Titles use outlined Avenir Next Medium, size
6.9, baselines 71.5/79.5 with tracking .08 and individually checked width.

No STRIDEOS wordmark or footer chevrons: the reference does not show these for
Recovery. The visual council confirmed this Recovery-specific exception rather
than carrying over the other families' footers.

## States and QA

Unlocked, locked and transparent share exact geometry and placement. Locked is
achromatic. Transparent removes both interior and ambient fills, with genuine
alpha in empty areas. Solid leaves retain their visible color; their internal
veins are colored vector details, not fake black cutouts. Share-opaque aliases
unlocked exactly; share-transparent aliases transparent. No fourth artwork set.

`validation.json`: PASS, 54 raster checks over all three states, glyph and both
title lines, at 48, 64, 96, 128, 256 and 800 px. Margins differ by at most one
pixel, no frame overlaps or clipping. Saved PNGs match fresh SVG pixels. Grayscale,
alpha, state geometry, aliases and four source hashes pass. Source and protected
watch paths have no diff; earlier Firsts and other approved exports are preserved.

## Council

First visual review required revision: the whole glyph/title block sat too high
against the reference. A shared 6-unit downward translation retained internal
spacing and sizes, placing the cycle center at y=42 and titles at 71.5/79.5.
Second Reference / Theme / Small-Size review: scoped preview PASS, no remaining
high or medium findings. Fine vein detail softens at 48px; no silent thickening
or state-specific geometry changes. The no-footer reference treatment is retained.

System / Export / Product Lead: independent scoped preview PASS after the 6-unit
translation. All three pairs match fresh pixels and all 54 checks pass; geometry,
aliases, alpha, grayscale, centering and clearance verified. No high or medium
findings. Confirmed 60% artwork progress and empty scoped production diffs.
Cross-examination found no remaining objection. Chair: PASS for presenting this
first preview, not user approval or full-family/native/release signoff.

Full-app tests, native/device validation, builds, submission, production artwork
replacement and release were not performed. Council preview acceptance is not
user approval or native fidelity signoff.

## Files and Reproduction

Individual preview files: `week-completed-{unlocked,locked,transparent}.svg/png`.
Review boards: `week-completed-{comparison,states,sizes}.png`.

Run from the canonical Developer checkout:

```sh
TSX_DISABLE_CACHE=1 node --import tsx docs/handoff/badge-review/recovery/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/recovery/outline-preview.py
node docs/handoff/badge-review/recovery/render-preview.cjs
```
