# Goal archive and open training

October 31, 2026; canonical Developer checkout, build 104 internal TestFlight candidate.

## Athlete flow

- A valid event/goal end date is inclusive. On the first foreground reconciliation
  after that local date, StrideOS saves a fixed archive and retires the expired
  primary block. A past B/tune-up event does not retire a future primary race.
- The Today prompt offers results, a new goal, or continued open training. The
  latter is durable and optional; it does not restart onboarding or remove history.
- Next goals support a race date/distance, running, strength or hybrid focus, and
  an end date or a 1–104 week duration. Beginner paths retain their existing
  readiness/timeline checks.
- Explicitly replacing an unfinished focus also preserves its outline. Those
  archives explain that the training focus changed, and retain the originally
  planned race date separately from the observed training window.
- Settings → Training Plan → Goal archive opens archived blocks and results.

## What the snapshot means

The summary includes canonical completed/partial activities starting within its
local calendar window: counts, active days, available distance/duration/elevation/
load, weekly totals and activity references. It is an observation window, not an
adherence score or proof that a race was completed. Skips and duplicate recording
identities do not inflate totals. Missing values remain unavailable.

Only an unambiguous official race record with the exact date and distance supplies
an automatic result. Otherwise the result stays unrecorded until explicitly entered.
Finish, DNF and DNS are separate choices. Later result entries do not recompute the
frozen training totals. Activity corrections, late imports and deleted activity
links do not silently recreate records or change the fixed summary.

The macro outline and full beginner plan, when present, are copied before they
are frozen. The macro outline does not claim to reconstruct historical rich
prescriptions or old adaptation decisions. Actual activity history remains
accessible independently of the current plan's start date.

## Data custody and scheduling

- Archive commits are serialized, owner-fenced, and read back from storage before
  an expired block is retired. A crash between the two steps reconciles from the
  stable source key without creating a second archive. Explicit replacement of
  an unfinished block first saves a prepared recovery journal, then atomically
  commits the new primary plan, then publishes the old archive. A failed primary
  write leaves the old focus active without prematurely freezing its totals.
  A successful write with a failed confirmation recovers on relaunch; stale
  journal completion cannot overwrite a newer prepared transition.
- Beginner plan content and its selection pointer share the primary plan record.
  The older beginner store is a compatibility cache, not the commit boundary.
  Archive/journal-only local data also prevents fresh-account data adoption when
  the local owner marker is missing; empty archive caches remain benign.
- Reconciliation waits for source hydration and defers while a workout is active.
  It runs on the foreground training surface, foreground changes, and a 30-second
  local-day check. It does not change root startup, GPS, HealthKit or Watch code.
- Activities currently lack athlete IDs. Automatic snapshots therefore use only
  `athlete_default` under the verified account owner. Secondary profiles are
  explicitly limited; their history is never inferred or reassigned.
- Open training suppresses generated sessions, stale beginner plans, adaptation
  overlays and move-ledger injections. A new structured block tags new sessions
  and accepts only that block's subsequent moves/adaptations. Old ledgers remain
  stored. Calendar and Coach use the same active target race.
- Archives use `goal-archives:<owner>` locally and the existing RLS-protected
  `profiles.goal_archives` column in StrideOS Supabase. The invoker-only merge RPC
  preserves the cloud's immutable snapshot and merges newer explicit results.
  Failed backup retains local records and exposes its status. No service/plan was
  added. Existing profile deletion coverage includes this column.

## Verification and limits

- 82 focused snapshot, store, journal, lifecycle and scheduling tests passed before the
  final release checks, including storage/readback failure, owner/profile changes,
  duplicate foreground calls, live recording deferral, and stale/new-block moves.
- Independent engineering reviewers approved the bounded commit/TestFlight
  candidate with no remaining must-fix findings. Scoped startup ownership review
  confidence was 95/100 as a judgment, not measured device reliability.
- Live migration `owner_scoped_goal_archives` applied to StrideOS only. A rolled-
  back synthetic-owner probe passed RLS isolation, immutable summary/newer result
  merge and rejection of foreign ownership. The fixture user count afterward was
  zero. Anonymous RPC execution is denied; the function is security invoker.
- Actual repository components and the installed Expo UI web branch were used
  in a synthetic local fixture. All four screens fit at 320/393/768 pixels in
  dark/light themes (24 layout combinations). Invalid finish times and goal
  durations are rejected; failed saves preserve drafts and support retry.
- Native VoiceOver, keyboard behavior, physical-device background/Watch handoff,
  reinstall acceptance and real StoreKit lifecycle remain device-test work.
  Browser/Node checks do not establish those outcomes.

See `LAUNCH_READINESS.md` for the final source/build receipts and remaining
public-launch gates. This feature does not enable payments or public release.
The committed source is `2765920`; Apple processed build 104 as VALID and
IN_BETA_TESTING internally. Full final regression passed 1,318/1,318, semantic
TypeScript/Expo checks and iOS Hermes export passed, and the actual signed
phone/Watch/Live Activity archive was inspected before submission.
