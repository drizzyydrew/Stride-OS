# Auto-pause control correction

November 4, 2026. Source correction following the owner's build-111 report.
Installed 111 is unchanged; this is prepared for a later native test build.

## Verified causes and scope

Exact build-111 source confirms the Running Active voice-panel Auto-Pause switch
controlled speech only. The global mode was separate. Settings hydration also
rewrote an explicit saved Off choice to Both, while existing recording stores
kept the detector mode captured at start rather than applying a changed mode.
The owner's Activity comparison was Walking/Hiking, types intentionally outside
running/cycling auto-pause. No screenshot map or private coordinates are retained.

## Source correction

- Running's idle/active/paused outdoor screens expose an actual **Auto-pause
  runs** control, separate from clearly labeled spoken announcements. The switch
  preserves cycling preference and explains that it applies to future GPS runs
  in both Running and Activity. It waits for saved settings to load and reports
  write failure rather than promising a durable choice.
- Valid persisted Off stays Off. Missing/invalid legacy values retain the
  current default; the new-user default is not changed by this correction.
- Both GPS recorders reconcile current preferences after either hydration order,
  on hot settings changes and before samples. Detectors do not act on temporary
  defaults before settings load. Supported run/walk and road/mountain cycling
  variants remain eligible; indoor, walking and hiking are not newly enabled.
- A changed activity policy clears stale candidate windows. Changing only the
  other sport's setting preserves the current detector's evidence window.
  An already-paused recording stays paused until an explicit Resume, including
  across Off/On; it does not silently restart or replay an old Watch command.
  Completion-pending and inactive sessions are not rewritten.
- The held-pause Resume path exposed an existing GPS distance/elevation bridge
  across paused movement. Actual queued fixes from that pause are now rejected;
  the first valid post-pause coordinate becomes an anchor with no distance or
  elevation increment. Subsequent real movement is counted normally. Original
  session identity, pause intervals and active-time accounting remain intact.
  Saved completion snapshots already exclude pause-overlapping segments.

The pause-gap tests ran the production stores against both base `7003d82` and
the correction in memory: the old code added paused-gap movement/elevation,
while corrected live totals remain unchanged at the first resumed anchor.
No checkout, customer data or native tracking task was modified by that probe.

## Verification boundaries

`AUTO_PAUSE_VALIDATION_20261104.json` records the final checks: **1,718 / 1,718
tests pass**, semantic TypeScript passes and Expo dependencies are compatible.
The 45 new targeted cases comprise 36 core/store cases and nine settings/control
cases. New targeted
tests exercise the actual stores/settings middleware/native-control callbacks,
not a duplicate model of the implementation. They cover saved Off, both
hydration orders, hot changes, supported subtypes, manual/automatic pauses,
pending End, repeated pauses, stale/inaccurate batches and resumed anchors.

The council's platform and contrarian seats exchanged objections and reviewed
the actual diff. The overly narrow subtype gate was corrected before acceptance;
the already-correct auto-resume decision timestamp was not changed. Their
historical 95/100 source-review threshold is conditional on final semantic and
regression checks, not a measured probability of device or Watch reliability.
The `watch-working-build90` reference was retained and inspected. Native Watch,
Watch bridge, GPS task/options, detector thresholds and completion journals are
unchanged by this patch.

No new EAS build, TestFlight delivery, public release, signup, billing, general
deletion or service/credential change was performed. Device acceptance must
verify actual Off across relaunch, mid-run Off, held-pause manual Resume,
distance/time continuity and phone/Watch state on the future candidate.

One pre-existing limitation remains outside this patch: Running's rolling
30-second pace window does not filter every paused coordinate edge. Check live
pace after pause/resume separately; the distance/elevation correction and saved
pause-aware completion totals do not establish full live-pace parity.

The owner separately reports the original offline-save block passed on 111;
do not ask them to repeat it just because this source correction is pending.
