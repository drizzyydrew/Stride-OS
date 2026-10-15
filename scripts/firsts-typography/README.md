# Firsts Typography

This worker writes only `src/achievements/firsts/firstsTypography.ts` and its
generation manifest in this directory. It reads the 15 approved unlocked SVGs
and both unlocked metric race snapshots in
`docs/handoff/badge-review/firsts-complete`. It never writes the renderer,
glyphs, app/watch code, package configuration, tests, or production assets.

## Runtime Contract

- `FIRSTS_TITLE_PATHS`: all 15 canonical `FirstAchievementId` keys, containing
  every approved title line at its original size, x position and baseline.
- `FIRSTS_WORDMARK_PATH`: Arial regular STRIDEOS at x=50, baseline=76.6,
  size=4.35 and letter-spacing=0.65.
- `FIRSTS_SHIELD_TEXT_PATHS`: 5K, 10K, 13.1, 21.1, 26.2 and 42.2, each at
  x=50 and baseline=42.8. Sizes remain 15.5 for short labels and 14.4 for
  decimals. The renderer must retain the shield parent's `translate(0 -3)`;
  the exported paths do not contain that translation.

Each value is complete SVG path markup in the 100-unit badge viewBox, with
`data-text`, `fill="currentColor"` and `stroke="none"`. The explicit stroke
prevents a parent glyph group's stroke from thickening the regular lettering.
Replace `currentColor` with the state palette color when inserting into the
renderer, or set an inherited SVG `color`. There are no runtime text elements,
font lookups, font binaries or new application dependencies.

## Reproduce

From the canonical Developer checkout:

```sh
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B scripts/firsts-typography/generate.py
/Users/drew/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B scripts/firsts-typography/generate.py --check
node scripts/firsts-typography/validate.cjs
```

Generation uses existing bundled fontTools and Pango/Cairo symbols from the
bundled Sharp libvips dylib on macOS. `FIRSTS_PANGO_LIBRARY` can select that
dylib explicitly; `FIRSTS_SHARP_MODULE` can select the matching existing Sharp
module for validation. No dependency installation or app build is required.
Keep the outlining and validation runtime versions fixed when reproducing an
existing export. Changing the engine or fonts is a typography change that
requires rerunning visual comparison.

The fonts are the system-supplied regular faces at
`/System/Library/Fonts/Supplemental/Arial Narrow.ttf` and
`/System/Library/Fonts/Supplemental/Arial.ttf`. The generator records their
SHA-256, family/style, PostScript name and version. It registers these files
with a private in-process Fontconfig configuration, requires Pango to resolve
the exact files, disables fallback and verifies all characters exist in the
font cmap. It preserves Pango kerning and tracking, turns hinting/metric
rounding off, and outlines at the approved preview's 8x scale. The manifest
records the Pango version, dylib SHA-256, source SHA-256 and outline bounds.
Font files are never copied into the repository.

Validation outputs are in the system temporary directory under
`strideos-firsts-typography-qa` (override with `FIRSTS_TYPOGRAPHY_QA`). They
include `validation.json`, full badge comparisons, individual outlined PNGs
and four text comparison sheets. In every comparison, approved text is on the
left and outlined text is on the right. These are disposable QA images, not
production assets. Run Python with `-B` to avoid writing bytecode cache files.

## Verified Result

The initial run used Pango 1.58.2, Cairo 1.18.6, librsvg 2.63.2 and Sharp
0.35.5. All 17 current SVG renders reproduced their saved 800px PNG snapshots
exactly, confirming the reference renderer rather than assuming font
availability. The macOS default Pango rendering backend is CoreText; the
outlining worker uses Fontconfig/FreeType for verifiable file selection.

- 174 isolated text comparisons: 29 unique lines at 48, 64, 96, 128, 256 and
  800px, including all six shield labels and wordmark tracking.
- Maximum raster ink-boundary difference: 1px across those sizes. At 800px,
  28 of 29 comparison bounds are identical; the 8-unit WORKOUT line's right
  edge is 1px different at the validation alpha threshold of 16/255.
- Maximum normalized alpha difference at 800px: 1.0711% (the wordmark).
  The outlines therefore preserve appearance and metrics within the measured
  raster tolerance; they are not claimed to be pixel-identical SVG text.
- Zero text pixels outside the badge/shield containers at 800px.
- Focused semantic TypeScript check against the actual canonical ID union,
  deterministic regeneration, and no runtime text elements passed.

Validation fails on changed reference hashes, blank text, source-render drift,
missing runtime paths, clipping, an ink-boundary shift greater than 1px, or a
normalized alpha difference above 2% at 800px / 10% at the smaller sizes.
Native SVG rasterization can have different antialiasing. Native/device
rendering, complete renderer integration, asset generation and builds remain
the main integration task's verification responsibility.

## Typography Review

Single-agent StrideOS design council, scoped to typography: PASS within the
documented raster tolerance. Reference fidelity and theme checks used the
approved PNG/text comparison sheets for all 15 badges and metric snapshots;
regular letterforms, centered titles and tracked wordmark are preserved.
Architecture and integration checks confirmed complete path-only exports,
all canonical IDs, palette replacement and a single renderer-owned shield
translation. Export QA confirmed no clipping, snapshot drift or font fallback.
Small-size review retains the approved delicate text rather than changing its
weight; tiny wordmark readability is inherited from the approved layout.
This review does not claim production integration or device verification.

Repository instructions and the versioned Expo SDK 56 documentation were read
before implementation:
https://docs.expo.dev/versions/v56.0.0/ and
https://docs.expo.dev/versions/v56.0.0/sdk/svg/.
