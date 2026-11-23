# Build 127 history and archive data changes

Completed-workout deletion records stable identity, not the deleted workout's route, notes, metrics or exercises. The canonical Activity store retains owner-scoped tombstones; they block legacy boot imports, native/Health restoration and stale cloud records. An explicit disk readback acknowledges a deletion revision before legacy projections or cloud deletion can consume it. Background writes alone do not acknowledge deletion. A failed save is reported and can be retried with the original owner lease.

`deleteCompletedWorkout` removes the entire recorded workout. Workout/strength/custom legacy delete actions also wait for the durable intent before removing their projection. Settings history now reads canonical Activity records. No operation here deletes a workout from Apple Health.

A schedule slot and a recording have different identities. After deleting a planned log, a genuinely new performance receives a fresh physical ID and retains its logical `completionKey` for schedule status, lookup and editing. Cloud hydration preserves that distinction. Native running and captured strength/custom/preset retries retain their exact recording identity; a deleted recording cannot become a new performance through Finish retry.

## Cloud contract

Migration `20261123123200_workout_deletion_and_archive_revisions.sql` adds owner-RLS-protected `workout_deletions`, with a restrictive account-deletion freeze and a profile FK cascade. Its invoker RPC atomically stores intent and removes matching canonical/legacy cloud rows. A shared owner lock and four insert/update triggers reject stale re-uploads. The schema does not add broad Auth privileges or SECURITY DEFINER functions. Deleting the account profile cascades deletion intent.

Cloud restore reads deletion intent before publication, filters all restored log types and confirms local intent before restoring legacy projections. A missing/unreadable tombstone table fails restoration closed; it never becomes an empty success. Explicit deletion intent is replayable after offline restart. An older app can still display a previously cached local copy until updated; the server prevents it from restoring the deleted row to the backup.

## Archived goals

Raw archives retain `deletedAt` source tombstones so lifecycle backfill cannot recreate deleted goals. Visible archive consumers exclude deleted sources. Goal deletion preserves actual recorded workouts. Metadata corrections are independently revisioned by update time and mutation ID; they change display name/window while preserving the original captured plan, prescriptions, original window and frozen summary. The detail view identifies the original frozen window. Result updates merge independently. The new invoker revision RPC preserves both metadata and deletion through older result-only RPC writes.

Repeat opens owner-scoped Next Goal with goal intent and setup information only. A stable per-form operation ID distinguishes retry from a deliberate new plan. Actual logs and completed set flags are never copied into a new block.

## Verification

Local behavior tests cover disk setter/readback failure, an active projection observer during a failed save, retry, owner changes, offline restart, legacy re-import, stale cloud/Health aliases, new scheduled performances, exact recording retry protection, archive correction/deletion and stale cloud replay.

`build127HistorySql.test.ts` executes the migration under actual PostgreSQL role/RLS behavior. `scripts/verification/build127-history-acceptance.sql` uses synthetic Auth UUIDs and scoped records inside BEGIN/ROLLBACK, verifies cross-owner/anonymous rejection and frozen-plan preservation, then rolls back all writes. Hosted acceptance is executed and recorded by the release owner, not inferred from local tests.
