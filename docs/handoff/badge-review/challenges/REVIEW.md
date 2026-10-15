# August Base Builder Preview

Initial preview: October 14, 2026. User approved the August design on October 15
and requested the complete family. Current family exports and review are recorded
in `FAMILY_REVIEW.md`; the notes below document the original preview review.

## Source And Scope

- Reference: `../lifetime-running/reference-sheet.jpg`, lower-left Challenges block.
- Canonical ID: `challenge_august_base_builder`; existing title: August Base Builder.
- August is the existing fixed month, not a current-month label. No names, IDs,
  thresholds, calendar logic, unit settings or registry memberships are changed.
- Twelve existing Challenges presentations include seven globally registered
  definitions and five reused achievements. No additional awards are created.
- Source snapshots and SHA256 values are in `definitions.json`.
- Mountain/elevation assets, production Challenges assets, app and watch code
  were not edited. Existing Firsts changes were preserved.

## Artwork

One softened copper hexagon, near-black interior, sun and restrained layered
landscape, with the already approved hollow Firsts runner in the foreground.
The landscape is masked behind the runner, leaving real alpha in the hollow body
in transparent exports. Titles are outlined Avenir Next Medium paths centered
by visible ink bounds. The reference Challenges block has no wordmark/chevron
footer, so none is added. This is a vector interpretation of the low-resolution
reference, not a traced raster or a claim of pixel identity.

`artwork.cjs` derives unlocked, locked and transparent states from one drawing.
Locked colors are neutral grayscale. Transparent omits the dark interior and
ambient background. `share-opaque` is byte-identical to unlocked;
`share-transparent` aliases transparent. There is no fourth asset state.

## Local Review

Reference/theme: subject, copper color identity, single border and two-line
hierarchy checked against the supplied sheet. No generic icon or stick figure.
System/export: three SVG/PNG pairs, shared geometry, no raster embeds or runtime
fonts; exported pixels match fresh SVG renders. Small-size review inspected
48, 64, 96, 128 and 256 px, with additional 800 px validation.

Cross-examination: a black painted cutout would invalidate photo-overlay alpha;
the actual implementation uses a mask instead. Additional footer artwork would
change this reference composition and is deliberately excluded. Titles can be
too small to read at 48 px; this preview does not introduce an alternative
compact geometry or claim native accessibility verification.

Local checks: **PASS**, 18 state/size combinations, equal horizontal frame
margins within one raster pixel, no clipping, no content/frame collisions,
grayscale locked pixels and interior/exterior alpha. See `preview-validation.json`.
`git diff --check` also passed. These are preview/export checks, not application
tests, native compilation, EAS, submission, Apple processing or device testing.

Council agents were attempted but both failed with rate-limit errors. The role
checks above are a local self-review, not an independent council signoff.
Original chair status was **REVISE / pending user preview approval and independent
review**. User preview approval has since been received. Refer to the family
review for the current independent review status. Neither approval authorizes
production replacement or a release.

## Reproduce

From the canonical Developer checkout:

```sh
npx tsx docs/handoff/badge-review/challenges/export-definitions.ts
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B docs/handoff/badge-review/challenges/outline-preview.py
node docs/handoff/badge-review/challenges/render-preview.cjs
```

Preview files: `august-base-builder-{unlocked,locked,transparent}.{svg,png}`.
`august-three-states.png` demonstrates transparent art over a colored panel;
that panel exists only in the review board, not the transparent asset.
