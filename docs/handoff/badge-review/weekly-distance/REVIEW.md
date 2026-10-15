# Weekly Distance: First 5K Preview

## Scope

Created October 14, 2026 in the canonical Developer checkout after the user
accepted the Streaks exports and requested the next family. This is one Weekly
Distance preview, not production replacement or release. The user approved the
revised 5K with "That looks great proceed" and authorized completing the family.
The completed family and individual exports are documented in `FAMILY_REVIEW.md`.

Reference: `../lifetime-running/reference-sheet.jpg`, Weekly Distance section.

Existing canonical milestones remain 5, 10, 15, 25, 30, 50, 75 and 100 km.
IDs, threshold meters, unlock behavior and unit preference behavior are unchanged.
The badge always displays `5K`; progress outside the artwork follows app units.

## Artwork

- One softened vertical hexagon, 100-unit viewBox, .95-unit border.
- Muted sage palette, near-black opaque interior and restrained ambient fill.
- Didot lining numeral lettering, Avenir Next supporting copy, outlined as paths.
- Exact copy: `5K`, `PER WEEK`, `STRIDEOS`, with two bottom chevrons.
- Three states: unlocked, locked and transparent. Share-opaque is an exact alias
  of unlocked, not a fourth set. Share-transparent aliases transparent.
- Every lettering element is centered by its visible ink bounds, not font advance.

## Council

Reference/Theme Lead initially required revision: the numeral occupied 50.5% of
frame width instead of the reference's approximately 38-42%. The Chair accepted
the recommendation to fit the combined numeral horizontally by .81 while keeping
height and baseline fixed. This fitting is baked into vector paths, shared across
all states, not a state-specific transform or runtime font substitution.

Second visual review: scoped preview PASS, no remaining high or medium findings.
The numeral now occupies 40.9% of frame width and retains a 21.49-unit height.
Didot's terminals differ from the low-resolution reference. This is documented
vector interpretation, not an exact typeface or pixel match.

Independent System/Export/Product review: scoped preview PASS, no technical
findings. Fresh readback confirmed all three SVG/PNG pairs, fixed `5K` under both
unit preferences, the unchanged 5,000-meter threshold and all eight existing
milestones. Chair verdict: PASS for presenting this first preview to the user;
user approval, full-family completion and app integration remain separate gates.

## Local Validation

`validation.json` records 54 lettering raster checks across all three states at
48, 64, 96, 128, 256 and 800 px. Side margins differ by at most one raster pixel;
no frame collisions. Locked pixels are achromatic. Transparent backgrounds and
open interiors have alpha zero. Opaque interiors have alpha 255. Shared geometry
and both share aliases are identical. All artwork uses paths, no embedded images
or runtime font fallback.
All three saved PNGs also match fresh SVG raster pixels byte for byte.

The Weekly Distance, Streaks, lifetime distance source and protected watch paths
have no Git diff. Existing Firsts changes are preserved. Full app tests, native
compile, device verification, EAS build and submission were not run for this
preview-only work.

## Files

- `five-k-unlocked.svg/png`: first full-color badge.
- `five-k-locked.svg/png`: identical geometry, grayscale opaque state.
- `five-k-transparent.svg/png`: full-color true-alpha state.
- `five-k-comparison.png`: reference detail beside vector preview.
- `five-k-states.png`: the three canonical states.
- `five-k-sizes.png`: 48, 64, 96, 128 and 256 px review sheet.

Reproduce from the canonical repo root:

```sh
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/weekly-distance/outline-preview.py
node docs/handoff/badge-review/weekly-distance/render-preview.cjs
```
