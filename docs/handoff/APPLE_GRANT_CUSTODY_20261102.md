# Apple grant custody — revised durable intents and acceptance receipts

November 2, 2026. Canonical Developer checkout. **Darwin's actual-artifact review found no remaining must-fix; Confucius's
v4 exact security rebaseline is ready. This is NOT deployed acceptance.**
The initial 74-test implementation had an exchange/deletion race and is
superseded by this revision. No credential/customer reads, live provider calls,
backend changes, builds or commits were performed by this seat.

## Public contract and native integration

POST `/functions/v1/apple-grant` with the normal anon gateway `apikey` and
Supabase Bearer session. Body has exactly `authorizationCode`, `identityToken`,
and `nonce` (raw 64 lowercase hex). Verify native Apple nonce = SHA-256(raw).
Success is HTTP 200, exactly `{"captured":true}`. Safe failure is HTTP 503,
`{"error":"Apple authorization could not be secured. Retry with a fresh Apple sign-in."}`.
OPTIONS remains credential-free; unsupported methods return 405. No secrets or
intent IDs are returned. Main's ephemeral Supabase exchange/capture client must
persist the main SDK session only after this exact success acknowledgement.

**Custody completion is distinct from login eligibility.** A reserved valid late
response during pending deletion commits encrypted custody bound to that job,
but store returns false and the handler returns 503. Capture precheck/retry
cannot acknowledge login once deletion exists. The uncertainty marker cannot
downgrade a completed intent after a lost acknowledgement.

Authenticated deletion preflight adds optional `appleGrantRetained:true`; absence
means false. Initial prompts can be skipped when retained custody exists;
explicit fresh-credential repair remains available when appropriate. New pending
reasons are `capture_in_flight` and `capture_outcome_unknown`. An exceptional
manual unknown outcome remains `manual_required/capture_outcome_unknown`, never
legacy or provider-confirmed. Server sanitizer and current client protocol
preserve these reasons. Main owns AccountCleanupGate presentation.

## Durable exchange and deletion boundaries

- Verify Apple JWKS signature, issuer, exact configured audience, expiry and
  subject against authenticated Supabase Apple identity. Native nonce is required;
  exchanged nonce must match when present. No email/user-metadata authority.
- Resolve signing configuration, then reserve before `/auth/token` under the
  Auth-user lock. Exactly one caller receives a random intent ID; a busy duplicate
  cannot exchange, complete or mark another caller's intent. No TTL expiry exists.
- Completion matches intent ID + owner + subject + audience + code hash. It is
  one-shot; an altered replay cannot replace custody. Each completed supported
  token response stays encrypted in Vault until revocation/account cleanup.
  The response is allowlisted to refresh/access/id token, Bearer type and expiry.
- Registration generation is serialized per owner. A late older response remains
  encrypted for cleanup but cannot replace a newer active grant. Provider job
  refresh tokens, including explicit repair, take precedence over adoption.
- Deletion initiation remains available and fences NEW captures. The leased
  provider-token read, final provider dispositions, Auth deletion and completion
  reject unresolved intents and completed credentials without individual ACKs.
  No worker-coordinator rewrite was introduced.
- Transport/provider errors, truncated/malformed bodies, post-response JWKS
  errors and failed persistence remain unresolved. Even non-2xx responses are
  treated conservatively. If marking uncertainty fails, durable `reserved` state
  still blocks finalization. Time passing does not prove token absence.
- Existing worker adoption retains the primary/repaired job token. The same
  provider-preparation stage additionally drains every completed response's
  distinct refresh AND access credential. Each fixed-URL HTTP 200 is acknowledged
  by exact request lease, capture ID, kind and token hash before any aggregate
  purge. The SQL read returns at most seven pending credentials and the worker
  processes six per invocation; recorded progress survives failures/retries.
  This uses no guarantee that one token revokes all grants. Revocation purges
  active/older/late Vault responses,
  intent rows, capture receipts and the job token. Every intent has its own
  BEFORE DELETE Vault purge; Auth cleanup is independent of FK cascade order.
- Both reviewed Auth FKs are excluded from inventory ONLY when each table has
  exactly its expected validated, nondeferrable owner_id -> auth.users.id CASCADE
  FK and expected cleanup/Auth-guard trigger wiring. Conditional/argumented or
  disabled triggers, altered actions and extra Auth FKs retain the blocker.
  No schema-wide exception or runtime function self-hash was added.

## Exceptional operator recovery — not automated success

Prefer real fresh-credential repair and revocation whenever credentials can be
recovered. Unknown outcomes cannot be cleared by a clock, worker timeout or
customer assertion. Only a privileged operator may call
`resolve_stride_apple_capture_unavailable(owner_id,capture_id,acknowledgement,reason)`
after actually stopping/confirming no live writer and determining that the token
response is irretrievable. The exact acknowledgement is
`CAPTURE STOPPED; TOKENS UNAVAILABLE`; a nonempty bounded reason is required.

This records `manual_unavailable` and seals late completion. It does NOT revoke
Apple access or prove Apple issued nothing. The deletion worker's missing-token
outcome is preserved as `capture_outcome_unknown`; stopped-capture attestation is
retained in private request-state metadata so readiness survives Auth cascade.
Known credentials/failures cannot be relabelled as a missing-token fallback.
If known credentials are individually revoked alongside a separately attested
manual-unknown exchange, the aggregate Apple result remains
`manual_required/capture_outcome_unknown`, with private proof that known tokens
were revoked. It never becomes aggregate `provider_confirmed` for that unknown.
The private plan exposes `apple_capture_recovery_attested:true` only from the
server-written stopped-capture proof; the shared core must require that flag.
No public endpoint exposes this operator RPC, and ordinary roles cannot invoke it.

Main's narrow `src/utils/deletionFulfillment.ts` integration is now independently
reviewed: manual unknown is allowed only for Apple, fulfillment v1 and strict
`apple_capture_recovery_attested === true`. Pending reasons remain blockers.
Darwin ran the new actual fulfillDeletion recovery tests and existing fulfillment
tests: 17/17 passed, zero skips. This seat did not edit the shared coordinator.

## Configuration — not provisioned

Explicit `STRIDEOS_APPLE_CLIENT_ID` selects native audience and exchange client.
The shared helper can mint ES256 client-secret JWTs from server-only
`STRIDEOS_APPLE_PRIVATE_KEY`, `STRIDEOS_APPLE_KEY_ID`, `STRIDEOS_APPLE_TEAM_ID`
with a five-minute expiration; `STRIDEOS_APPLE_CLIENT_SECRET` is the fallback.
Deletion lazily reuses the signer. No key/secret is in the client or token payload.
The installed 108 binary does not gain this flow from a server-only deployment.

## Migration and rollback probe

The unapplied CLI-created migration is
`20261102081943_apple_grant_custody.sql`, revised in place with main's permission.
Private relations: `grants`, `captures`, `capture_intents` in `stride_apple_private`.
RLS has no client policies; public RPCs are service-only with empty search paths.
New capture RPCs: `reserve_stride_apple_capture`, `mark_stride_apple_capture_uncertain`,
`resolve_stride_apple_capture_unavailable`, `ack_stride_apple_capture_token`;
`store_stride_apple_grant` now requires
its sixth `capture_id` argument. Endpoint body/success protocol is unchanged.

`scripts/probes/apple-grant-rollback.sql` is regenerated for this revision and
**not executed**. Its DO block generates synthetic Auth owners/identities and
fake token responses internally. No input owner IDs, credentials, DDL, network,
provider, dispatch, scheduler or email API. User/Vault queries use generated IDs.
It temporarily scopes deletion control to only those IDs within the same
uncommitted transaction so real lease/attestation guards run; no gateway secret,
worker URL or cron value is read/changed. Other transactions cannot see that
scope, and ROLLBACK restores it. Main must review this specific fixture scope.

The probe covers response round trip, idempotency, failed replacement rollback,
identity/new-capture fences, unresolved finalization, invalid lease, visible
unknown state, late custody WITHOUT login ACK, adoption, synthetic per-token ACKs and attestation
cleanup, and multi-response Auth cascade. Only one JSON result is emitted,
followed by mandatory ROLLBACK. Require both JSON and successful ROLLBACK command
receipt. Errors abort the transaction; do not save partial changes. A synthetic
attestation is never live Apple revocation acceptance.

## Validation and policy

Focused source/runtime/PostgreSQL results and final artifact hashes are recorded
below when the final run completes. PostgreSQL uses the already cached 18.6 test
engine, private Unix socket, no TCP, synthetic prior-schema contracts and a Vault
fixture. It tests actual SQL transactions, locks, triggers, structural guards and
both cascade orders; it does not prove deployed encryption or provider behavior.
The rollback probe itself remains statically reviewed only. No full suite or
physical-device/provider acceptance is claimed by this seat.

Main is updating/publishing the privacy paragraph separately. Final retention
model: retain all completed allowlisted responses and unresolved intent metadata
until revocation/account cleanup; selecting a newer active grant does NOT retire
all older responses. Unknown outcomes remain pending and exceptional recovery is
manual. Preserve minimal deletion-status/recovery records and provider-backup
qualifications; do not promise automatic revocation, fixed TTL erasure or
anonymity. Existing linked identity functionality categories remain relevant;
actual policy must match the enabled client/server flow. Pages HTML was not
edited by this seat.

References: [Apple TN3194](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple),
[Apple token validation](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens).

## Frozen review artifact

Affected backend/deletion tests: **91/91 passed, zero failures/skips**.
Targeted TypeScript checks passed. Both Deno endpoints checked with the cached
binary shown below. Probe static checks passed; probe NOT executed.

```sh
/Users/drew/.npm/_npx/de10277f880c84d3/node_modules/@deno/darwin-x64/deno check --no-config --no-lock supabase/functions/apple-grant/index.ts supabase/functions/account-deletion/index.ts
```

SHA-256 snapshot for Darwin; no approval or deployed acceptance implied:

| Path | SHA-256 |
| --- | --- |
| `supabase/migrations/20261102081943_apple_grant_custody.sql` | `747d3e324a7856eb113f372c37f3469d359d8a6a6dc02a802c64a27372cbc1b3` |
| `supabase/functions/apple-grant/index.ts` | `e3eca3def2e922d37faca9409c44551a4b3b92a1f1b4c26649458d5d270cc771` |
| `supabase/functions/_shared/appleGrant.ts` | `86e3f0836e8cdda36252a0c3d6f010df256b76ae79af1fd6db5f57fda4227d69` |
| `supabase/functions/_shared/appleGrantClientSecret.ts` | `7553c49197a26bda407a96aaddd26ffb726d30489a508084306afa26a6b26a99` |
| `supabase/functions/_shared/appleGrantCrypto.ts` | `f29b7537155d4b9c2fcc47de123797caf66ec4816eefe419852a9d430a52ca18` |
| `supabase/functions/_shared/appleGrantRuntime.ts` | `a188f3ff78b66be8b56aeaa97eb4b918b3173418e004c72b6817408388a4182e` |
| `supabase/functions/_shared/deletionHandlers.ts` | `34de734c3ab19036d8ea984e5745be1afe9df00564b627904e2942879db372b6` |
| `supabase/functions/_shared/deletionRuntime.ts` | `9dc2ee56a854cd167cefc2678ca8a29d3737adffdabb93ea6204a30688b3c76b` |
| `src/lib/accountDeletionProtocol.ts` | `0caae33edc3a7ef4e333198f7283e1f08aef4fdf07a2bdc32d3395940b3c74d8` |
| `scripts/tests/appleGrant.test.ts` | `52c33444e70760bbe5663fe4f6f01586a53d59650a40d2e287151001cf8cee2b` |
| `scripts/tests/appleGrantRevocation.test.ts` | `a4ae5a725a78ab7185b78c7d72a66e63f278944f269c97437512c74731f1703d` |
| `scripts/tests/appleGrantRuntime.test.ts` | `26227f3a77fbbb44a643ba781338a6e65c467eba0ecf6a2b02e5a56fc0709771` |
| `scripts/tests/appleGrantSql.test.ts` | `3098e9d6d605d9d913d928f9659b2a621f257fdd9391a6a0591b7358a970e103` |
| `scripts/probes/apple-grant-rollback.sql` | `d3dc4eabd6ff1a44268bf7245d257bdbebbc928e80ae0a6737082dd52f37a287` |

## Independent source review receipt

Darwin reverified all 14 frozen hashes, independently ran 91/91 affected backend
tests (zero skips), and returned no remaining must-fix. He also reviewed main's
coordinator change and independently passed its recovery/fulfillment tests 17/17
(zero skips). These counts overlap existing fulfillment tests; do not sum them
as unique cases. Coordinator SHA-256:
`19b5319a6c93c8096838f60f13cda549ab37ac6862d227856e014fe937a26131`.
New recovery-test SHA-256:
`706e9c211e24359298198ba19364f3b355f26da08b58001898d36480e2b43387`.

The targeted TypeScript check and both Deno endpoint checks completed exit 0.
Confucius was notified to rebaseline only the reviewed exact expected artifacts.
The migration has not been applied by this seat; the probe remains unexecuted.
No live-provider, native-device or public-launch acceptance is implied.

## Confucius v4 manifest receipt

Confucius completed `scripts/auditLaunchSecurity.sql` v4 and its security handoff.
Audit SHA-256: `fee6bda05e5db7e79829d24d6f537c3463898850da09cb9ca0aca71c0034bdf1`.
This seat reverified that hash and the approved migration/runtime/coordinator
hashes above against current bytes. No backend source changed for this receipt.

Per Confucius: 32/32 focused tests passed without skips, including the approved
migration and 12 SQL drift-rejection cases; strict targeted TypeScript passed.
The manifest checks exact source/ACL/schema/FK/trigger contracts, including all
10 created public RPCs, three private tables, 23 columns and eight triggers.
No live-derived hash whitelist was added. Before applying the migration, v4 is
expected to fail on missing contracts; that is not a reason to relax the audit.

Main owns reviewed migration application, read-only v4 readback and the separate
all-rollback semantic probe. None was performed by this seat. Provider exchange,
revocation, native acceptance and public release remain separate gates.

## Main deployment and rollback receipt — November 2, 2026

Main reports the exact reviewed `747d3e...` migration applied, followed by the
reviewed `d3dc4e...` all-rollback Apple DB probe: all 20 assertion flags passed,
all synthetic fixtures rolled back, and no external provider operation occurred.
Main also deployed four functions and retrieved their source: all 33 files
matched expected bytes. Reported metadata: account-deletion v5/JWT true, status
v3/JWT false, worker v3/JWT false, apple-grant v1/JWT true. These are parent's
live receipts, not fresh backend access by this seat.

Parent final serial suite: 1,575/1,575 passed, zero skips, 156.7 seconds; npm check,
all four Deno endpoint checks and final Hermes export passed at that checkpoint.
Boundary-probe expected-status corrections (worker 401/status 404) and its final
rerun remain main-owned; do not infer a completed boundary receipt from initial
checks. Real Apple signing key/key ID and actual exchange/revocation acceptance
remain absent. No billing, deletion-service or public-release activation is
claimed by these source/fixture/deployment receipts.

The v4 live catalog receipt had six legacy maintenance-privilege failures; the
v5 preparation additionally detects PG17+ MAINTAIN privileges. Confucius supplied
maintenance-only migration `20261102100131_launch_legacy_maintenance_privileges.sql`
SHA-256 `a55122b148001bd2ed463de8e5c8f6cb3c85abea69b8431886ffce9cc73b915b`
and v5 audit SHA-256
`fdad9eeefe929074a5e2280df9a82caec5720e952d96c470dbdf48cd66a9b1e3`.
This seat verified those exact bytes and reviewed the narrow two-table scope,
column/grant-option drift guards, atomic rollback and effective inherited-right
checks. Application and fresh full v5 live readback remain with main. No live
audit or migration was executed by this seat.

Independent maintenance-source validation by this seat: 38/38 focused tests
passed, zero skips (launchSecurity.test.ts + launchSecuritySql.test.ts). No
remaining source must-fix found in the exact maintenance migration/v5 audit
hashes above. This is source acceptance; fresh deployed v5 readback is separate.
