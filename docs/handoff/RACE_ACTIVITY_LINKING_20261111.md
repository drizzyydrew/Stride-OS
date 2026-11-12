# Race linking before and after recording

Owner direction: keep plain Race result choices, remove the DNF/DNS acronym
explanation, and allow linking before a race for automatic logging or linking a
saved run afterward. Source changes are local; no build/submission is authorized
by this implementation request.

## Athlete flow in the pending source

Before recording:

1. Calendar → choose the named race → Record this race. Alternatively Running →
   Active → Race → choose Race event.
2. Review the event name, date and exact course distance. A different recording
   date requires explicit confirmation. Start at the race start line.
3. End race → Finish race records the result using full elapsed recording time,
   including pauses. Stop race early saves the actual effort as unfinished.

After recording:

1. More → Activity → open the saved run → Link to race (Edit race link if linked).
2. Choose the race/outcome. Use the proven recorded elapsed time or enter an
   official finish time; raw recorded metrics are not overwritten.
3. Save race result. Date mismatches and replacement of another result/run
   require explicit confirmation. The same editor is reachable from an archived
   block's Link a saved run action.

A generic Watch/lock-screen/background End saves a prelinked recording but
does not assume a race finish. Confirm its outcome from the saved run afterward.
Linking alone, a scheduled date, a goal-distance cue or GPS proximity never proves
a finish. An ordinary unlinked run retains its existing recording behavior.

Plain archive choices are No result added yet / Finished / Did not finish /
Did not start. A recorded-run link uses the first three; Did not start is an
event outcome that does not require pretending a saved run was the race.

## One result, one existing activity

- The chosen event's ID and course snapshot are persisted with the recording.
  Later plan edits do not silently rewrite that race's historical course/name.
- The saved Activity owns the linked race result/time. Archive references derive
  the current result; the frozen training totals are unchanged.
- Existing manual results require deliberate replacement. A blank unknown
  result does not block a newly confirmed linked race.
- A linked race under five minutes is retained; generic short-run discard rules
  are otherwise unchanged. Unfinished efforts cannot create a finished-race PR.
- PR/calibration use one source for a named event. Linking its archive, correcting
  time, retrying a save or reimporting it does not award a duplicate achievement.
- Unlinking preserves the run. A durable edit marker prevents an older workout
  projection from restoring a cleared or corrected link/result.
- Writes require the current owner and default athlete, loaded history, awaited
  persistence and readback. A replacement is saved before retiring the old link.
  Activity and archive writes are not a cross-store transaction: a partial failure
  is reported, and retry repairs the reference without another workout.

The named event picker uses the existing Calendar race distances: 5K,10K, half
marathon and marathon. The six standalone PR/badge distances remain unchanged.
This work does not expand the training-plan engine to new event distances.

## Compatibility and review

The deployed archive RPC accepts only race_record/user result sources. The client
encodes a linked archive reference as a race_record/unrecorded pointer without a
copied time, and normalizes it back on modern reads. Older clients can read that
unrecorded result. Strict RPC contract tests verify this shape; no SQL migration,
RLS change or live server update was made. Live-cloud acceptance is not claimed.

Independent product/training and architecture reviews challenged false finishes,
short races, event duplication, missing elapsed evidence, date mismatches, owner
changes, stale completion replay, replacement failure ordering and old-client
backup compatibility. Actual-diff review and real-store tests resolved the bounded
source issues. Platform plus independent domain/UI reviewers support a95/100
subjective regression-confidence gate for the additive recording metadata and
confirmation flow. This is not a device-reliability probability.

Existing native Watch startup/disconnect/crash investigation remains open. No
native Watch/phone connectivity protocol, GPS algorithm, Health controls, auth,
package/app configuration, paid service or release setting changed in this phase.

## Evidence and next candidate checks

- `race-link-20261111/validation.json`: final test/check receipt and source hashes.
- `race-link-20261111/UI_REVIEW.md`: extracted source browser fixture at320/400px,
  enlarged text, long event names and conditional confirmations. Not native proof.
- `scripts/tests/raceRecordingLifecycle.test.ts`: actual recording/dialog, first
  End, failed save/restart, owner changes and stale-projection behavior.
- `scripts/tests/raceActivityLink.test.ts`: actual save/unlink/readback, partial
  failures, source authority, archive compatibility and PR deduplication.

On a later authorized candidate, check both entry paths, Finish versus Stop early,
generic Watch End awaiting confirmation, offline save/reopen/retry, official-time
correction, unlink/deletion, exactly one activity/result/award, archive backup
restore, large text and narrow layouts. Source checks do not replace these tests.
