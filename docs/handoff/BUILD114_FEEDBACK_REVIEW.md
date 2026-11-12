# Build 114 owner feedback — November 11, 2026

This records the owner's latest physical-device observations and the resulting
source changes after shipped commit `0b24c1c`. These changes have not been built
or delivered to TestFlight. No build number, store version, signup, purchase,
privacy permission or public release setting was changed.

## Archive explanation: wording and result behavior held for owner review

The initial owner request held wording/result changes until explanation. The
later approved Race result labels and before/after run linking supersede that
hold for the race-result section; see RACE_ACTIVITY_LINKING_20261111.md. Coverage
wording and possible averages remain proposals. Frozen training totals are unchanged.

- **“— means unavailable”** explains the dash symbol. It does not say that
  statistical means/averages cannot be calculated. This screen currently shows
  sums, not averages.
- **Distance recorded for 47 / duration for 62:** the archive has different
  coverage for those measurements. Each sum includes only records with that
  measurement. An average could be calculated over the records containing it;
  missing values should not silently become zero or enter its denominator.
- **Result / Saved result:** the goal race's outcome and optional elapsed finish
  time. This is separate from the training accumulated during the block.
- **Result not recorded:** no race outcome has been saved. It does not imply
  that workouts are missing or that the athlete failed to finish the race.
- **DNF:** did not finish. **DNS:** did not start. The status selector records
  one of these race outcomes, Finished, or Result not recorded. It is not a
  training completion/adherence score.
- **Frozen training totals:** the block's saved summary as of its archive date.
  Editing the race outcome does not rewrite that training snapshot.
- **Weekly recorded totals:** activity counts and known distance/duration by
  week within the saved block.
- **Archived plan outline:** the saved weeks, phases/focus or beginner sessions
  that describe the plan. It is a reference, not reconstructed proof of what
  was prescribed on every historical day.
- **Activities in this snapshot:** links to the activities included at archive
  creation. A link opens the current activity, which may since have been edited
  or deleted; the frozen aggregate remains historical.

Possible later copy changes (not implemented): explain the dash inline as “— =
not recorded,” label the race section “Race outcome,” spell out outcomes, and
add a known-value average only if the owner wants that statistic.

## Owner-reported observations of installed 114

Passes reported: installation, older history present, archive now opens, tour
highlighting/navigation, profile identity visibility controls, PR form/race
results/badge inspection, auto-pause, lock-screen pause/resume, recovery prompt,
completed activity remaining after reopening/reconnection with no duplicate,
and forgot-password email carryover. These are owner reports, not new automated
or independently observed device results. Exact offline save ordering and a
fresh exactly-one Health export were not independently established here.

Failures reported: Running controls missing; Watch needed foreground opening
before metrics began, then disconnected about ten minutes into a run; phone
app crashed. Resume Activity continued the same recording after relaunch.
Recovery is a pass; the crash remains a failure. The owner subsequently supplied
“About 8:30 or so” and confirmed that the crash was logged/reported. Use November
11 around 08:30 Pacific (16:30 UTC) as an approximate reference; the reply does
not distinguish the run's start time from the crash time or specify the report
channel.

## Source changes completed

- Today: Weather → Current Streak → existing remaining sections. The archive
  card now has the same 16-point outer spacing used by neighboring cards.
- Running: idle subtab buttons have intrinsic height and a 44-point minimum,
  rather than zero-basis column flex. Active recording/session data is retained.
  Tab-bar hiding is focus-scoped, so leaving a retained running screen restores
  the bottom bar without stopping its recording.
  The original browser fixture still showed the old, shorter tab row: it did not
  reproduce the owner's entire missing-subtab symptom. That symptom is not yet
  accepted as resolved. A valid active/paused recording intentionally retains
  the existing full-screen branch; no recording flags were cleared to expose tabs.
  Subsequent owner photo10 shows Plan cards BELOW a thin empty subtab strip.
  Thus active-run full-screen mode does not explain that screenshot; it supports
  the collapsed idle-control diagnosis. Native validation of the fix is pending.
- Bottom navigation: all five labels keep one font size; individual labels no
  longer shrink to different sizes. Equal-width cells provide the available
  label width.
- Home: section landing pages show a house. It navigates to Today and queues a
  scroll-to-top until Today focuses, including a cold mount. Detail screens
  retain Back and their existing registered handlers.
- Archive disclosures: the native RNHostView measures height within constrained
  parent width, rather than letting intrinsic content dictate both dimensions.
  Text/actions reflow; labels and body contents are not hidden to conceal overflow.
- Profile: tap the name/username area to open a dedicated identity editor; the
  photo remains a separate action. Optional first name, last name, username and
  visibility choices are the first profile-data step of new onboarding. Existing
  completed users are not sent through setup again. Saves preserve owner and
  active-athlete identity; secondary athletes cannot overwrite default identity.
- Calibration: expandable information controls explain the purpose, procedure
  and limits of each method/test, including MAF and the threshold protocol.
- Automatic PRs: completed tracked runs can establish the six supported best
  efforts from actual timestamped, quality-qualified GPS distance windows. No
  longer-distance prediction or average-pace extrapolation becomes a PR. Pauses,
  bad fixes and gaps split the trace. A no-route whole-run result requires exact
  supported distance and recorded wall-clock provenance. Older missing-quality
  traces and duration-derived legacy end times are withheld, not reconstructed.
  Explicit race results take precedence for their event class.
- PR corrections/deletions reconcile from retained sources. Historical restore
  seeds silently; a genuinely faster new recording can celebrate each distance
  again. Source edits/reimports do not replay celebrations. Recorded training
  efforts are labeled separately and excluded from fitness calibration; an easy
  run is not assumed to be a maximal race. Existing confirmed race/time-trial
  calibration remains automatic. HRmax is not inferred from a race time.
- GPS accuracy is retained as optional observed metadata through recording,
  completion and Activity normalization; no quality value is invented for older
  routes. GPS filters, distance calculation and session controls are unchanged.
- Lock-screen branding uses the unchanged canonical three-chevron app icon in
  outdoor and strength activity headers. Pause/resume/stop controls are unchanged.
- Telemetry: the duplicate live display cache retains the current ten-second
  freshness window. Complete original recording samples remain persisted. A
  clock rollback clears displayed observations until a fresh valid sample arrives.
  This reduces repeated display work; it is not a proven crash correction.

## Watch/crash investigation — unresolved release blocker

The completed photo submission adds an08:44 lock-screen Run with missing HR and
an08:49 TestFlight crash prompt (Pacific). These are observation times, not proof
of exact termination time or root cause. See PHOTO_REVIEW_AND_SIGNIN_BRANDING_20261111.md.

The Apple crash-feedback read returned no build-114 submissions in its response.
That does not disprove the owner's crash or establish its cause. No native crash
capture/diagnostic sharing was enabled, and no route/health/customer records were
copied into this repository.
The usual local Xcode/MobileDevice/DiagnosticReports folders also contained no
matching StrideOS `.ips` or `.crash` file in the targeted filename search.

Recheck after the owner's time/report confirmation, November 12 at 01:47 UTC
(November 11, 17:47 Pacific): the crash-feedback collection was fully paginated
(one page, two older-build records), with zero records linked to build 114.
The separate build-114 diagnostic-signatures request returned HTTP 404
`NOT_FOUND`; that is an unavailable diagnostic read, not proof of zero crashes.
No matching crash log could be retrieved or attributed to the 08:30 reference.
Private response metadata remains outside the repository. The incident remains
open; a reported crash is not marked fixed or contradicted by these API results.

A source-extracted Swift transport harness reproduces a distinct reachable-start
race: live start passes an initial reachable check, then fails asynchronously;
the fallback queues a start which Watch deliberately rejects, without an
automatic foreground launch/retry. This is a demonstrated source defect, not
attribution of this particular run's crash or disconnect.

The proposed native retry requires more than a local token: an already-dispatched
live start can arrive after End or owner cancellation. The current Watch protocol
has no receive-side owner revocation/tombstone that proves rejection of that late
start. Independent platform and contrarian review therefore returned **REVISE**.
No native start/reconnect protocol change was made. Generic running-state replay
was rejected because it could resume a newer deliberate phone pause.

The [StrideOS general council skill](/Users/drew/.codex/skills/strideos-general-council/SKILL.md)
requires the historically reported “>=95% council regression-confidence gate or
ask Drew” for Watch/startup changes. That is a subjective source-review safeguard,
not a measured reliability probability. The native retry proposal has not met it.
The bounded display-cache and accuracy-metadata changes passed their independently
reviewed 95/100 source regression gates; neither resolves the hardware incident.

Before a launch reliability claim: obtain/match the crash record, design and test
receive-side cancellation boundaries, then run a longer paired-device test of
cold Watch start, phone lock/background, connection loss/recovery, pauses and
exactly-one durable completion/Health export. No reinstall/reset is required.

## Verification and artifacts

Validation receipt is recorded in `build114-feedback-20261111/validation.json`.
Visual fixtures use extracted production components with synthetic data and
stubbed recording leaves. They are browser rendering evidence at narrow widths,
not native iOS/Watch or physical Dynamic Type acceptance. Native archive bridge
behavior still requires the next authorized candidate's device check.

The lock-screen reference board compares the original icon at small sizes; it is
not an ActivityKit device screenshot. Source and widget icon SHA-256 match exactly.
No achievement artwork or the accepted 13.1/26.2 badge faces were changed.
