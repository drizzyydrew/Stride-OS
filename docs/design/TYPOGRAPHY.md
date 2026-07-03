# Typography

Status: official Phase 2 type guidance.

## Typeface

Use the native iOS system stack for app UI:

- iOS: San Francisco / system font.
- React Native: default platform font unless a screen already has a deliberate custom font.
- Numeric metrics should use tabular numbers when available.

Do not introduce a decorative display font for Phase 2 run surfaces.

## Type Philosophy

The reference relies on very large numeric metrics, compact uppercase labels, and short action text. Typography should make elapsed time, distance, and run state instantly scannable.

## Scale

| Role | Size | Weight | Line Height | Notes |
| --- | ---: | ---: | ---: | --- |
| Hero metric | 56-64 | 700-800 | 1.0 | Live Activity time and distance |
| In-run primary metric | 30-36 | 700-800 | 1.05 | Time and distance on run screen |
| Widget secondary metric | 20-24 | 700 | 1.05 | Pace, heart rate, elevation |
| Card title | 15-17 | 700 | 1.2 | Row and widget title |
| Settings row label | 14-16 | 500-600 | 1.25 | Toggle and picker rows |
| Metric label | 10-12 | 600-700 | 1.1 | Uppercase preferred in widgets |
| Helper text | 11-13 | 400-500 | 1.35 | Settings explanations only |
| Button label | 15-18 | 700-800 | 1.1 | All caps only for single primary action |

## Number Treatment

- Use tabular numbers for timers, distance, pace, BPM, and elevation.
- Keep unit labels smaller than metric values.
- Use `/mi`, `bpm`, `ft`, and `mi` exactly as shown in the reference.
- In compact widgets, do not over-label units if the value is already clear.
- Preserve decimal alignment for distance.

## Label Treatment

Live Activity labels:

- Uppercase.
- 10-12 pt.
- Letter spacing may be slightly positive.
- Color should be secondary, never primary.

In-app run labels:

- Title case or compact sentence case is acceptable.
- Labels sit directly under values.
- Avoid extra instructional text while a run is active.

Settings labels:

- Sentence case.
- Clear and direct.
- Avoid abbreviations unless the metric itself is standard.

## Button Typography

Primary run controls:

- Label weight: 700-800.
- Icon and label align visually centered.
- `PAUSE` and `RESUME RUN` may be uppercase.
- Settings and list rows should not use uppercase.

## Typography Rules

- Do not scale font size with viewport width.
- Do not use negative letter spacing.
- Avoid multiline primary metrics.
- If labels crowd, reduce secondary metric density before shrinking primary metrics.
- Never let timer text clip in Live Activities.

