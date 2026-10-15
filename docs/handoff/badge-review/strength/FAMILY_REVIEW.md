# Strength Family Exports

## Approval and Scope

On October 14, 2026 the user approved First Strength Session and authorized the
remaining family with "Excellent Perfect update the design council agent and
finish the rest and move on to the next". All ten artworks and exports are
complete under that direction. Subsequent feedback, "The strength looks Great",
accepted the completed family. Artwork approval does not authorize app integration,
production replacement or release.

Reference: `../lifetime-running/reference-sheet.jpg`, Strength section. All six
approved `first-session-{unlocked,locked,transparent}.{svg,png}` files are unchanged,
pinned in `approved-first-session-hashes.json`.

## Canonical Artwork and Definitions

`definitions.json` reads current source definitions, preserving ten IDs, their
thresholds, labels and membership. There are nine globally registered Strength
achievements; `first_structured_workout` retains `includeInGlobalRegistry: false`
and is a shared existing achievement, not another new unlock.

`artwork.cjs` drives the shared approved frame/state/footer. `family-artwork.cjs`
provides five fitted glyph types and `family-typography.json` the outlined copy:

- First Session: frozen approved smaller canonical barbell (.8 uniform scale).
- 10, 25, 50, 100 sessions: larger canonical barbell, centered count and SESSIONS.
- 6 and 12 weeks: serif count/TOTAL, rising line and small terminal star.
- Strength + Run Week: custom outlined training shoe and canonical equipment.
- First Structured Workout: the accepted Firsts calendar geometry, recolored steel.
- Prehab & Resilience: shield with three internal chevrons.

Single softened hexagon, 100-unit viewBox, 1-unit border; steel/off-white identity
and near-black interior. Shared outlined Avenir Next copy, small tracked STRIDEOS
and exactly two footer chevrons. Longer titles fit individually by visible ink
bounds. Every state shares its badge's geometry and placement. The reference's
metallic shading is interpreted as clear canonical linework, not pixel identity.

## Exports and QA

`individual-exports/{unlocked,locked,transparent}/` contains 30 SVG/PNG pairs:
60 artwork files plus `manifest.json`. PNGs are 800 x 800. No opaque fourth set:
share-opaque aliases unlocked exactly; share-transparent aliases transparent.

Family sheets: `strength-{unlocked,locked,transparent}.png`.
Size sheets: `strength-{unlocked,locked,transparent}-sizes.png`.
`family-validation.json`: PASS, 720 centering/frame checks at 48, 64, 96, 128, 256
and 800 px. Maximum side-margin difference one pixel; no frame collisions or
clipping. All ten grayscale and transparent state checks pass. Every saved PNG
matches fresh SVG pixels. Five source hashes and six approved baseline hashes match.

## Council

Reference / Theme / Small-Size Lead: scoped family preview PASS. No high or medium
findings across all ten artworks, three states and five review sizes. Independently
verified grayscale, sampled transparent alpha and frozen first-session hashes.

System / Export / Product Lead: independent read-only PASS on all 30 fresh SVG/PNG
pairs, exact 60-file inventory, five source hashes, six frozen hashes and 720
centering/clearance checks. Confirmed ten source IDs and unchanged thresholds,
global registry count nine and correct ampersand XML escaping. No state drift,
layer collisions, clipping or app/watch changes. Cross-examination left no
outstanding objection. Chair: PASS for completed artwork and export QA only.

Fine plate interiors and tiny copy lose definition at 48 px. This remains a
documented small-size tradeoff, not authorization to change accepted geometry.
Native/device fidelity has not been verified. No full-app tests, builds, EAS
submission, release, commits or production replacements were performed here.

## Reproduction

From the canonical Developer checkout:

```sh
TSX_DISABLE_CACHE=1 node --import tsx docs/handoff/badge-review/strength/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/strength/outline-family.py
node docs/handoff/badge-review/strength/render-family.cjs
```
