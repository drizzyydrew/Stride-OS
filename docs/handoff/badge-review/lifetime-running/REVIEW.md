# Lifetime Distance Running: One-Mile Preview

Status: the user approved this one-mile design on October 14, 2026 with
"Yes perfect" and requested completing Running and Cycling. These remain
approved review files, not app assets. Full-family previews are in
`../lifetime-distance/`; individual family acceptance and app replacement
remain separate from approval of this styling direction.

Scope: recreate the Lifetime Distance Running family from the user's overall
reference sheet, beginning with one 1-mile badge before completing the ladder.
Firsts, Cycling, Mountains/Elevation and all other families remain unchanged.

Source: `reference-sheet.jpg`, copied from the user's attachment. The source
photo is used only in QA comparison crops, never embedded in vector artwork.
The low-resolution photographed sheet is a composition reference, not an exact
colorimetric or pixel-identical target.

Preview: `one-mile-unlocked.svg` and same-stem PNG. Other states are
`one-mile-locked` and `one-mile-transparent`. `one-mile-states.png` presents
all three on a neutral canvas; its canvas is not part of transparent artwork.
`one-mile-comparison.png` enlarges the reference detail beside the vector.
`one-mile-sizes.png` covers 48/64/96/128/256 px.

Design: single softened diamond, 0.95 outline, muted green/sage palette,
near-black interior with restrained light, large Didot lining numeral,
regular Avenir Next unit lettering, tracked medium wordmark, two chevrons.
The small Firsts subjects in this wider sheet do not supersede the separately
approved and integrated Firsts designs.

Typography is vector outlined. Didot's Unicode cmap defaults to oldstyle
numerals; the Mac Roman cmap selects the tall lining 1 in this reference.
Visible ink bounds, not advance widths or guessed x offsets, center all three
labels at x=50. Font file hashes and bounds are stored in `typography.json`.

One renderer supplies exactly three states. `share-opaque` is byte-identical
to unlocked and `share-transparent` to transparent. Geometry is identical
across states. Empty interior and exterior of transparent exports have real
alpha zero; locked exports are fully neutral grayscale.

Reproduce from the canonical Developer checkout:

```sh
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/lifetime-running/outline-preview-type.py
node docs/handoff/badge-review/lifetime-running/render-preview.cjs
```

Local validation: SVG geometry/state parity, no embedded images/runtime text,
alias equality, grayscale pixels, true alpha, label bounds and numeral pixel
centering at 48/64/96/128/256/800 px. Numeric raster margins are equal in
all 18 state/size cases. Details are in `validation.json`.
No production integration, full suite, native compile, device check, build,
submission or release was performed for this preview.

## Council

Independent Reference Fidelity / Theme / Small-Size review: PASS for user
presentation. The corrected tall lining 1 has an angled flag and baseline
foot; its ink height is about 26% of the diamond height. Thin frame, muted
olive/sage palette, lighter unit, tracked wordmark and two chevrons preserve
the reference hierarchy. At 48/64 px fine lettering diminishes; the numeral
remains identifiable. No blocking visual changes found.

Independent Architect / Export QA review: PASS for the preview implementation
and export validation. Fresh SVG/PNG outputs, state geometry, aliases, outlined
type, grayscale, alpha and all 18 numerical pixel-margin checks were verified.

Cross-examination: ink-bound equality is measurable but does not guarantee
perceived mass centering of an asymmetric numeral. Low-resolution reference
pixels do not establish exact vector geometry, colorimetry or native rendering.
Chair verdict: PASS for presenting this single-badge preview to the user.
Full-family approval, integration, native/device validation and release remain
separate. Do not replace production files until the user approves the preview.
