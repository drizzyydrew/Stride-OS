# Backend Isolation Receipt

Verified October 31, 2026 after the owner explicitly authorized separating Bet
Desk and StrideOS without unnecessary deletion.

## Active Projects

| App | Supabase Project | Organization |
| --- | --- | --- |
| StrideOS | `pbzgrhnxpbtlkzpreizy` | Moore Movement |
| Bet Desk | `dcqigdevqbugyodoxmbe` | Bet Desk |

No project URL, user identifier, login credential, workout, bet, or media object
needed migration. No account was deleted, project paused, or plan upgraded.

The initial new-project attempt was rejected by Supabase's account-wide two-free-
project limit, despite a $0 quote. No new project was created. Further inspection
found the existing dedicated Bet Desk project. Reusing it avoids an unnecessary
paid upgrade and preserves both production identities.

## Verified Before Isolation

- Bet Desk's Vercel production/preview `REACT_APP_SUPABASE_URL` is the dedicated
  Bet Desk URL, verified through the authenticated CLI for project
  `prj_GNKa1GSieEanl5np0r6O9uFoXnhG` and team
  `team_mIT8D6GGqwbcK4MaIookMLul`. Only the public URL variable was decrypted;
  no service credential was retrieved.
- Bet Desk's EAS production `EXPO_PUBLIC_SUPABASE_URL` also points to the dedicated
  Bet Desk URL. Checked against the mobile app's existing EAS project
  `7cb7a1f6-7770-4c42-aacf-c038dfe31077`. A temporary read-only project descriptor
  avoided changing or materializing its offloaded `eas.json`.
- The dedicated Bet Desk dashboard database returned 13 Bet Desk tables, one
  account/profile, 406 bet rows and 523 daily-pick rows. No private row contents
  were read. Bet Desk source, environment settings and deployments were not changed.
- StrideOS's project had nine legacy `public.betdesk_*` tables. All nine were
  empty, including profiles, bets, settings, exports, and feeds. No public function
  or view depended on them. They were not the active Bet Desk backend.

## Non-Destructive Isolation

Migration `20261031180919_isolate_legacy_betdesk_tables.sql` moved the nine legacy
tables to the private `betdesk_archive_20261031` schema. It did not drop a table or
delete rows. Their original relation OIDs and exact row counts were checked before
and after. The manifest preserves those identities, original ACLs, and definitions
of the detached legacy Auth foreign keys.

The migration locks the legacy tables and refuses to proceed if legacy customer
records, unexpected tables, or active public function/view dependencies appear.
Obsolete Auth foreign keys were detached only after proving the corresponding
legacy customer tables were empty. Future StrideOS account deletion therefore
cannot cascade through those archived Bet Desk tables.

Anonymous and authenticated clients have no schema access. Service role has
read-only archive access; the schema is not a public app API. The active StrideOS
schema contains zero Bet Desk tables. Rollback is possible by an authorized
operator using the stored manifest, but is not an ordinary app action and should
not be performed without checking for later schema or data changes.

StrideOS post-operation readback still showed one Auth account, 15 workout
backups, five strength backups, and two stored media objects. These counts were
unchanged. SQL test users/requests were rolled back and their absence read back.

## Deletion Is Still A Separate Gate

The shared-backend architecture blocker is resolved. This does not mean account
deletion is fully delivered. The guarded operator workflow defaults to a dry run,
requires a confirmed request and an expiring lease, removes files via Storage API
before Auth, verifies actual removal, and only then marks the retained receipt
complete. It refuses social-provider accounts until revocation is configured.
The existing account has an Apple identity; no deletion was attempted.

Apple/provider revocation, local-device cleanup, completion delivery, retention
operations and end-to-end testing with dedicated disposable accounts remain
public-launch requirements. Do not execute the operator against a real account
merely to validate this separation. Do not put server credentials in source,
public environment variables, logs or chat.
