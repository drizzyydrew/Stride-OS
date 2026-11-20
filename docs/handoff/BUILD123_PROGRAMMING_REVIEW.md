# Build 123 programming and goal review — November 20, 2026

This is a scoped source and contract review, not clinical validation or a claim that every exercise was experimentally compared. Root owns the final release and physical-device acceptance. No image assets, prices, AI allowance, remote billing policy, native Watch code, or dependencies were changed by this programming lane.

## Goal priorities and a single program

Onboarding and next-goal setup now support one primary goal and up to two different supporting goals. Race preparation must be primary so its event and date can anchor the plan; supporting choices are Running, Get faster, Strength and Hybrid. Validation rejects a fourth goal, duplicates, the primary repeated as a supporting goal, and an unanchored secondary race. Persisted malformed arrays are sanitized. A durable next-goal choice retains the supporting preferences through readback/recovery; exact retry dedup includes nonempty supporting preferences. Onboarding draft/summary, current Settings summary, and future week generation use the same priorities. Current active sessions still prevent goal transitions.

The primary goal sets race timing or the main training priority. Extra choices do not create independent plans, add training days or stack multiple quality runs. Existing run/lift availability, session time, actual history and recovery constraints remain. Strength support uses suitable whole-body sessions and adequate rest in existing strength slots; combined running/strength caps demanding lower-body selection. Strength-first with explicit speed support can progress from easy/base practice to controlled faster work in one existing run slot, with no VO2/peak macro phase selected for that combination. The existing hybrid calendar pass also moves or reduces unstarted lower-body work around that limited faster session; strength remains the main focus and this possible dose tradeoff is explained. Explicit easy-only preference still wins and is explained. Running as an overlapping supporting goal is described as already served by repeatable easy work rather than a fabricated new prescription.

Race-primary combinations retain event-specific phase and taper dates. Legacy programming version 1 ignores the new emphases and retains its previous generation. The six-week exercise-practice clock remains separate from recovery loading. Actual comparable sets, independent lifting experience, weekly running history, symptom/readiness gates and exercise-specific calibration still govern changes; selecting more goals does not prove more capacity.

## Simplified optional workout feedback

The visible Faster-work report, numeric repeat/time fields and work-type selector are gone. Its replacement is a collapsed **Workout feedback** disclosure only where original interval targets or older explicit feedback exist. The athlete can say all faster intervals were completed as planned, changed/shortened, or unsure. Effort and recovery appear only for the all-as-planned choice. Older detailed reports remain valid historical self-reports; no historical report or metric was rewritten.

New Training Run recordings capture exact uniform generated Work-segment targets at start into a separate `captured_prescription` object. That is planned data, not completed work. The End snapshot/journal and both GPS/treadmill save paths carry that original optional object. Old active recordings without it do not acquire a reconstructed current-week prescription. A title, duration, complete checkbox, generic imported run, or regenerated plan never establishes completed intervals. Only an explicit confirmation with actual duration sufficient for the targets and chosen effort/recovery can create athlete-reported interval evidence. Changed/unsure clears that exposure and blocks older favorable evidence from being treated as the latest tolerated practice. Same-instance duplicate selection preserves the newest explicit response; negative feedback wins an equal-time tie. Unknown inputs remain conservative.

The editor is keyed to owner generation and recording ID; switching away from the default athlete unmounts and retires the draft. Save captures the expected record reference and normalized prescription/duration signature before entering its queue. Queued or mid-save same-ID replacement, retired editor/profile, or owner change cannot publish old feedback onto the new record. The API rechecks before writes, after writes/readback and before publishing, and a rejected in-flight same-owner write restores the latest history rather than overwriting newer metrics with the draft. Failed storage remains a failure, not successful acceptance. Exact native run start/end identity and recording controls were not changed.

## Inventory and checks

The reviewed bank inventory is:

| Surface | Inventory | Check scope |
| --- | ---: | --- |
| Generated strength | 5 templates, 42 exercise definitions | Template references, adjustable setup/dose language, existing equipment/calibration/progression gates |
| Strength presets | 50 workouts, 182 exercise rows, 67 unique exercise names | Positive sets, parsed prescription, bounded target effort, rest, role/purpose; standalone preset remains a session rather than a complete periodized plan |
| Mobility | 50 routines, 162 exercise references, 24 exercise definitions | Reference integrity, dose/setup/safety fields, comfortable-range regression |
| Goal/phase/experience matrix | 5 goals × all 12 phases × 3 lifting levels = 180 scenarios | Healthy plus poor-recovery generation (360 engine calls), existing two-slot availability, 30-minute session cap, bounded effort and no added reactive work under poor recovery |

Concrete content corrections: knee-to-wall heel-rise regression now moves closer to the wall or reduces knee travel; expected sensation no longer encourages anterior ankle pinching. Goblet squat no longer mandates below-parallel depth. Bulgarian split squat and reverse lunge no longer demand a universally vertical shin or a single torso angle. Running-economy purpose no longer guarantees speed or a particular firing-rate adaptation. General regression advice uses manageable load/range/reps rather than prescribing an invariant ten-percent reduction.

Existing prescriptions that already met the framework were retained: conservative beginner/preset doses, lower-demand activation/recovery sessions, optional graded reactive work, same-purpose substitutions, exercise-specific load calibration, protection of completed sets/captured prescriptions, and time/recovery regression. Catalog additions, exact muscle metadata, exercise guides and direct/support weekly-volume accounting are reviewed and implemented by the separate catalog lane; this document does not claim its checks as programming-lane evidence.

## Evidence boundaries and sources

The ACSM 2026 position stand supports progressive resistance training and goal-specific loading while emphasizing that many reasonable methods work. Its strength/hypertrophy optimization findings are not imposed as universal starting doses or a ten-set minimum for every runner. Six-week exercise reviews, exact effort ceilings, one quality slot and progression thresholds remain transparent coaching policies, not validated medical clearance thresholds. The NSCA manual supports progression, appropriate exercise selection and recovery; return-to-exertional-illness protocols were not transplanted into a general adult program.

- [ACSM 2026 position stand](https://doi.org/10.1249/MSS.0000000000003897)
- [ACSM official overview](https://acsm.org/resistance-training-guidelines-update-2026/)
- [NSCA Basics of Strength and Conditioning manual](https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf)

Focused suite logs (overlapping counts; root records the final full regression):

- `/Users/drew/.cache/strideos-multigoal-final-tests.log`
- `/Users/drew/.cache/strideos-multigoal-compat-tests.log`
- `/Users/drew/.cache/strideos-multigoal-balance-tests.log` (13/13 final spacing and goal-matrix checks)
- `/Users/drew/.cache/strideos-compact-feedback-fences-tests.log`
- `/Users/drew/.cache/strideos-multigoal-typecheck.log`

Physical acceptance remains separate: max-three goal setup and summaries, genuine tracked interval feedback, changed/unsure behavior, native picker legibility and retained session paths should be checked on the delivered binary. No hard workout or repeat subscription purchase is required merely to verify these controls.
