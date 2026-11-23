# Build 126 AI backend preparation

This is new source and local verification, not a deployment, Apple entitlement,
purchase acceptance, email-delivery receipt, budget increase or public release.
Build 125's deployed endpoint remains untouched by this work.

## Source and protocol

- CLI-created migration: `supabase/migrations/20261123055659_coach_wallet_v2.sql`.
- `ai-coach-v2`: ordinary JWT gateway verification plus `auth.getUser` owner
  verification; RevenueCat Pro verification never uses the billing-off/QA bypass.
- `coach-pack-webhook`: separately authenticated RevenueCat server callback.
- `coach-maintenance`: separately authenticated scheduled purge/reminder worker.
- Product identity: `strideos_coach_messages_30_12mo`; 30 messages, 12 calendar
  months from verified original purchase, no dependency on continued Pro access.

GET `?usage=1&timezone=<IANA>` returns `{ usage: { version: 2, used, limit,
remaining, resetsAt, timezone, timezoneChangePending, purchasedRemaining,
purchasedExpiresAt, packsEnabled, canPurchase, pro } }`. The limit is 20 for Pro
and 0 otherwise. Resets use the server's current timestamp and stored timezone.
A requested timezone change is deferred to a period boundary and carries usage
through its transition; changing a phone clock cannot create a grant.

POST includes `{ requestId: UUID, timezone, consentVersion: 2, system, messages }`.
Version 2 is the renewed sharing/retention disclosure; old version-1 consent is
not accepted by the new endpoint. Legacy v1 keeps its original payload contract.
Each message has `{role, content, createdAt: epochMilliseconds}`. Expired messages
are rejected and orphan leading assistant messages must be removed by the client.
The actual serialized provider input, including server-owned safety text and
role/JSON overhead, is bounded to 12,000 UTF-8 bytes. The provider model is pinned,
output is capped at 1,024 tokens, and no tools or client-selected model are used.
This is a conservative text-token cost envelope, not a provider invoice promise.

GET `?requestId=<UUID>` recovers only that owner's completed response and its
original server `createdAt`, returns pending/failed, 404 not-found, or 410 expired.
Recovery never generates another answer. A complete cached reply lasts at most
24 hours. Content-free receipt tombstones survive content expiry. Stale pending
work older than 90 seconds is reconciled as failed without regenerating it; the
customer message is returned while its conservative operating reservation stays.

POST `?purchase=1` with `{intentId: UUID}` reserves one owner-specific five-minute
purchase intent. Another purchase is not offered while unexpired credit remains,
while generation is pending, or while another purchase intent remains active.
POST `?purchase=cancel` with the same owned id releases the reservation. A genuine
paid overlapping/out-of-band transaction is preserved exactly once and marked
for operator reconciliation; money is never silently discarded to enforce an
offer rule. Native multi-device/recovery acceptance remains required.

## Compatibility and abuse controls

All new tables have RLS and no anon/authenticated direct access. RPCs are
security-invoker, fixed-search-path, service-role-only. Owner identity comes from
the authenticated Edge Function, not a client owner field. Purchase identity is
globally unique and cannot transfer to another owner by replaying a transaction.
Refund-before-purchase remains a revoked receipt. Account deletion cascades
wallet/request/intent data; the transaction tombstone retains no profile/chat
and loses its owner association rather than permitting a new-account replay.

Installing the migration alone does not enroll an owner in v2. A usage GET does
not enroll. On the first enabled generation reservation, overlapping legacy UTC
usage is conservatively seeded under owner-before-global locks. Once enrolled,
the legacy SQL consumer denies v1 to prevent a second 20-message allowance.
Usage GET reports the same conservative legacy overlap count before enrollment,
including exhaustion, so its display and first-send decision agree.
The new service-only `stride_coach_v2_is_enrolled` RPC supports an explicit old-
client update response. Deploy that old-entrypoint response only after migration
acceptance; a missing RPC must not unexpectedly disable the current v1 service.

An operator-only `stride_coach_v2_rollback_owner` RPC refuses pending work,
seeds the current legacy UTC bucket from the greater already-used allowance,
then removes enrollment without deleting purchased balances or billing/replay
receipts. It never runs automatically and is not callable by app users.

V2 shares v1's existing global 500/day counter and lock. It reserves 20,000,000
nanodollars ($0.02) per attempted provider call from a separate explicitly
configured monthly operating envelope. Unknown/failed provider work does not
release that envelope. This does not raise, replace or prove the provider's own
organization limit. Six unique attempts/minute or three failed attempts/five
minutes trigger a per-owner cooldown before any new credit/cost reservation.

## Activation gates and required configuration

Defaults are deliberately closed: DB `enabled=false`, `packs_enabled=false`,
`apple_expiring_approved=false`, `monthly_budget_nano_usd=0`. New sales must remain
off until Apple approves the expiring-consumables entitlement, the app is App
Store-available, product/store metadata is accepted, safe coaching quality/cost
tests pass, capacity is funded, and native purchase/refund/recovery QA passes.
No nonexpiring fallback or other expiry policy is silently substituted.

The following configuration must be verified through the existing protected
secret-management flow, never copied into source, commands, logs or this record:

- Existing Supabase and Anthropic/RevenueCat read credentials.
- `STRIDEOS_COACH_V2_ENABLED` for the versioned chat endpoint.
- `STRIDEOS_COACH_MAINTENANCE_ENABLED` for retention cleanup, independent of
  generation/new-sales availability.
- `STRIDEOS_COACH_EXPIRY_REMINDERS_ENABLED` for previously-sold expiry notices;
  stopping new pack sales must not stop existing-credit reminders or refunds.
- Both `STRIDEOS_COACH_PACKS_ENABLED` and
  `STRIDEOS_APPLE_EXPIRING_CREDITS_APPROVED` for new purchase grants. Authenticated
  valid refund events remain active even when these flags are disabled.
- Matching DB approval/operational flags and an owner-approved monthly envelope.
- `STRIDEOS_REVENUECAT_APP_ID` and a strong, dedicated
  `STRIDEOS_REVENUECAT_WEBHOOK_AUTHORIZATION`, configured on RevenueCat's app-
  specific production webhook. Sandbox, other products/stores, aliases and
  quantities other than one never grant production credits.
- A different strong `STRIDEOS_COACH_MAINTENANCE_AUTHORIZATION` for the scheduler.
- `STRIDEOS_COACH_REMINDER_RESEND_KEY` and a verified fixed email address in
  `STRIDEOS_COACH_REMINDER_FROM`; this is distinct from Auth SMTP configuration.

Deploy chat with gateway JWT verification enabled. The webhook and maintenance
routes need their narrowly reviewed custom-auth deployment configuration because
RevenueCat/the scheduler send their own authorization value. This record does
not authorize disabling JWT verification on any other route.

Configure a protected scheduler to POST only the fixed maintenance URL at least
every five minutes, reading authorization from the secret store (not literal
cron text). Verify scheduler success/failure alerts and make a synthetic email
delivery acceptance check before enabling packs. No scheduler or email was
created/sent by this source work.

Maintenance removes expired cached reply bodies globally without erasing charge
or replay receipts. It queues expiry reminders at 30 and 7 days for actual
positive, unexpired, nonrevoked packs, excluding deletion-pending owners. Claims
are single-flight. Confirmed account email is fetched only for the authorized
recipient; addresses and chat bodies are not written to reminder receipts.
Resend uses a stable opaque idempotency key per transaction/deadline. Email body
does not embed a changing message balance, so retries keep the same payload.
Uncertain sends are retried only within the provider's idempotency window;
older/too-many-attempt cases require operator reconciliation, not blind resend.

StrideOS chat expiry must not be represented as deletion from all providers or
backups within 24 hours. Provider retention has separate contractual/legal
conditions. Purchase/usage and minimal reminder receipts outlive chat text.

## Local checks

Hosted Auth permission compatibility requires the additive migration
`20261123064711_coach_wallet_v2_owner_lookup.sql` after the original wallet
migration. Hardened hosted projects intentionally deny `service_role` direct
`auth.users` reads. The private-schema boolean existence helper is the sole
definer operation; ledger functions retain invoker permissions and existing
deletion checks. Do not expose `stride_coach_private` in the Data API or grant
clients helper execution. No broad Auth read grant is needed. The SQL fixture
now denies direct Auth reads for service/client roles and executes both
migrations, including the unchanged legacy quota path.

Temporary timezone exception: the hosted PG17.6.1.166 image predates the
[Supabase tzdata fix](https://supabase.com/changelog/tzdata-local-time-vancouver-edmonton-casablanca).
The central Edge helper applies a disclosed UTC daily-allowance policy for
Vancouver, Edmonton, Casablanca, El Aaiun, Inuvik, Winnipeg and their listed IANA
aliases. Additional changes and exact aliases are checked against
[IANA tzdb 2026e](https://data.iana.org/time-zones/tzdb-2026e/).
Usage returns `requestedTimezone` and
`timezoneFallback: 'server_tzdata_outdated'`; `timezone` and `resetsAt` remain the
actual SQL wallet values, including a pending guarded transition. The UI must
describe 00:00 UTC temporarily, or the existing reset while a transition is
pending; it must not promise local midnight in these regions. No legal offset
is guessed from Edge Intl. Purchased expiry is unchanged. Removing the exception
requires operator verification of hosted present/future timezone conversions
after a separately planned database fix; deployment does not upgrade Postgres.

Behavior tests: `npx tsx --test scripts/tests/coachV2.test.ts
scripts/tests/coachMaintenance.test.ts`.

The SQL test is explicit-skipped unless `STRIDEOS_TEST_PGLITE_MODULE` points to a
pinned local PGlite module installed outside the checkout. The verified engine
for this source run is `@electric-sql/pglite@0.5.17`. Run
`scripts/tests/coachWalletV2Sql.test.ts` with that environment variable. This
executes the actual migration and functions with synthetic accounts and roles;
it does not contact hosted Supabase. It is not production-concurrency proof or a
substitute for deployed advisor, timezone-data, native and service acceptance.

Actual Edge Function type checks use Deno 2.6.6, with system certificate trust:
`DENO_TLS_CA_STORE=system npx --yes deno@2.6.6 check
supabase/functions/ai-coach-v2/index.ts
supabase/functions/coach-pack-webhook/index.ts
supabase/functions/coach-maintenance/index.ts`.
