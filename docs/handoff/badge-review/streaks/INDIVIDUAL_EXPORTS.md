# Approved Individual Streak Files

The user approved the ranked daily and specialty award artwork and requested
individual files, plus a design-council update. The approved geometry, rank
ranges, colors and three visual states are unchanged.

## Contents

Export root:
`/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local/docs/handoff/badge-review/streaks/individual-exports/`.

- `daily/unlocked/`, `daily/locked/`, `daily/transparent/`: each contains
  SVG/PNG pairs for every day from 1 through 365.
- `milestones/unlocked/`, `milestones/locked/`, `milestones/transparent/`:
  each contains SVG/PNG pairs for the ten existing awards at 7, 30, 50, 75,
  100, 150, 200, 250, 300 and 365 days.
- `manifest.json`: exact filenames, counts, hashes, state labels, original
  milestone IDs and source hashes.

Totals: 1,095 daily SVG/PNG pairs plus 30 milestone SVG/PNG pairs, or 1,125
pairs / 2,250 badge files. PNGs are 1024x1024; vectors use the same 100-unit
viewBox. Unlocked and locked have opaque badge interiors with alpha outside
the hexagon. Transparent has true alpha outside, through empty interior and
the flame center. There is no fourth opaque-share export set.

Daily filenames are padded for correct numeric sorting, e.g.
`daily/unlocked/streak-day-001-unlocked.png`.
Award filenames preserve the canonical milestone slug, e.g.
`milestones/unlocked/streak-7-day-unlocked.png`.

The separate folders serve daily-count display and canonical milestone IDs.
When the day number is the same, both use identical rendering. There are
still only ten specialty achievements, not 365 new achievement IDs. Counts
beyond 365 remain supported by the shared renderer and live review viewer;
the physical first-year export range does not cap the streak.

## Reproduce

Run from the canonical Developer checkout:

```sh
node docs/handoff/badge-review/streaks/export-individuals.cjs
node docs/handoff/badge-review/streaks/validate-individuals.cjs
```

The export is rerunnable and skips writing identical bytes. Source-hash
guards require refreshing `export-system.ts` if app tier data changes.
The six approved champagne reference files remain frozen and unchanged.

This task creates approved individual exports, not production replacements.
No Streak app component, achievement rule, other badge family, watch path,
build number, package dependency, EAS build or submission was changed.

## Verified Result

Independent Export QA: PASS for all 1,125 pairs and exact 2,250-file inventory.
Every SVG matches the fresh shared renderer; every 1024px PNG matches fresh
vector pixels. All palettes, labels, geometry, aliases, source hashes and
six frozen champagne hashes pass. All 375 transparent exports and 375 locked
exports pass true-alpha/grayscale checks. All 1,825 daily numeral rasters
across 48/64/96/128/256 px pass margins within one pixel, with zero clipping
or glyph/title/frame overlap. Evidence: `individual-validation.json` in
the parent Streaks review directory.

Chair scope: completed approved individual exports. Native phone/watch
rendering, production replacement, build and submission remain unperformed.
