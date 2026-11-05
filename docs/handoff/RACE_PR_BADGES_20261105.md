# Six race PR badges — November 5, 2026

Owner request: create a new-PR badge for 5K, 10K, half marathon, marathon,
1 mile and 800 meters; inspect the previous badges and consult the design council.

## Canonical family and review

The six new IDs are `race_pr_800m`, `race_pr_1_mile`, `race_pr_5k`,
`race_pr_10k`, `race_pr_half_marathon`, and `race_pr_marathon`.
They do not repurpose the legacy `pr_fastest_*` continuous-segment definitions.

The new family reuses the existing approved Firsts single softened hexagon,
warm-gold palette, outlined light Arial Narrow treatment, STRIDEOS wordmark and
two bottom chevrons. A new restrained stopwatch, event identity and NEW PR copy
distinguish a personal best from a first completion. HM/MAR timing-face labels
are accompanied by the full Half Marathon/Marathon title. Distances are event
identities, not a color or prestige ladder. Personal finish times stay outside
the artwork.

Independent design review issued PASS after requesting and verifying a larger,
centered compact stopwatch. This is new artwork derived from existing approved
style; it is not a claim of previous owner approval or device rendering proof.

`src/achievements/racePr/` owns the canonical definition/renderer/component.
Exactly three states share geometry: unlocked, locked and transparent. Share
opaque aliases unlocked; share transparent aliases transparent. The app badge,
hub, detail, popup and Share Studio all resolve the same renderer. No runtime
font engine, font file, external image or duplicate share drawing is required.

There are 18 SVGs and 18 PNGs at `assets/achievements/race-pr/`. PNGs are
1024 square; the SVG viewBox is 100 square. Generation and validation commands:

```sh
npm run generate:race-pr-assets
npm run validate:race-pr-assets
```

Both commands are included in the existing achievement-generation/validation
scripts. Existing approved family artwork and assets remain unchanged.

## Earning and repeated celebrations

- Only an exact standard event distance with an explicit valid elapsed result
  qualifies. Inputs are manual profile PRs, explicit archived results and marked
  Activity race/time-trial results from the existing owner-scoped calibration
  pipeline. GPS totals, target distance, fragmented segments and active time do
  not establish a race result. An 800m or mile result under five minutes is valid.
- The first confirmed result establishes that event's personal best. A strictly
  faster new performance can celebrate again using the same badge ID. Ties and
  slower results do not celebrate.
- Existing restored history unlocks badges quietly. Optional recorded-at
  provenance separates old history from new explicit input, including a first
  result entered while initial archive loading is still pending.
- Source identities and normalized performance fingerprints prevent replay after
  rerender, restart, duplicate import, deletion/re-add, or correction. Editing an
  already observed source updates the current best without another popup.
- Corrections and withdrawals recalculate the valid current best. There is no
  irreversible fastest-ever notification floor that could punish a corrected
  typo. Previous badge ownership remains historical; a missing current result is
  described honestly instead of inventing a finish time.

The ledger is owner/default-athlete scoped at
`race-pr-awards:{owner}:athlete_default`. Its write/readback precedes persisted
badge ownership and transient notification publication. The new key participates
in the existing account storage fence and owner-specific cleanup manifest.
Owner/snapshot changes prevent late publication. Stale, withdrawn or foreign
notifications are suppressed. If persistent storage fails, retries can recover
the permanent badge quietly; a transient animation can be lost rather than
replayed on restart. No raw training history is rewritten by this feature.

The collection includes Personal Records as a selectable family. Detail/current
best values and popup finish time/improvement text remain outside the artwork.
Sharing uses the existing user-triggered Share Studio; no message or image is
automatically published.

## Evidence and remaining acceptance

Artwork checks passed: 18 state-geometry checks, 18 fresh PNG comparisons,
180 full/compact size renders, outlined typography, dormant grayscale, true
interior/exterior alpha, exact share aliases and frozen existing-source hashes.
An independent reviewer rendered all 18 PNGs again and inspected all six badges
in three states at 48, 64, 96, 128 and 256 pixels.

See `RACE_PR_BADGES_VALIDATION_20261105.json` for the integrated test/typecheck
receipt. The Expo online compatibility recommendation for newer SDK-57 patches
remains a separate next-candidate item; no dependencies were upgraded here.

This implementation is local source/artwork. Installed build 111 does not contain
it. No new EAS build, TestFlight delivery, App Store submission, public release,
production backend write, real account deletion or physical-device action was
performed. Next candidate checks are actual native artwork/alpha, collection and
detail, first and later PR popups, restart/duplicate suppression and Share Studio.

Review references:

- [Family and states](badge-review/race-pr/family-contact-sheet.png)
- [Art provenance](badge-review/race-pr/ARTWORK_PROVENANCE.md)
- [Design review](badge-review/race-pr/DESIGN_REVIEW.md)
- [Independent council](badge-review/race-pr/INDEPENDENT_COUNCIL_REVIEW.md)
- [Artwork validation](badge-review/race-pr/validation.json)
