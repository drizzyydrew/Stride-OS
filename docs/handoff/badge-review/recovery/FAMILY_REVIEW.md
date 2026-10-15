# Recovery Family: Vine Frame Exports

## Approval and Scope

On October 14, 2026 the user approved the revised vine/hammock preview with
"Great update the design council agent and finish". This authorizes completion
of the seven existing Recovery artworks under that approved direction, not app
integration, production replacement, native/device verification or release.
It does not separately establish user acceptance of every new center composition.

The latest written request for vines framing a central recovery/relaxation symbol
supersedes the original leaf-cycle photograph's glyph. The approved baseline is
`vine-hammock/recovery-week-vines-{unlocked,locked,transparent}.{svg,png}`; all six
remain byte-identical, pinned in `approved-vine-hammock-hashes.json`.

## Canonical System

One master frame/state renderer in `artwork.cjs`, and the accepted mirrored vine
definition in `vine-hammock/`, drive every badge and state. Thin softened hexagon,
muted sage palette, ten tapered leaves and open curved stems, centered outlined
titles and no footer wordmark/chevrons. All states share the same geometry.

`central-glyphs.json` records the six new center definitions. `family-artwork.cjs`
selects by canonical achievement ID, rather than legacy glyph enum names that
do not align with some reference-sheet subjects. Source enums, IDs, thresholds,
progress kinds and evaluation rules are not modified.

| Existing ID | Fitted Center |
| --- | --- |
| `recovery_week_completed` | Frozen approved plain hammock |
| `recovery_sleep_consistency` | Star constellation over a calm rest curve |
| `recovery_smart_rest_day` | Distinct visible sun cue above the canonical hammock |
| `recovery_readiness_respected` | Compact peaks and summit flag |
| `recovery_symptoms_reported_early` | Droplet, restrained ripples and early-signal accent |
| `recovery_check_in_streak` | Seven discrete check-ins plus a check |
| `recovery_returned_gradually` | Gradually ascending stepping stones and curved route |

Stars, peaks/flag, hammock, ripples and gradual stones draw on the remaining
reference subjects. The sun differentiator and seventh check-in composition are
authored interpretations of canonical behavior, not claims of exact photographed
art. No elevation-family asset or imagery has been changed.

`outline-family.py` computes actual center bounds using FontTools and centers
visible ink, then fits each existing title. Approved Week typography is unchanged.
Long lower lines fit inside the narrowing lower hex, retaining their full text.
The first implementation's flag touched foliage at 48px and REPORTED EARLY touched
the frame. A compact flag and individually fitted lower title resolved both.

## Exports and Local QA

`individual-exports/{unlocked,locked,transparent}/`: 21 SVG/PNG pairs, 42 artwork
files and `manifest.json`. SVG viewBox is 100 x 100; PNGs are 800 x 800. Locked is
entirely gray, unlocked and locked have opaque near-black interiors, and transparent
has genuine exterior/empty-interior alpha. Share-opaque aliases unlocked exactly;
share-transparent aliases transparent. No fourth set.

Contact sheets: `recovery-{unlocked,locked,transparent}.png`.
Small-size sheets: `recovery-{unlocked,locked,transparent}-sizes.png`.
`family-validation.json`: PASS, 612 margin/frame checks and 126 center/foliage
separation checks over all states at 48, 64, 96, 128, 256 and 800 px. Side margins
differ by at most one pixel. No frame clipping or center/vine overlap. Seven
grayscale and seven transparent checks pass; every PNG matches fresh SVG pixels.

Four source hashes, all six approved V2 hashes, all six preserved V1 hashes and
all 60 accepted Strength artwork hashes match. Scoped app and protected watch
diffs are empty. Full-app tests and native builds were intentionally not run for
preview/export-only work. No build, submission, release or commit was performed.

## Visual Council

Reference / Theme / Small-Size Lead: scoped family preview PASS. No high or medium
findings across all seven badges, three states and five review sizes. Smart Rest's
sun distinguishes it from the plain hammock at 48/64. All centers remain clear of
the vines; compact flag and fitted lower copy have adequate clearance. Independently
verified seven grayscale exports, sampled transparent alpha and twelve unchanged
V1/V2 hashes. Fine veins, stitching and tiny copy soften at 48px as documented.

System / Export / Product Lead inspected the ID-based implementation, shared
renderer, aliases and geometry comparison without concrete high or medium issues.
Independent bounded readback PASS: all 21 saved SVGs match the current renderer,
all 21 PNGs match fresh pixels, four source hashes, six approved V2 hashes, six
preserved V1 hashes and 60 Strength hashes match. All seven exported definitions'
IDs, thresholds, progress kinds and titles match actual source. The 612 margin
and 126 center/vine checks are from the local generator, not a claim of a second
independent repetition of those raster loops. Cross-examination left no unresolved
finding. Chair: PASS for completed family artwork/export QA only.

## Reproduction

From the canonical Developer checkout:

```sh
TSX_DISABLE_CACHE=1 node --import tsx docs/handoff/badge-review/recovery/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/recovery/outline-family.py
node docs/handoff/badge-review/recovery/render-family.cjs
```
