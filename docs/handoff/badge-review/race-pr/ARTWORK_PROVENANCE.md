# Race PR artwork provenance and review scope

The owner requested new PR badges for 800 meters, 1 mile, 5K, 10K, half marathon
and marathon, asking that the prior StrideOS badge process and design council be
used. This is a new derivative family; none of these new renders is represented
as previously approved PR artwork or as native-device acceptance.

## Existing sources inspected

- Production First 5K: `assets/achievements/firsts/firsts-first-5k-unlocked.png`.
- Approved Weekly 5K: `docs/handoff/badge-review/weekly-distance/five-k-unlocked.png`.
- Firsts canonical frame, palette and typography: `src/achievements/firsts/`.
- Existing CoreText outlining tool: `scripts/legacy-challenge-typography/outline.swift`.
- Existing shared Sharp raster tooling: `scripts/lib/firstsRasterizer.ts`.

New artwork imports Firsts' exact `FIRSTS_HEXAGON_PATH`, warm-gold/dormant palettes
and outlined `FIRSTS_WORDMARK_PATH`; its two-chevron path is the same geometry.
Existing Firsts/Weekly source and assets were not edited. The custom monoline
stopwatch and new labels are original repo-native vector artwork, with no
third-party icons, logos, stock imagery or generated raster substituted for the
canonical vector source. Distance is event identity, not a prestige/color rank.

The exact regular Arial Narrow PostScript face `ArialNarrow` is verified for
every CoreText glyph run before outlining. Glyph paths are centered by visible
ink bounds and individually fitted horizontally; long Half Marathon and 800M
labels do not force a global small title size. The system font's SHA-256 and
actual label bounds/fits are in `typography.json`. Font files are not copied into
the repository, and runtime rendering does not load fonts or a font engine.

## One canonical source

`src/achievements/racePr/racePrArtwork.ts` renders all six definitions and native
`RacePrBadge` imports that renderer. Generation, review boards, and validation use
the same renderer. IDs deliberately use `race_pr_*` and do not replace or alias
legacy fastest-segment records, Firsts or distance milestones.

Exactly three states exist: unlocked, locked, transparent. Share-opaque aliases
unlocked and share-transparent aliases transparent byte-for-byte. All states
keep fitted geometry; locked is achromatic, transparent has true empty-interior
and exterior alpha. Actual race times and progress remain outside the artwork.

Full badges show an explicit event title and NEW PR. HM and MAR inside the
stopwatch are supported by HALF MARATHON and MARATHON below, avoiding ambiguity
with meters or fixed-unit decimal distance labels. Compact mode uses the same
canonical stopwatch and face label under a uniform transform; no redraw or
state-dependent geometry. The group is centered using the visible crown-inclusive
bounds, improving 64-pixel balance and distance legibility while omitting footer
text. Accessibility labels retain each complete event name and earned/locked
state, with outer UI text supplying detail at very small sizes.

## Reproduce

From the canonical Developer checkout:

```sh
python3 -B docs/handoff/badge-review/race-pr/outline-typography.py --check
./node_modules/.bin/tsx scripts/generate-race-pr-assets.ts
./node_modules/.bin/tsx scripts/render-race-pr-review.ts
./node_modules/.bin/tsx scripts/validate-race-pr-assets.ts
```

The typography generator uses system Swift/CoreText without installing packages.
The production output contains 18 SVG/PNG pairs (36 files) plus one manifest.
The review-only boards are separate from production exports. Dark-blue panels
under the transparent review row demonstrate alpha; those panels are not baked
into the transparent SVG or PNG assets.

## Automated proof

`validation.json` records six badges, 18 fixed state-geometry checks, 18 fresh
canonical PNG comparisons, and 180 actual renders across 48, 64, 96, 128, 256
pixels in full and compact modes. It also checks ink centering, export-edge
clearance, grayscale, transparent interior/exterior, absent text/font/image/script
payloads and exact share aliases. PNG dimensions are 1024 × 1024. Native device
rendering, actual award events and release/delivery are distinct parent tasks.

The independent design reviewer inspected the existing approved references and
the actual new family/size PNG boards. The first pass requested a compact-layout
revision to improve optical balance; the same timing glyph was uniformly enlarged
and repositioned in compact mode, and all exports/review boards were revalidated.
Final council verdict is recorded separately by the parent/reviewer; automated
checks alone are not a visual signoff or individual user acceptance.
