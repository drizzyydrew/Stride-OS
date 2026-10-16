# October 15, 2026 Outdoor Recording Update

## Authorization And Acceptance

Current direct request authorizes scoped implementation, commits and pushes per
project, and one final production iOS build with TestFlight submission after the
gates pass. Thirty supplied screenshots are references for capability and
interaction, not artwork/layout to copy. No swimming expansion. Keep current
earned records, settings, training history and the verified watch path safe.

For each project: research and concept -> Round 1 design/architecture council ->
implementation -> Round 2 actual-diff council -> verification -> Round 3 evidence
council. Each round must reach at least 95% bounded approval from the relevant
general/design perspectives, after cross-examination and revisions; otherwise
remain in that round. Scores are reviewer judgments, not reliability probabilities
or a substitute for physical-device evidence. Record actual outcomes, including
failed rounds, below or in a linked project review. Never manufacture consensus.

## Projects In Dependency Order

### P0. Publish Approved Badges

Preserve and commit/push existing approved artwork first. Verify actual app
renderer/asset resolution for all approved non-elevation families, canonical IDs,
locked/unlocked/transparent state parity, unit-dependent numerals and daily flame
tiers. Integrate approved families without tracing screenshots or adding duplicate
award IDs. Reuse unlocked for opaque sharing. Preserve mountains/elevation.
Check deterministic exports, focused tests, typecheck, and actual rendering paths.

### P1. Offline Identity And Exactly-Once Completion

Separate cached local identity from network refresh validation. An already-signed-in
athlete can reopen and record without cellular service; a transient transport error
must not erase identity/history or route them to sign-in. Explicit logout/invalid
credentials remain distinct; no cross-account data leak or authentication bypass
for cloud operations. Fresh sign-in still needs connectivity. Sync resumes later.
Audit all run completion paths, Health import round trips and repeated stop/save
events. Use stable recording identity and atomic idempotency; don't merge distinct
legitimate workouts merely because they are near in time. Add behavioral regressions.

### P2. Explicit Navigation And Recoverable Overlays

Disable horizontal back gestures in every stack, particularly Movement Lab.
Keep a fixed, safe-area-aware top navigation control available on scrollable pages.
Use two branded chevrons pointing left for Back: brown/steel blue in light mode,
clay/clay in dark mode. Sheet close is top-left/downward chevrons and slides away;
floating cards/tours have an explicit close and tappable outside space. Card taps
must not leak to the backdrop. Missing/unmounted tour targets must not leave a
trapping dim layer; keep an always-available escape and guard stale measurements.
Preserve unsaved-work confirmations and active-recording state.

### P3. Shared Outdoor Recording And Sensor Contracts

Bring walk/hike/ride/snow live screens into the established Running visual system,
with appropriate units, elapsed/active time, distance, pace/speed, elevation gain
and loss, heart rate and available sport metrics. Add ski touring/snowboard
touring as real activity types. GPS and biometric capture work locally; unavailable
map tiles do not imply failed recording. GPS permission button requests permission
or opens Settings with specific recovery guidance when denied.

Use existing phone/watch/live-session plumbing deliberately rather than creating
parallel owners. Phone and watch pause/end identity stays coherent; timestamps
remain 32-bit safe. Add relevant cadence acquisition and timestamped sensor
history, preserving source/freshness. Expand relevant HealthKit reads/writes only
where supported and actually used; do not ask for swim data. Use compatible native
typechecks and focused watch/Live Activity regressions before final EAS compile.

### P4. Outdoor Review, Snow Segments, Power And Share

All recorded outdoor routes have a map and common time/distance scrubber linked
to route position. A compact metric readout includes distance, time, altitude,
grade, heart rate, pace/speed, cadence/power when actually available; missing or
stale samples stay unavailable. Include appropriate splits and post-workout means.
Snow activities separate descent, climb/lift/idle candidates with conservative
thresholds and honest estimated classifications, never inventing runs from noise.
Preserve source track and allow correction where safely supported.

Research cycling/running power models and implement a versioned, labeled estimate
with documented mass/grade/speed/resistance assumptions, coverage and uncertainty.
Prefer measured power where available. Watts are rate; work is joules/kJ, not
"watts generated over a workout." Do not invent credible total human power for
downhill skiing or unsupported sports; expose defensible components or unavailable
with explanation. Store model/source for trends; no new power achievement award
unless explicitly specified beyond the user's future badge idea.

Sharing supports each actual outdoor route, but route overlays are Story-only.
Square composition is tighter with equal margins and no large empty center.
Optional power shows provenance (estimated versus measured) and correct units.
Never copy competitor branding, glyphs, animation assets or proprietary formulas.

## Release Gate

Review each scoped commit and push result. Clean prebuild before native-dependent
tests; full tests, typecheck, Expo dependency check, asset validation, native Swift
checks and production bundle. Confirm next unused build number from actual EAS
history and config, then build/submit the exact intended commit once. Check EAS
artifact and submission acknowledgment. Apple processing/device acceptance are
reported separately, not assumed. No release if a material known blocker remains.

## Evidence Ledger

Initial inspection: canonical Developer clone, branch `build-19-v3-foundation`,
HEAD `4ae752b`, config92; extensive existing Firsts and badge-review work preserved.
Version-pinned Expo SDK56 docs read before implementation. Independent reviewers
assigned badge integration, offline/completion, and native/sensor research while
the parent handles navigation, route-review/share and integration.

Research and council records will be added as the work proceeds. A plan entry is
not a claim of implementation, test success, integration, or device verification.

### Initial Council Judgments And Revisions

- Existing badge checkpoint: independent reviewer Round 1 97, Round 2 96,
  Round 3 97. Parent 10/10 Firsts tests, 90-asset validator, clean prebuild and
  typecheck passed; reviewer additionally checked 180 renders and frozen hashes.
  `c8e90c6` committed and pushed. Source/scripts whitespace check passed; generated
  reference SVGs contain harmless pre-existing trailing blank whitespace, retained
  to preserve frozen hashes (full staged check passed with blank-at-eol disabled).
- P0 remaining integration Round 1 95: pure production renderer/data, no docs/Node
  runtime imports; preserve canonical award ownership and legacy 5K Month history;
  150K/200K Challenges presentations reuse Monthly IDs. Implementer assigned after
  Chair accepted these boundaries, with pixel/geometry and state/unit QA required.
- P1 Round 1 initially **92 REVISE**: persistent owner-bound offline access and
  durable logout fence were missing, and queued work needed generation fencing.
  Revised plan preserves unknown/different-owner history in quarantine rather than
  assigning it to the next login; cached established owner can record offline.
  Stable recording/source lineage and actual start/end replace broad proximity
  merges; preserve distinct legitimate sessions. Amended Round 1 passed 95.
- P2 Round 1 judgments: general 95 with amendments; design 93 and platform 92
  before amendments. Adopted: exactly one root-owned fixed native banner with
  active leaf Back/draft/confirmation handler registered by focus and path; no
  duplicate leaf headers/insets; preserve right actions. All stack gestures off.
  Every dismissal invokes the same guarded cancellation callback, never approval;
  outside taps cannot escape through card content. Tours use generation/timeout/
  unmount/route invalidation, viewport clamping and always-available escape.
  Amended general/design plans passed 95; implementation review follows below.
- P3 Round 1 initially **90 REVISE**: require both phone/watch sport mappings,
  observation timestamps, discriminated SPM/RPM, power kind/model provenance,
  and actual native Live Activity field support. Agreed one additive
  `rawHeartRateSamples` field plus typed cadence/power series; preserve existing
  scalar contracts and run path. Amended general/native plan passed 95 with
  these contracts; detailed design was rechecked against the shared live UI.
- P4 technical Round 1 **95 conditional**: no interpolation across pauses/GPS gaps,
  no historical reconstruction of absent HR, no fake indoor/unsupported power,
  no premature power awards. Model/source labeling required in review and share.

### Implementation Review History

- P0 Round 2: 94 REVISE for the reachable archival 5K font dependency despite
  600 active SVG/PNG exports and 1,500 pixel comparisons passing. Source-paint
  correction and documented archival raster variance were accepted at parent
  Round 2 95; independent Round 3 **95 PASS**, frozen 48 tests and Challenges/
  deterministic validation passed. Details in `P0_APPROVED_BADGES_2026-10-15.md`.
  Production renderer/export commit `217fb95` pushed after review.
- P0 semantic follow-up: future 5K Month awards are retired in both evaluators;
  earned history retains its original ID, threshold, date, evidence and sharing.
  Fresh active browsing excludes the locked retired goal (98 active/99 archival
  registry), while 150K/200K use the existing Monthly award IDs. Round 1 95,
  parent actual-diff Round 2 95 and independent Round 3 95; 65 tests passed.
  Commit `9f5e76b` pushed. Approved artwork unchanged.
- P1 Round 2: 88 REVISE. Fresh-install preferences were misclassified as private
  legacy history; delayed explicit sign-in could defeat logout; native Health
  extraction omitted exact lineage; watch End depended on a mounted Training
  screen. Revisions include auth-attempt generations, precise retained-data
  scanning and a screen-independent durable completion command. Native coupling
  and independent re-review then caught overlapping credential-write authorization
  (94 REVISE) and a GPS native-await race. Exchanges now serialize under their
  own attempt guard; GPS stop/start share ordering and ownership rechecks.
  Independent Round 2 **95 PASS** and independent Round 3 **95 PASS**, 67 checks
  passed (38 behavior, seven recovery, 22 watch regressions). This approval is
  bounded to offline identity and training-run completion, not P3 outdoor End.
  A later indoor regression qualification was closed after new-command indoor
  rejection, existing treadmill confirmation and durable discard tombstones
  were integrated through both global queues; 138 focused checks passed.
- P2 Round 2: 82, then 90 REVISE for readiness-step Back, unsaved workout logs,
  keyboard-backed sheet escapes and a missing import. Revised source passed 95.
  Later design verification 92 found marker-editor loss, active strength leave
  protection and duplicated top insets; these were corrected with regressions.
  Round 3 initially 93 for accessible structural Pressables grouping controls;
  wrappers are now non-accessible while actual controls remain accessible.
  Independent final re-review **95 PASS**, 25 focused tests passed; AST coverage
  confirms all 40 structural wrappers are non-accessible while 41 labelled
  controls remain exposed. Native VoiceOver/device behavior remains unverified.
  Parent found 33 remaining manual top-inset consumers; the shared page-inset
  hook now removes only the fixed-banner top inset. Independent renewed Round 3
  passed 95 with 27 tests and a consumer audit.
- P3 Round 2: 85 REVISE for lost native identity metadata, optional permissions
  gating startup, cadence callbacks tied to provisional IDs and stale native
  telemetry. Those four corrections passed fresh source readback. A later 92
  REVISE caught memory-only End arrivals during an existing recovery sweep and
  connectivity-only Health write suppression; durable enqueue/drain and exact
  Watch recording evidence now address them. UI precheck 90 found Run/Walk state
  leaking into other sports, unwired coaching toggles and accessibility gaps;
  all three were fixed with six tests over 18 launch combinations.
  Parent then found non-training outdoor End still used a mounted-screen save
  path and cleaned up before persistence. That replacement remains in Round 2;
  no formal Round 3 or overall release approval is claimed for P3 yet.
  Replacement global End and Live Activity Stop paths subsequently passed
  independent general Round 2 95 (115 focused plus 47 behavioral checks).
  Map-first presentation passed independent design Round 2 95 after correcting
  Recenter to current-device follow in the actual Mapbox adapter (18 checks).
  Original intent time, durable acceptance before acknowledgement, indoor
  confirmation and resolved discard replay are preserved. Formal Round 3 remains
  pending final frozen source and verification.
  Independent Round 3 then **REVISE, score withheld**: delayed Training Run End
  used post-End accumulated distance/pause totals despite retaining original
  End time. Three actual-store reproductions cover later GPS, later completed
  pause and failed-write retry. Release remains held until an immutable,
  time-bounded Training snapshot passes those probes and fresh verification.
  The unchanged three probes then passed after End-bound capture, durable deep
  copies and live-state freezing. Follow-up R3 remained REVISE for direct phone
  save handlers omitting raw telemetry. Those entries now carry bounded HR,
  cadence and power; confirmed treadmill completion retains captured sensors
  without changing distance authority. Projection retains route altitude,
  wall/active time and Watch distance provenance. B's final frozen 96-case
  selection includes valid altitude-pair gain/loss, pause/gap boundaries and
  missing altitude remaining unavailable. Final independent judgment follows.
  **Final independent P3 Round 3 PASS, 95/100:** unchanged reviewer cases,
  real-store failed-write -> retry -> durable history/Activity probe, 96 focused
  tests and full 907/907 suite passed. Foreign-session global HR is excluded
  from Run ingestion. Indoor distance authority is intact. This is bounded
  TestFlight-candidate clearance, not physical-device certification.
- P4 Round 2: 86 REVISE for source labeling, stream precedence, pause expiry,
  horizontal/path speed, grade domain, unbounded flat transitions and provenance.
  All seven were fixed and regression-tested; parent actual-diff re-review 95.
  Round 3 initially 93 for peak-altitude validation and isolated GPS spikes;
  revised framing/scrubbing/peak share vetted observations without altering raw
  data. Independent Round 3 **95 PASS**, 52 focused tests passed. Browser fixture
  evidence is recorded in `update-2026-10-15/VISUAL_QA.md`. Approval covers source,
  regression behavior and candidate UI, not real-world watt accuracy or devices.
  A unit-retention follow-up keys power inputs by activity/units so a retained
  pounds value cannot be interpreted as kilograms after settings change.
  Independent recheck observed 180 lb -> 82 kg input reset while preserving
  the stored estimate; 28 focused analysis tests passed.

### Shared Verification To Date

- Clean iOS prebuild for candidate build 93 succeeded; package versions unchanged.
- iOS production JavaScript/Hermes export succeeded (10MB bytecode bundle).
- Shared application typecheck passed; rerun required after final native/council
  revisions. Source/scripts/native whitespace checks passed.
- Final frozen suite: **907/907 passed, zero failures/skips**, exit 0 in
  `/tmp/strideos-oct15-tests-approved.log`. One prior failure was an obsolete
  reference-equality expectation; the test now verifies value equality and
  separate array/sample ownership for immutable snapshots.
- Final typecheck exit 0: `/tmp/strideos-oct15-typecheck-gated.log`.
- Final Hermes export exit 0: `/tmp/strideos-oct15-export-gated`, 10MB bytecode
  `entry-b18af6a740407a6cf6db9716b9a9fc98.hbc`. Seven-file Swift syntax parse
  exit 0 and full source whitespace check passed. No package/lockfile changes.
- Expo compatibility check recommends four newer SDK56 patch packages. Existing
  pinned dependencies are retained to avoid an unrelated release-time upgrade;
  this warning is not reported as a passing dependency check.
- EAS history confirms latest finished iOS store build92, commit4ae752b. Candidate
  config is build93. EAS build `69a14acd-52b2-4bd0-aba2-b4fba59f4d4a`
  subsequently queued from pushed source `4701c41`, with matching automatic
  submission scheduled. Final states are tracked in `UPDATE_2026_10_15_RELEASE.md`.
  October 16 readback: EAS build and submission FINISHED; Apple build93 VALID
  and IN_BETA_TESTING internally. Physical-device acceptance remains outstanding.
