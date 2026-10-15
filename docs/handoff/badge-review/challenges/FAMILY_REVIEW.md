# Challenges Family Review

October 15, 2026. The user approved August Base Builder and requested the rest of
the family and a design-council update. This authorizes artwork exports, not app
replacement, a build, submission or release. The user subsequently accepted the
set and requested replacing 5K Month with 150K Month and adding 200K Month. That
revision is complete in the review exports, without changing app award rules.

## Inventory

Thirteen review presentations, three states each: **39 SVG/PNG pairs, 78 artwork
files**, under `individual-exports/{unlocked,locked,transparent}/`. The manifest
records filenames, canonical IDs and SHA256 values. `share-opaque` aliases
unlocked exactly and `share-transparent` aliases transparent; no fourth state.

| Existing Presentation | Subject | Theme |
| --- | --- | --- |
| August Base Builder | Frozen approved hollow runner, sun and hills | Copper |
| September Consistency Challenge | Six-block calendar | Teal-green |
| Winter Strength Block | Canonical hollow strength equipment | Steel-blue |
| Spring Mileage Build | Layered peaks and winding approach | Muted green |
| Summer Long Run Challenge | Low sun and receding route | Coral/amber |
| Elevation Month | Faceted alpine peaks | Violet |
| 25K Week | Centered lining 25K numeral | Indigo-blue |
| 50K Month | Centered lining 50K numeral | Teal |
| 100K Month | Individually fitted lining 100K numeral | Gold |
| 150K Month | Individually fitted lining 150K numeral | Mauve |
| 200K Month | Individually fitted lining 200K numeral | Steel-blue |
| Strength + Run Challenge | Approved shoe/equipment geometry | Rose |
| Recovery Consistency Challenge | Heart and open renewal arrows | Olive/sage |

Reference: `../lifetime-running/reference-sheet.jpg`. August's accepted vector
treatment controls frame/typography where it differs from the soft raster. The
reference's additional blue calendar challenge is not in the source definitions
and was not invented as an award. These are vector interpretations,
not raster traces or a claim of pixel identity.

## Source And Geometry

- One shared softened hexagon: x=12..88, y=5.5..94.5, outline width 1 in a 100-unit
  viewBox. No inner bevel, nested rings, wordmark or chevron footer.
- Each badge uses one fitted drawing across all states. Locked is truly neutral
  grayscale; transparent removes the opaque interior and ambient treatment.
- Centered Avenir Next Medium titles and Didot lining numerals are outlined paths,
  never platform font fallbacks. Every title and hero number is fitted separately.
- The six approved August files are byte-identical to their frozen hashes.
- The barbell comes from the canonical Strength adapter. The shoe/barbell pair
  reuses the approved Strength review glyph. The calendar uses canonical Firsts
  geometry. No alternate stock equipment or human icon was introduced.
- The canonical app snapshot remains twelve definitions: seven globally included
  and five reused IDs, unchanged. `presentations` is a separate review overlay:
  remove `challenge_5k_month` from this set, add existing `monthly_run_150k` and
  `monthly_run_200k` at 150,000m and 200,000m, both globally excluded. The review
  set therefore has six Challenges-owned and seven reused presentations. This
  does not disable the app's existing 5K achievement or create duplicate awards.
  Existing August/September/season names and all unlock/calendar/unit rules are
  preserved. Fixed K lettering does not become miles under imperial settings.
- Elevation Month is a Challenges presentation, not the excluded mountain-card
  family; its threshold remains pending and it remains non-earnable. No separate
  elevation assets or evaluation logic were edited.

## Verification

Local automated result: **PASS** in `family-validation.json`:

- All 39 freshly rendered SVG/PNG pairs match; exactly 78 exported artwork files.
- 792 per-part/state/size raster checks at 48, 64, 96, 128, 256 and 800 px: equal
  horizontal ink margins within one pixel, no clipping, no border collisions and
  no glyph/title pixel overlaps. Spring's one-pixel 48px path/title touch was fixed
  by shortening the route before the final passing run.
- All thirteen locked exports checked pixel-by-pixel for grayscale. All thirteen
  transparent exports checked for real exterior and empty-interior alpha; the
  hollow August runner also retains alpha through its body.
- State geometry and exact share aliases match. SVGs have no embedded raster,
  external references or runtime text. Colored transparent review-board panels
  are not part of exported assets.
- Ten source hashes include evaluation files and Monthly Distance definitions/
  thresholds, not just artwork. All 66 files for the eleven unchanged designs
  match the pre-revision hashes in `distance-change-baseline.json`; exactly six
  old 5K files were removed from active review exports with hash-guarded deletion.
  August's six hashes and all preceding Strength/Recovery export hashes preserved.
- Scoped Challenges, Strength, Recovery, elevation and watch production diffs are
  empty. No app code, native configuration, build number or release was changed.

## Council Closeout

**Chair: PASS for the thirteen review artworks and exports.** App/native/release
signoff is outside this review.

- Reference/theme/small-size reviewer inspected the original family, then the
  replacement 150K and added 200K across all states and 48..256px sheets. The
  other eleven designs are byte-identical. Final focused visual verdict PASS,
  with no remaining high/medium findings. Tiny lettering and hollow equipment
  details soften at 48px; compact artwork still needs external accessible labels
  when it is eventually integrated into the app.
- System/export reviewer independently confirmed all 39 SVGs match the current
  renderer, all 39 PNGs match fresh pixels, and all 78 file hashes match. Ten
  source hashes, unchanged twelve app definitions, thirteen review presentations,
  66 preserved export hashes and six August hashes pass; all six retired 5K paths
  are absent. Final bounded technical readback PASS. The reviewer did not repeat
  the 792 local raster loops. Strength/Recovery hashes also pass local preservation.
- Cross-examination closed two findings: evaluation-source hashes were added to
  close a provenance gap, and unsupported split rules under the four distance
  numerals were removed. All exports/boards and local checks were rerun, followed
  by final independent visual and fresh-render readbacks.
- `git diff --check` passed. Original rate-limited preview review notes are
  historical; they do not describe this final successful family council review.

Artwork progress is now **80%: eight of ten in-scope families**. Run Levels and
Monthly Distance remain. This is family-artwork/export progress, not a count of
globally unique awards, app integration, separate user acceptance of every new
glyph, or release readiness. The separate Mountain/Elevation family is excluded.

## Reproduce

From `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`:

```sh
npx tsx docs/handoff/badge-review/challenges/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/challenges/outline-family.py
node docs/handoff/badge-review/challenges/render-family.cjs
node docs/handoff/badge-review/challenges/freeze-approved.cjs
git diff --check
```

Boards: `challenges-{unlocked,locked,transparent}.png` and corresponding
`challenges-{state}-sizes.png`. App tests, native compile, EAS, Apple processing
and device rendering were intentionally not run for these review-only exports.
