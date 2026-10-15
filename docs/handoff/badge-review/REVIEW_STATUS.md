# Firsts Badge Review

This directory preserves the approved review artwork. Following the user's
explicit approval to overwrite the old files, the approved family is now
integrated into the canonical Developer clone. No build or submission is
authorized merely because production assets exist.

## First Activity

Approved by the user on October 13, 2026: "That is great".
Source: first-activity-preview.svg. Preserve its border, colors, title styling,
wordmark and two chevrons for subsequent previews.

## First Run

Approved by the user: "Excellent next". Source: render-first-run-preview.cjs, using the
First Activity preview as the common frame. Geometry is manually recreated;
reference pixels appear only in the comparison board, never in badge SVGs.

Single-agent design council:

- Reference Fidelity: Reviewed first-run-comparison.png. Running pose, floating
  circular head, bent arms, tapered legs and filled shoes match the intended
  outlined-figure construction. Four restrained motion lines stay clear of
  the body. The outline remains continuous around the waist and hips.
- Theme: Uses the exact approved First Activity shell, palette and typography.
- Architecture: One runner geometry produces unlocked, locked and transparent
  previews. Normal opaque share should use unlocked, not a fourth asset state.
- Export QA: Three 800x800 SVG/PNG pairs. Transparent outside and empty interior
  samples have alpha zero; no reference bitmap is embedded in the SVG.
- Small Size: Inspected 48, 64, 96, 128 and 256 px. Figure is recognizable; fine
  anatomical details and the small wordmark are reduced at compact sizes.
- Integration: None. No production, watch, connectivity or release changes.

Cross-examination: The reference has softer, tapered speed marks, whereas this
preview uses four clean monoline marks as required by the written spec. This
is an interpretation, not an exact pixel match. Font rendering still needs
native verification before production integration.

Chair verdict: PASS for presentation as a staged preview. The user has approved
First Run; native font/export checks remain required before production signoff.

## First Walk

Approved by the user: "So far this is exactly what I'm looking for ... for
these firsts. Finish the bunch please". Source: render-first-walk-preview.cjs. It uses the same
frame and state renderer as First Run. The First Run SVG output was checked
against its pre-change SHA-256 hash and remains byte-identical.

Single-agent council: Reference Fidelity and Theme reviewed the comparison
and found an upright, calm walking posture with a floating circular head,
continuous hollow body outline, tapered limbs, filled shoes and no motion
lines. Architecture and Export QA verified three states from one glyph and
transparent empty background samples. Small-Size review inspected 48, 64,
96, 128 and 256 px; fine details and wordmark diminish at the smallest sizes.
Integration confirms no production, watch or release changes.

Cross-examination: The reference crop is softer than the vector rendering,
so apparent line softness is not evidence of a native-device match. Native
font verification is still pending. Chair verdict: PASS for user presentation,
not production signoff. The user subsequently authorized completing the family
in this approved direction.

## Complete Firsts Family

All 15 canonical Firsts IDs now have staged vector/PNG exports in
`firsts-complete/`, using `firsts-family-preview.cjs` and one common frame/state
renderer. There are 45 canonical SVG/PNG state pairs and six additional metric
race-label pairs, not new achievements or states. Unlocked is also opaque
share; the compatibility aliases do not generate a fourth set.

`render-firsts-family.cjs` validates exact ID/title coverage, unchanged approved
SVG hashes, alias equivalence, state geometry parity, completely grayscale
locked PNGs, clear transparent backgrounds and hollow Strength/Mobility
interiors, individual title bounds, glyph-to-title spacing and race units.
Boards cover every badge and state at 48/64/96/128/256 pixels. Results are in
`firsts-complete/validation.json`.

The Strength glyph is an outline adapter of the existing canonical equipment:
`strength-preview-adapter.cjs` imports the signature, parses its SVG, reuses
all six plate centers/heights and shaft endpoints, and records the source
hash. It is derived geometry, not a byte-identical copy. Production Strength
has not changed. This distinction must be resolved deliberately during later
integration rather than quietly changing another family's art.

The StrideOS design-council skill now records the approved Firsts direction.
Remaining glyphs are completed review artwork, not a claim that the user has
approved every individual remaining icon or that the app has been updated.

### Council Completion Review

Two independent reviewers were used, followed by cross-examination and a
Chair pass. Reference Fidelity/Theme/Small-Size found three medium issues:
crowding above multiline titles, stepped Mobility joints, and a Run/Walk
connector touching the walker's shoe. All were corrected. The reviewer then
confirmed zero connector/shoe overlap and no remaining high/medium findings.
Minimum glyph/title clearance is 26 pixels at 800 (about 3.1 pixels at 96).

Architect/Contrarian/Export QA independently checked canonical coverage,
aliases, frozen approved hashes, SVG/PNG renderer parity, grayscale pixels,
race labels, and true alpha including hollow Strength plate interiors. The
validator now also fingerprints mask semantics and reads production Git diff
rather than reporting a hardcoded no-change claim. Final Mobility geometry
uses a smooth closed outline, not masks or polygon-union joins.

Chair verdict: PASS for the completed 15-badge review/export set. Native font
rendering, actual app integration, phone verification, and release remain
separate future work. No app build or submission was requested or performed.

### Mobility Revision V2

The user approved the other 14 badges: "the rest look perfect". Mobility was
explicitly rejected because the raised arm crossed the range arc and the
lower arm looked fused to the rear leg. That feedback supersedes the prior
Mobility preview PASS; Mobility still requires user approval.

Only Mobility geometry was revised. The raised arm now ends inside the arc;
the lower arm bends at the elbow and its hand ends clearly above the rear leg.
The floating head was repositioned after the reviewer identified a touch
against the raised arm. Snapshot: first-mobility-workout-v2.svg / .png.
V1 PNG is retained for comparison outside the canonical export directory.

All three Mobility states were regenerated. The other 14 badges' 96 SVG/PNG
exports, including metric race alternatives, are frozen in
`firsts-complete/approved-non-mobility-hashes.json`; the generator verifies
their hashes and skips writes for identical bytes.

Isolated range-arc/body and head/body raster checks have zero overlapping
pixels at 48, 64, 96, 128, 256 and 800 px. Full export checks still pass,
including state geometry, title clearance, locked grayscale and true alpha.
Production files and all other badge geometry remain unchanged.

Independent visual recheck: PASS for user re-presentation. The arm findings
and floating-head overlap are closed. This is not user approval of V2 or
native/app signoff.

### User Approval and Production Replacement

The user subsequently approved Mobility V2 with "Perfect" and authorized:
"overwrite the old files with these". All 15 Firsts badges are now approved.
Earlier preview-only and pending-approval notes above describe historical
review stages, not the current approval state.

The canonical production folder is:
`/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local/assets/achievements/firsts/`.
All 90 SVG/PNG files were overwritten: 15 definitions x three states x two
formats. There is no fourth opaque share state; opaque share aliases unlocked.
The app's existing FirstAchievementBadge component uses the same updated
renderer at `src/achievements/firsts/firstsArtwork.ts`. The old Documents/iCloud
checkout is not the build source and was not modified by this integration.

Approved glyphs are canonical vector data, including Mobility V2. Titles,
wordmark and race labels are outlined from the approved Arial Narrow/Arial
fonts, removing device font fallback. Typography checks cover 174 comparisons
and deterministic regeneration; rasterization can differ by one ink-boundary
pixel and up to 1.07% alpha at 800 px. No reference bitmap is embedded.
Half/full-marathon metric labels remain unit-aware without extra achievements.

Local checks: clean iOS prebuild, typecheck, 711/711 tests, asset validation and
production visual boards at 48/64/96/128/256 px. Expo dependency check reports
available patch updates for expo, expo-asset, expo-constants and
expo-notifications; dependencies were intentionally not changed here.
Other achievement families, watch/connectivity code and build number were
not edited. No full native compile, EAS build, submission, Apple processing
or device verification occurred during this production replacement.

Independent technical council implementation review: scoped PASS, no actionable
regression findings. It checked 180 renders across every ID, state, unit system
and compact/full mode; all 45 SVG/PNG pairs match fresh 1024px rasterization.
Approved glyph geometry and Strength signature provenance match their sources.
Aliases remain byte-identical, locked pixels are grayscale, and no unresolved
placeholders, broken references or runtime text remain. Cross-examination
retains native SVG antialiasing as unverified rather than claiming device parity.

Independent visual implementation review: scoped PASS. Normalized 800px
comparisons found zero non-typography pixel differences across all 45 states.
The production board and three small-size sheets preserve the approved frame,
glyphs, palette, spacing and chevrons. Chair verdict after cross-examination:
PASS for local production replacement and export fidelity, not device/release
verification. Keep the approved delicate hierarchy rather than thickening it.
