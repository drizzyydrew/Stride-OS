# Strength: First Strength Session Preview

Created October 14, 2026 after the user accepted the completed Weekly Distance
family, requested a design council update, and asked to move to the next family.
The user approved this preview with "Excellent Perfect update the design council
agent and finish the rest and move on to the next". The full family is now complete
under that approved direction; see `FAMILY_REVIEW.md`. This does not authorize app
replacement. Current family progress is recorded in `../REDESIGN_PROGRESS.md`.
State variants and daily counters do not inflate progress.

## Sources and Construction

Reference: `../lifetime-running/reference-sheet.jpg`, Strength section.
`definitions.json` comes from the ten current Strength definitions and records
four source hashes. This artwork represents existing `first_strength_session`
with the exact copy `FIRST STRENGTH / SESSION`, threshold one qualifying session.
It does not create a new achievement or change registry membership.

The equipment uses the canonical `../strength-preview-adapter.cjs`, also used by
the accepted Firsts strength artwork. Its shaft and three graduated plates per
side retain bilateral symmetry. A uniform .8 fit around x=50, y=38.9 produces
the smaller first-session equipment scale in the reference, without redrawing
or modifying canonical equipment geometry. Hollow plates are a deliberate
vector adaptation of the photograph's softer metallic treatment, not pixel identity.

Single softened hexagon x=12..88, y=5.5..94.5 in a 100-unit viewBox, stroke 1.
Near-black interior, restrained graphite/silver outline and off-white lettering.
No inner bevel or nested contours. Avenir Next Medium outlined title size 7,
baselines 62/69.5; wordmark size 3.4, baseline 78.5, tracking .6. Exactly two
chevrons y=83..90. All lettering is centered by visible ink bounds.

## States and Validation

Three canonical states from one renderer: unlocked, locked, transparent.
Unlocked and locked have opaque interiors. Locked is neutral grayscale.
Transparent retains full-color geometry with true alpha in empty interior and
exterior. Share-opaque aliases unlocked; share-transparent aliases transparent.
No fourth separate artwork set, no runtime font fallback or embedded raster art.

`validation.json`: 72 raster margin checks (glyph plus three lettering elements,
three states, six sizes: 48, 64, 96, 128, 256 and 800). Equal side margins within
one pixel, no frame collisions, alpha and grayscale checks pass. All three
saved PNGs match fresh SVG pixels. Canonical plate symmetry and four source
hashes match. Strength, Weekly Distance and protected watch Git diffs are empty.

Fine hollow plate interiors can become subpixel at 48/64; do not change the
geometry silently by size or state. This is subject to visual review and user
approval, not a native/device fidelity claim.

## Council Verdict

Reference / Theme / Small-Size Lead: scoped preview PASS. The .8 equipment fit
resolves the larger-glyph mismatch for the first-session reference. Steel palette,
title/footer hierarchy and three-state appearance have no high or medium findings.
At 48px, fine plate interiors and tiny lettering lose definition; documented as a
preview-size tradeoff, not user approval to change canonical artwork.

System / Export / Product Lead: independent read-only PASS. Verified all three
fresh SVG/PNG pairs, canonical equipment symmetry, state aliases, alpha, grayscale,
72 raster checks, four source hashes and unchanged app/watch paths. Confirmed the
50% progress calculation: five of ten non-elevation families, Strength preview not
counted as finished. Cross-examination left no unresolved technical objection.
Chair: PASS for presenting this first Strength preview; full-family approval and
app/native/release signoff remain separate.

No app integration, full-app tests, native build, EAS build, submission or release
was performed. Unrelated Firsts edits and previous family exports are preserved.

## Files

- `first-session-{unlocked,locked,transparent}.svg/png`: individual preview art.
- `first-session-comparison.png`: reference detail and recreated vector.
- `first-session-states.png`: three-state contact sheet.
- `first-session-sizes.png`: 48, 64, 96, 128, 256 px review sheet.

Reproduce from the canonical Developer checkout:

```sh
TSX_DISABLE_CACHE=1 node --import tsx docs/handoff/badge-review/strength/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/strength/outline-preview.py
node docs/handoff/badge-review/strength/render-preview.cjs
```
