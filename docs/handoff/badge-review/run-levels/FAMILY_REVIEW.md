# Run Levels Family Review

October 15, 2026. The user approved Foundation and explicitly requested completing
Run Levels and Monthly Distance. This authorizes family artwork/exports, not app
replacement, a build, submission, release or separate acceptance of every new badge.

## Inventory And Artwork

Seven existing definitions, three states each: **21 SVG/PNG pairs, 42 artwork
files** in `individual-exports/{unlocked,locked,transparent}/`. The manifest records
each canonical ID, definition, filename and SHA256. The six original Foundation
files remain byte-identical to `approved-foundation-hashes.json`.

| Level | Existing Lifetime Threshold | Existing Arch Count | Theme |
| --- | --- | --- | --- |
| Foundation | 0 mi | 5 | Champagne |
| Rhythm | 50 mi | 5 | Copper |
| Momentum | 150 mi | 5 | Olive/sage |
| Durability | 400 mi | 5 | Steel-blue |
| Engine | 750 mi | 6 | Graphite/silver |
| Peak | 1,500 mi | 6 | Slate-blue |
| Summit | 3,000 mi | 6 | Muted gold |

Reference: the Run Levels block in `../lifetime-running/reference-sheet.jpg` and
the accepted Foundation vector. One shared renderer preserves Foundation's frame,
subtle bevel, fitted faceted mountain, outlined condensed Avenir title, tracked
wordmark and two raised chevrons. Each title is fitted independently, without
stretching short names to the width of Foundation. Existing source geometry and
arch counts are preserved; the full inner edge bevel is not an extra arch.
Colors preserve each reference identity with restrained saturation, not neon.

Unlocked and locked have opaque near-black interiors. Locked is entirely neutral
grayscale. Transparent removes the interior and upper illumination, keeping the
same artwork geometry. `share-opaque` aliases unlocked exactly; `share-transparent`
aliases transparent. There is no fourth state or separate opaque-share artwork.
These vectors interpret the reference; pixel identity is not claimed.

## Verification

Local result **PASS**: `family-validation.json` records 630 per-part/state/size
checks for centered ink, clipping and outer-frame/bevel clearance at 48, 64, 96,
128, 256 and 800 px. All 21 SVG/PNG pairs match fresh rendering; all seven locked
exports pass pixel grayscale checks and all seven transparent exports pass real
empty-interior/exterior alpha checks. Source arch counts match each export in all
states. No embedded raster, runtime font text or external asset reference.

The shared batch command also verifies four source hashes, the six approved
Foundation hashes and prior Weekly/Challenges/Strength/Recovery export hashes.
Scoped production Run Levels, Monthly Distance and watch diffs are empty.
Application IDs, thresholds, unit handling, HealthKit and watch connectivity are
unchanged. No app tests, native compile, EAS, submission or device verification.

## Council Closeout

**Chair: scoped PASS for all seven Run Level artworks and exports.** The visual
reviewer inspected every state and 48..256px size sheet, with no high/medium
findings. Distinct palettes, six-arch separation, mountain/title hierarchy and
footer clearance passed. Fine arches and tiny lettering soften at 48px; eventual
app integration still needs external accessible labels and device verification.

The technical reviewer independently checked all 21 SVGs against the renderer,
all 21 PNGs against fresh pixels, four source hashes, source IDs/thresholds, arch
counts in every state, shared geometry, aliases, alpha and grayscale. Foundation's
six hashes and preceding family exports remain unchanged. This bounded review
did not repeat the 630 local margin loops. No app/native/release signoff is implied.

Cross-examination retained existing source arch counts rather than inventing a
new seven-step count ladder, and kept Engine/Peak distinct without uniformly
brightening their graphite/slate treatment. No unresolved high/medium findings.

## Reproduce

From the canonical Developer checkout:

```sh
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/run-levels/outline-family.py
node docs/handoff/badge-review/complete-run-monthly.cjs
node docs/handoff/badge-review/run-levels/freeze-foundation.cjs
git diff --check
```

Boards: `run-levels-{unlocked,locked,transparent}.png`, plus corresponding
`run-levels-{state}-sizes.png`. Colored transparent-board panels are not assets.
