# Recovery Week: Vine and Hammock Preview

## Requested Direction

October 14, 2026 feedback: "The strength looks Great. But maybe for the recovery
one it should have vines around the outside and the something in the middle that
signifies relaxation or recovery".

This new written direction supersedes the leaf-cycle reference for this preview.
Interpretation: paired vines framing a central relaxation symbol inside the outer
hexagon. The user accepted the hammock preview with "Great update the design
council agent and finish", authorizing all seven family artworks under this
direction. See `../FAMILY_REVIEW.md` for complete exports and scoped validation.

## Artwork

`glyph-data.json` defines two mirrored vine stems with five tapered leaves per
side and a central supported hammock. No human figure, renewal arrows or central
node. Fine veins and stitching are colored vector details, not black patches.
The empty hammock space and badge interior expose genuine alpha in transparent
exports; its fabric has an intentional translucent fill, not a background panel.

`artwork.cjs` passes this canonical glyph into the existing Recovery master frame,
palette, title and state renderer. It preserves the thin softened hexagon, muted
sage identity, centered outlined titles at 71.5/79.5 and no-footer treatment. All
three states share geometry. Share-opaque aliases unlocked and share-transparent
aliases transparent; no fourth set or duplicate opaque design.

This is an alternate preview of the existing `recovery_week_completed`, not a new
achievement ID. Current source definitions and rules are unchanged.

## Validation

`measure.py` computes vector bounds with FontTools. `validation.json`: PASS with
90 checks across three states, six sizes (48, 64, 96, 128, 256, 800) and five parts:
whole glyph, paired vines, hammock and both title lines. Margins differ by at most
one pixel; no frame collisions. Saved PNGs match fresh SVG pixels; grayscale,
empty-area alpha, shared geometry and both aliases pass.

All six V1 SVG/PNG files remain byte-identical and also match fresh parent-renderer
pixels, pinned in `preserved-v1-hashes.json`. All 60 accepted Strength artwork
files match their manifest hashes. Four Recovery source hashes match. Scoped app
and protected watch diffs are empty. No production assets are replaced.

## Visual Council

Reference / Theme / Small-Size Lead: scoped V2 preview PASS, no high or medium
findings. The vines clearly surround the central hammock with separation from
supports, title and frame. Muted sage and no-footer composition are coherent
across states. Fine mesh/veins soften at 48px; no silent thickening recommended.
The new artwork responds to the latest written request, not the old leaf-cycle
photograph. Approval remains with the user.

System / Export / Product Lead: independent scoped PASS on fresh three-pair pixel
parity, 90 margin/clearance checks, mirrored vines, shared geometry, aliases,
transparent alpha, locked grayscale, canonical ID, four source hashes and all
66 preserved V1/Strength artwork files. Parent default rendering remains unchanged.
Cross-examination left no high or medium objections. Chair: PASS for presenting
V2 only, not user acceptance, app/native verification or release signoff.

No full-app tests, native/device validation, builds, submission or release were
performed. Local preview/export QA is not native or app integration proof.

## Files

- `recovery-week-vines-{unlocked,locked,transparent}.svg/png`: three-state previews.
- `comparison.png`: preserved V1 next to the proposed vine/hammock composition.
- `states.png`: three-state sheet.
- `sizes.png`: five review sizes.

Reproduce from the canonical Developer checkout:

```sh
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/recovery/vine-hammock/measure.py
node docs/handoff/badge-review/recovery/vine-hammock/render-preview.cjs
```
