# Independent Race PR council review — November 5, 2026

Verdict: **PASS** for the six new derivative artworks, state/export construction,
and reviewed PR earning implementation, conditional on the parent integrated
regression suite. This is not individual owner acceptance of the new designs,
native device rendering verification, or release approval.

## Reference and theme review

The reviewer inspected the actual approved Firsts 5K and Half Marathon PNGs,
Weekly 5K PNG, and Lifetime Running one-mile PNG before reviewing the new work.
The Firsts race family is the closest relevant lineage: a thin softened warm-gold
hexagon, light condensed lettering, tracked STRIDEOS wordmark and two chevrons.
Weekly Distance and Lifetime Running provide secondary evidence for restrained
distance lettering; their separate palettes and diamond geometry were not imposed
on this new family.

The six new artworks retain the Firsts frame/palette/footer and use a new outlined
stopwatch plus NEW PR wording to distinguish a record from first completion.
They are a new interpretation of that approved visual language, not previously
approved PR artwork. No distance-dependent prestige colors or ring ladder was
introduced. Existing Firsts sources and assets have no changes in the scoped Git
diff.

Cross-examination resolved two design concerns:

1. `M` alone is ambiguous. The full designs use HM / MAR inside the stopwatch and
   explicit HALF MARATHON / MARATHON below it. Short distances retain 800M, 1MI,
   5K and 10K with their event names. Finish times remain outside the artwork.
2. The first compact rendering omitted lower copy but left a small clock in the
   upper half. It was revised using the same canonical clock/face group with a
   uniform 1.3 scale and circle center at `(50, 52.5)`, optically centering the
   crown-inclusive ink. Full artwork is unchanged. The shared compact transform
   is identical in all three states and clears the frame in all six designs.

The reviewer inspected the complete family contact sheet and the unlocked,
locked and transparent size boards at 48, 64, 96, 128 and 256 pixels, including
the revised compact 64 column. The clock and distance identity remain the primary
small-size signals. Tiny full titles/footer text at 48 pixels are not a substitute
for the component's full event accessibility label and surrounding UI labels.

Evidence:

- `family-contact-sheet.png`
- `sizes-unlocked.png`, `sizes-locked.png`, `sizes-transparent.png`
- `src/achievements/racePr/racePrArtwork.ts`
- `src/achievements/racePr/racePrTypography.ts`
- `src/achievements/racePr/RacePrBadge.tsx`
- `ARTWORK_PROVENANCE.md` and `validation.json`

## Independent export checks

The reviewer separately inspected all 18 canonical SVG/PNG pairs:

- SVG viewBox is `0 0 100 100`; production PNGs are 1024 square.
- All path/circle geometry agrees across unlocked, locked and transparent states.
- No SVG `<text>` or external `<image>` remains in the artwork.
- All six locked PNGs are achromatic across their nontransparent pixels.
- All six transparent PNGs have alpha zero at exterior and sampled empty interior
  positions. The SVG source removes the opaque fill/ambient treatment.
- Fresh rasterization from the canonical renderer produced **18/18 byte-identical
  PNGs** compared with the generated production exports.

The artist's validator additionally reports 180 small full/compact renders and
share alias parity. Those validator results complement the independent actual
image inspection; they are not physical-device evidence.

## Earning and data-custody review

The reviewed implementation gives each requested event one canonical badge ID,
separate from the legacy continuous-segment `pr_fastest_*` definitions. It uses
confirmed full elapsed results and exact standard event meters. A legitimate
800-meter or mile performance is not subjected to a five-minute workout minimum.

Current valid best determines progression. A proposed permanent celebrated-best
floor was rejected: withdrawing a mistyped one-second result must not block later
legitimate PR celebrations forever. Durable observed-source identities and
normalized distance/date/time fingerprints instead prevent ordinary replay,
duplicate provenance, and delete/reinsert notifications. A correction to an
already observed source updates current best without a second popup; this is an
intentional, bounded anti-replay policy, not a claim that corrections are invalid.

The initial history seed is quiet. A session-start marker distinguishes older
restored results from explicit results entered while initial sources are still
loading, so the latter can still celebrate. Ties do not produce a new PR.

Reviewed safeguards include owner/default-athlete/hydration and current-snapshot
checks; serialized source reads; a durable owner ledger with readback before
permanent ownership persistence and transient notification publication; recovery
of missing ownership after a failed write; and hiding queued notifications whose
source was withdrawn, changed or superseded. The new ledger key is classified
for the existing owner-scoped deletion fence/cleanup manifest. No customer data
was read or deleted as part of this review.

The reviewer independently ran the pure PR and actual ledger suites:
**22 tests passed, zero failed.** The implementation agent reports a broader
91-test focused integration pass; parent integrated-suite validation remains
separate.

A persistence failure may suppress the transient celebration while permanent
badge ownership is retained or recovered. Previously consumed celebrations do
not replay after restart. These failure semantics prioritize durable history and
notification idempotence over promising an animation in every failure case.
