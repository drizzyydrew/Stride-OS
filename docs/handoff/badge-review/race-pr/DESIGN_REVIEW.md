# Race PR design council

November 5 owner revision: replace HM/MAR with 13.1/26.2 in all normal,
compact and state variants, retaining full race names. The focused independent
review passed; this explicit owner choice supersedes the initial lettering
discussion below. TestFlight submission is explicitly on hold. See
`INDEPENDENT_COUNCIL_REVIEW.md` and `../../RACE_PR_MILEAGE_REVISION_20261105.json`.

## Decision

PASS for the six new derivative Race PR artworks, three canonical states, local
exports, and full/compact presentation. This does not establish individual user
acceptance, actual achievement behavior, native rendering or release readiness.

## Evidence and independent roles

The artwork executor inspected the production First 5K and approved Weekly 5K
PNGs and read their vector sources, typography and generation pipeline. The
independent reference/contrarian reviewer inspected Firsts 5K/half, Weekly 5K and
Lifetime 1 Mile references before the new rendering, challenged the short HM/M
face labels, and required unambiguous full event titles. The new face uses HM and
MAR, with HALF MARATHON and MARATHON below; short events also have full identity.

The reviewer inspected `family-contact-sheet.png` and each of
`sizes-{unlocked,locked,transparent}.png`, covering every badge at 48, 64, 96, 128,
256 pixels and a compact 64-pixel presentation. The first normal renders passed
palette, frame/footer fidelity and collision checks, but compact REVISE was issued
because omitting the lower labels left an undersized upper-half stopwatch.

The executor defended a single uniform transform of the same timing glyph and
face label rather than a separate compact drawing. Centering accounts for the
crown-inclusive visible bounds. The reviewer accepted the approach, inspected
all three regenerated boards, and issued final scoped PASS. The full-size badge
art remains unchanged visually; each state uses the same compact transform.

## Final findings

- Reference/theme: exact Firsts-derived thin softened hexagon, warm gold/dormant
  palette, light outlined lettering, canonical STRIDEOS wordmark and two chevrons.
  New stopwatch glyph clearly distinguishes a PR from the existing first-race
  shield. No trophy, medal, star, runner silhouette, third-party identity or
  distance-based prestige colors were introduced.
- System: one canonical renderer drives native `RacePrBadge`, generated SVG/PNG
  assets, and review sheets. Six new `race_pr_*` IDs stay separate from legacy
  fastest-segment achievements. Locked/unlocked/transparent geometry is fixed.
- Export QA: 18 canonical SVGs and 18 1024-pixel PNGs; true alpha, achromatic
  locked state, exact share aliases and fresh canonical raster parity pass.
  The independent reviewer separately rerendered all 18 SVGs and confirmed PNG
  byte parity, geometry, alpha, grayscale and unchanged Firsts masters.
- Small size/accessibility: normal 96+ identity and NEW PR are clear. At 48 pixels
  footer/full-title microtext is not an accessible label. Compact mode preserves
  recognizable timing/event identity, while full event/state accessibility labels
  and outer UI copy carry details without relying on color or tiny lettering.

Automated details and hashes are in `validation.json`; provenance and reproduction
are in `ARTWORK_PROVENANCE.md`. Existing approved family sources are unchanged,
with five reference/master hashes checked byte-for-byte against the base HEAD.
