# Goal-directed programming — Build 121

## Authorization

The latest request explicitly authorizes commit, push and TestFlight after implementing the expanded programming scope. It supersedes the earlier 121 hold. Images and sharing stay excluded; public App Review and release are separate.

## Implemented behavior

- New goal choices use version 2; existing saved goals retain version 1. Started workouts keep their captured prescriptions and completed history is retained. Saved beginner paths own their actual dated sessions, focus and recovery weeks, without unprescribed threshold/VO2 phases or extra blocks after the stored path ends.
- Macro phases differ by goal. Shorter races include sequenced aerobic development, threshold, aerobic power and race specificity; longer races emphasize sustained/event-specific work. Extended runways add base preparation. The event date remains fixed and the final two taper weeks remain intact.
- Six-week exercise practice blocks and the existing three-loading/one-recovery schedule are separate clocks. Main lifts stay recognizable. One compatible practiced accessory can vary in an eligible second practice block, with its own recent practice retaining the variation as original records age. A review date alone earns no additional load.
- Strength dose uses independent lifting experience, time, equipment, movement roles and target effort. One main exercise can gain a set after two comparable actual exposures at the prescribed top reps, manageable reported effort and suitable recovery, within the time budget. Partial work, missing effort/units, changed setups or stale history do not earn a load increase. A preferred variation can progress from its own history; it never inherits the original lift's evidence.
- Running quality builds from reported tolerance: relaxed strides, short controlled bouts, sustained work, then bounded aerobic-power intervals when appropriate. Four-by-two-minute work progresses through intermediate durations before four-by-four. Calendar weeks and planned labels are not performance proof. Calibrated event pace may guide race-specific work; unknown calibration uses effort instead of a precise guessed pace.
- Eligible Norwegian 4×4 totals 40 minutes: 10 warmup, four 4-minute work bouts, three 3-minute easy recoveries, five cooldown. It is an aerobic-power option, not a beginner default or a threshold label. Consistency, actual volume, repeated reported interval tolerance, phase/readiness, time and space from demanding nearby work all gate it. Failed gates produce an easier actual prescription, never a 4×4 title over an incomplete protocol.
- Running time uses actual completed full weeks, with an explicitly assumed or reported starting baseline when data is absent. Introducing/extending quality holds total volume. A modest increase needs repeated manageable actual training; interruptions and poor recovery reduce the budget. Numeric easy/run-walk segments fit the budget and long-run allocation. At most six running days leave room for a full generated rest day.
- Hybrid placement checks actual calendar dates. Supporting lifts move within selected days when space exists; manageable ordinary quality/lift pairings can concentrate demand when neighboring days permit. Otherwise unstarted lower-body support is reduced and explosive work held. A structured reduced-support flag is honored only for valid one-set/RPE-1–5 lower prescriptions without plyometrics. Started/completed work is retained; missed work is not treated as performed or moved forward as catch-up. Actual prior-week work also informs interval spacing.
- Goal/week-scoped slot identities survive within-week type/dose changes and distinguish later weeks and separate goals. Exact running/strength completion links are applied before scheduling policies; date-only matching is not used.

## Controls, presets and data

Generated, preset and custom strength sessions have collapsed **Adjust exercise** controls. Easy/hard actions change only remaining targets. Replacement choices preserve the movement family, primary muscles and intended stimulus; shared muscles alone are insufficient. Required setup is explicit. Partial substitutions keep performed original sets and add only remaining replacement work with separate load calibration. Original prescription/provenance and modified completion are retained.

Known unambiguous engine variants can be opted into **Use in future generated workouts**, with a reset to the plan default. Owner-scoped preferences are published after local persistence/readback; concurrent keys merge. Other choices are explicitly for this workout only. Unmatched custom movements and unique assessments get honest manual/dose guidance rather than invented equivalents.

Mobility has the corresponding quiet adjustment control. Its existing timed flow retains completed time and records original-versus-adjusted work in completion notes. This is not a new per-set mobility schema or durable active-mobility recovery system.

Standalone presets now carry actual purpose, target RPE, rest and bounded dose. Beginner kettlebell work starts with controlled hinging; beginner/runner-support volume is manageable. Power work uses crisp low-rep sets and longer rest. Equipment labels disclose anchors, bars, steps and supports. Stable preset IDs and historical aliases remain. A standalone preset is a workout, not an automatically periodized multiweek plan.

Saved app runs with actual duration have a collapsed **Faster-work report** in Activity and legacy run detail. Athletes explicitly report work type, completed repeats, seconds per repeat, work RPE and recovery between repeats. Save/remove is owner-scoped and locally confirmed before publishing evidence. Reports are never backfilled from planned segments, total time, GPS or completion flags. Recorded distance/pace are unchanged. Health-only entries without an exact underlying app run do not get a guessed report writer.

## Evidence boundaries

The [Helgerud trial](https://pubmed.ncbi.nlm.nih.gov/17414804/) studied aerobic interval work in healthy moderately trained men. It does not validate automatic assignment to every app user. The [concurrent-training review](https://pubmed.ncbi.nlm.nih.gov/34757594/) informs priority/spacing, not one universally best split. The [ACSM 2026 position stand](https://doi.org/10.1249/MSS.0000000000003897) supports individualized resistance-training prescription.

Exact six-week reviews, three-plus-one recovery timing, a 5% volume ceiling, a 42-day strength-reference window and eligibility cutoffs are bounded coaching/product choices, not universal validated thresholds. Effort/recovery reports are self-reports. No injury/cramp guarantee, diagnosis, generic estimated-1RM engine, automatic maximum testing or mandatory failure training was added.

Final automated totals, signed artifact and Apple availability are recorded separately. Local tests and council source approval do not establish native device appearance or real-world training outcomes.
