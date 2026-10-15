# Foundation Run Level Preview

October 15, 2026. The user requested the next family after revising Challenges.
The user subsequently approved Foundation and requested completion of Run Levels
and Monthly Distance. This file preserves the original Foundation preview review;
current full-family evidence is in `FAMILY_REVIEW.md`. App replacement remains
outside the artwork/export authorization.

## Source And Treatment

Reference: the Run Levels block in `../lifetime-running/reference-sheet.jpg`.
Existing canonical ID: `run_level_foundation`. The seven source definitions,
thresholds, colors and geometry helpers were read without editing them; four
SHA256 source hashes are recorded in `definitions.json` and the validation report.

Foundation uses a vertically oriented softened hexagon with a subtle beveled
edge and five open nested arches. Source geometry is normalized from the existing
256-unit coordinate system to a 100-unit viewBox. The existing ring counts remain
`[5,5,5,5,6,6,6]`; the low-contrast edge bevel is not an extra progression arch.
No threshold, award ID, rank membership or unit handling is changed.

The original faceted mountain paths are fitted to approximately 60% of badge
width, centered by their visible source bounds. A warm champagne/taupe field
behind the arches fades before the title. The title is outlined Avenir Next
Condensed DemiBold, size 9.8, centered at x=50, baseline 67.5; the tracked
STRIDEOS wordmark is outlined Avenir Next Medium, size 3.3, baseline 76.
Exactly two chevrons sit above the bottom bevel with raster-tested clearance.

One shared drawing derives unlocked, grayscale locked and genuinely transparent
states. Transparent removes both the dark interior and upper atmospheric fill,
without changing paths, positions or lettering. `share-opaque` is exactly the
unlocked SVG and `share-transparent` aliases transparent. No fourth artwork set.
These vectors interpret the supplied low-resolution art; no pixel-identity or
user approval claim is made.

## QA And Council

Local result: **PASS**, in `preview-validation.json`. Six SVG/PNG exports, exact
fresh-render pixel parity, shared geometry, five source arches, true empty
interior/exterior alpha, neutral grayscale and 54 per-part copy/footer horizontal
margin and outer-border/bevel collision checks at 48, 64, 96, 128, 256 and 800 px.
No production Run Level or watch files changed. App tests, native compile, EAS,
submission, Apple processing and device rendering are outside this preview.

Cross-examination and fixes before presentation:

- Initial 48px footer/bevel contact was removed by lifting the two chevrons and
  wordmark while retaining their hierarchy.
- The visual reviewer found an overly dark arch field and undersized title.
  The upper field was strengthened/extended and title increased from 8.3 to 9.8.
  All three states and local checks were regenerated after those fixes.

**Original chair: PASS for the Foundation preview and exports. User approved.**
The visual reviewer passed all three state and 48..256px size sheets after the
two fidelity fixes, with no remaining high/medium findings. The final title ink
width is 48.8674 units, about 64% of frame width, centered at x=50.

The technical reviewer independently verified all three SVG/PNG fresh-render
pairs, six export hashes, four source hashes, title/wash values, five arches,
shared geometry, aliases, alpha and grayscale across six sizes. Scoped app/watch
diffs were empty. That bounded review did not repeat the 54 local margin loops.
Neither verdict completes the family or authorizes integration/release.

## Reproduce

From the canonical Developer checkout:

```sh
npx tsx docs/handoff/badge-review/run-levels/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/run-levels/outline-preview.py
node docs/handoff/badge-review/run-levels/render-preview.cjs
```

Individual art: `foundation-{unlocked,locked,transparent}.{svg,png}`.
Boards: `foundation-states.png` and `foundation-{state}-sizes.png`. Their colored
panels are preview surfaces only, not baked into the transparent assets.
