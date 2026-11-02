# StrideOS security acceptance v5 and rollback receipts

## Main applied and read back — 2026-11-02

Main reports successful application of the exact third migration
`20261102100131_launch_legacy_maintenance_privileges.sql`, SHA-256
`a55122b148001bd2ed463de8e5c8f6cb3c85abea69b8431886ffce9cc73b915b`.
The new full live v5 readback is **PASS: 1259/1259 catalog checks and 3/3 dormant
checks; zero FAIL, zero REVIEW, zero issues**. Automation remains off, the owner
scope is empty, and no deletion Cron job is active. The earlier v4 failures and
preparation-only status below are historical, not outstanding acceptance gaps.

Main-owned compact receipt:
[LAUNCH_SECURITY_ACCEPTANCE_20261102.json](LAUNCH_SECURITY_ACCEPTANCE_20261102.json).
Full result: [/tmp/strideos-launch-security-v5-full.json](/tmp/strideos-launch-security-v5-full.json).
This seat read both stored metadata artifacts offline and confirmed their v5
profile, phase results and counts agree. Main performed the deployed execution;
this is receipt verification, not a new independent backend execution. The
profile is `20261102-legacy-maintenance-5`, source base `cbf1932`, target project
`pbzgrhnxpbtlkzpreizy`, explicitly bound by main's execute_sql project_id.

Main also reports the approved Apple rollback probe (source hash prefix `d3dc`)
passed all checks and rolled back. This seat did not independently run the live
probe. Main reports final export checks and Deno checks passed. The latest full
serial source run, including the maintenance tests, was **still underway** at
this update; the prior full run was **1575/1575 green**. Do not treat that prior
count as completion of the new serial run.

**No independent Apple/other-provider or physical-device acceptance is claimed.**
Catalog acceptance and synthetic rollback evidence do not prove live provider
revocation, native device behavior or public-launch readiness, and do not
authorize activation. This update changes only this handoff document; code,
audits and SQL remain frozen. No new network/backend call, key/customer-row
read, deployment or activation was performed by this seat.

## Maintenance follow-up — applied by main; preparation history

Main reports the exact approved Apple migration (`747d3e...`) was applied
successfully. The deployed v4 audit returned **1175 catalog checks: 1169 PASS,
6 FAIL; dormant 3 PASS**. The six failures were effective service_role REFERENCES,
TRIGGER and TRUNCATE on public.movement_videos and public.analysis_requests.
They are correctly rejected by the existing legacy least-privilege gate, unrelated
to the earlier mistaken CRUD requirement. They do not establish customer-row
exposure.

Main's second raw ACL readback supplies this exact metadata for **each** table:

| Owner / grantee | Direct privileges | Grant option |
| --- | --- | --- |
| owner postgres | owner privileges | owner |
| anon | MAINTAIN | false |
| authenticated | MAINTAIN | false |
| service_role | MAINTAIN, REFERENCES, TRIGGER, TRUNCATE | false |
| PUBLIC | no entry | none |

**Audit omission corrected:** v4 did not enumerate PostgreSQL 17+'s MAINTAIN.
v5 includes it in every table/role privilege check when server_version_num is
at least 170000, and emits server_version_num plus maintain_supported. PostgreSQL
16 and earlier retain the seven supported privilege checks and explicitly emit
maintain_supported=false. Older-server behavior is source-gated; local tests use
PostgreSQL 18.6, not a claimed PG16 run. A v4 PASS would not establish MAINTAIN
acceptance. For this current project, require maintain_supported=true and a
fresh v5 result. No live count or body fingerprint was whitelisted.

New standalone CLI-created migration:
`supabase/migrations/20261102100131_launch_legacy_maintenance_privileges.sql`
SHA-256: `a55122b148001bd2ed463de8e5c8f6cb3c85abea69b8431886ffce9cc73b915b`.
It is the **third source extension**. Both previously applied migrations and
all approved function source bodies remain unchanged. All 49 existing function
contracts still apply; no new persistent function is created by the DO block.

The migration revokes only MAINTAIN, REFERENCES, TRIGGER and TRUNCATE from
PUBLIC/anon/authenticated/service_role on **exactly the two legacy tables**.
It grants nothing and does not remove CRUD, change policies, scan/change customer
rows, modify roles/memberships, alter functions or activate deletion. One DO block
makes all guards and both-table revokes atomic. It locks both tables, requires
PostgreSQL 17+, ordinary RLS-enabled tables owned by postgres, no unexpected
maintenance grant options and no direct API/PUBLIC column REFERENCES ACLs.
That column guard matters: PostgreSQL table REFERENCES revocation also removes
matching column grants. After REVOKE, effective table/column maintenance must be
absent for all three API roles; surviving inherited rights abort and roll back
all direct ACL changes. No role membership or other-table grant is widened or
removed to force success. The operation is safe to rerun after successful cleanup.

Meaningful fixtures reproduce main's exact raw ACL and assert **12** failing
legacy ACL checks before cleanup (six old + six newly detected MAINTAIN), and
zero after. Separate fixtures preserve unrelated CRUD/PUBLIC SELECT, exact
policies and synthetic records, prove idempotence, and prove inherited access,
second-table RLS/grant-option drift or unexpected column REFERENCES cannot cause
partial revocation. Public SELECT is preserved only to test the migration's
narrow scope; the catalog audit still correctly rejects it as API exposure.

Historical pre-apply procedure (completed by main): read only metadata for these two
relations: owner, kind, RLS, direct relation ACL entries, **column ACL entries**,
and effective four maintenance privileges for anon/authenticated/service_role.
The new column guard must pass; do not bypass it if readback reveals extra grants.
Apply only the exact new migration after review, then run the entire v5 audit
(one final JSON result plus ROLLBACK). Require successful SQL execution, exact
v5 profile/source identities, both phase rollups PASS and every individual check
PASS. In particular inspect all six new MAINTAIN checks on these two tables;
MAINTAIN elsewhere is also now audited under the existing role/table rules.
A fresh v5 result, not arithmetic on v4 counts, supplies final totals. Catalog
acceptance remains separate from provider/device behavior and activation.

### v5 local receipt and exact metadata readback

Focused final run: **38/38 passed, zero failures/skips**. Strict targeted
TypeScript compilation passed. Source tests verify all three extension hashes
and the unchanged 49 function contracts. PostgreSQL fixtures use private Unix
sockets only and are stopped/removed. Neither migration nor audit was executed
against a deployed project by this seat. No dependencies/package changes.

The bounded pre-apply catalog-only query is retained below as a review artifact;
no additional execution is requested. It returns
one JSON row, reads no application rows/secrets and changes no records. The
migration's guard requires column_references to be empty for the listed API/
PUBLIC grantees; evaluate surviving effective rights through the full v5 audit.

```sql
begin transaction read only;
set local statement_timeout='10s';
set local lock_timeout='2s';
with targets as (
  select c.oid,c.relname,c.relowner,c.relkind,c.relrowsecurity,c.relacl
  from pg_catalog.pg_class c
  where c.oid in ('public.movement_videos'::regclass,'public.analysis_requests'::regclass)
), roles as (
  select oid,rolname from pg_catalog.pg_roles
  where rolname in ('anon','authenticated','service_role')
)
select jsonb_build_object(
  'server_version_num',current_setting('server_version_num')::integer,
  'relations',(select jsonb_agg(jsonb_build_object(
    'table','public.'||t.relname,'owner',pg_get_userbyid(t.relowner),
    'kind',t.relkind,'rls',t.relrowsecurity,
    'direct_acl',(select coalesce(jsonb_agg(jsonb_build_object(
      'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      'privilege',a.privilege_type,'grant_option',a.is_grantable)),'[]'::jsonb)
      from aclexplode(t.relacl) a),
    'column_references',(select coalesce(jsonb_agg(jsonb_build_object(
      'column',c.attname,'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      'privilege',a.privilege_type,'grant_option',a.is_grantable)),'[]'::jsonb)
      from pg_catalog.pg_attribute c cross join lateral aclexplode(c.attacl) a
      where c.attrelid=t.oid and c.attnum>0 and not c.attisdropped
        and a.privilege_type='REFERENCES' and (a.grantee=0 or a.grantee in (select oid from roles)))
  ) order by t.relname) from targets t),
  'effective',(select jsonb_agg(jsonb_build_object('table','public.'||t.relname,
    'role',r.rolname,'privilege',p.name,'table_allowed',has_table_privilege(r.oid,t.oid,p.name),
    'any_column_references',case when p.name='REFERENCES' then has_any_column_privilege(r.oid,t.oid,'REFERENCES') else false end)
    order by t.relname,r.rolname,p.name)
    from targets t cross join roles r cross join (values ('MAINTAIN'),('REFERENCES'),('TRIGGER'),('TRUNCATE')) p(name))
) as legacy_maintenance_metadata;
rollback;
```

## Approved durable-intent source profile (retained in v5)

Darwin approved the frozen backend **and actual shared coordinator diff**, with
no remaining must-fix. This seat independently read the final migration and
verified all three source identities below. The earlier candidate findings and
pending-hold discussion are historical. v4 removes the forced pending REVIEW;
ordinary missing/drifted catalog contracts still FAIL. No live function hash was
used to generate any expectation.

| Approved source | SHA-256 |
| --- | --- |
| `supabase/migrations/20261102081943_apple_grant_custody.sql` | `747d3e324a7856eb113f372c37f3469d359d8a6a6dc02a802c64a27372cbc1b3` |
| `supabase/functions/_shared/deletionRuntime.ts` | `9dc2ee56a854cd167cefc2678ca8a29d3737adffdabb93ea6204a30688b3c76b` |
| `src/utils/deletionFulfillment.ts` | `19b5319a6c93c8096838f60f13cda549ab37ac6862d227856e014fe937a26131` |

Darwin reports all 14 frozen hashes matched, backend/deletion tests **91/91** and
actual coordinator/fulfillment tests **17/17**, zero skips; Lagrange also reports
focused TypeScript and both Edge entrypoint Deno checks passed. These are review
receipts from their owners, separate from this seat's focused audit tests below.
Source drift invalidates this prepared profile and requires another explicit
review; never whitelist an observed deployment hash to obtain PASS.

The manifest replays pinned `cbf1932` migrations plus the two reviewed extensions
in source order, including schema moves/renames and CREATE OR REPLACE. It covers
**47 migration-backed functions plus two explicitly reviewed legacy triggers**,
argument names/types/results/default counts, SECURITY DEFINER, pinned lookup
paths, ownership and effective EXECUTE/grant options. All **10** public RPCs
created by the Apple migration require service-only execution. The unchanged
`start_stride_deletion(uuid,text,jsonb)` body remains
`690c1a331fe6c8115e850d6c5fb9da2b`; atomic intake coordination is supplied by the
BEFORE INSERT owner-lock trigger, rather than a fictional changed start body.

All three Apple tables (`grants`, `captures`, `capture_intents`) require RLS,
no policies and no API/service schema/table/column grants. That private deny-all
configuration is intentional PASS, not a missing-policy security defect. v4 adds
exact columns (including both per-token ACK timestamps), primary/unique keys,
Vault-reference uniqueness, cascades, all eight unconditional zero-argument
trigger bindings and an exact trigger inventory count. Per-function source
fingerprints cover reservation, pending/uncertain fencing, no TTL inference,
late-response persistence, hash-bound token ACKs, manual unknown recovery and
provider/Auth/completion guards. Catalog evidence does not itself execute these
behavioral contracts.

Only `grants.owner_id` and `capture_intents.owner_id` may be excepted from the
unknown-Auth-FK fence, and only if each has **exactly one** Auth FK: the reviewed
constraint name, owner_id -> auth.users.id, validated/nondeferrable/not initially
deferred, ON DELETE CASCADE, ON UPDATE NO ACTION, MATCH SIMPLE. The exemption
also requires its exact enabled (`O`) unconditional zero-argument BEFORE DELETE
row cleanup and the same exact Auth finalization guard. Every FK on either table
is rejected if an additional Auth FK appears. Missing/conditional/argumented/
disabled cleanup or guard fails both the explicit fence and exemption. The
function-body checks separately require the reviewed cleanup/guard semantics.
Unknown Auth relationships on all other unsupported tables remain FAIL.

Independent final-source review found no remaining new permission/RLS/FK/trigger
blocker. Both Auth cascade orders purge retained Vault responses; unresolved
exchanges cannot expire by TTL into success; completed response refresh/access
credentials each need durable ACK before aggregate provider/Auth/completion.
A mixed known/unknown outcome remains manual_required/capture_outcome_unknown,
with explicit stopped-writer proof, rather than verified revocation. The narrowed
shared coordinator accepts only trusted Apple fulfillment-v1 recovery proof.

**Deployment status remains separate:** main reports owner-policy hardening
applied and the complete Storage rollback probe accepted, as recorded in
`STORAGE_OWNER_ACCEPTANCE_20261102.json`. At v4 preparation Apple custody was unapplied and pending_migration named it.
Main now reports both Apple custody and the third maintenance migration applied,
with full v5 readback PASS and the approved Apple rollback probe passed/rolled
back, as recorded above. The frozen v5 pending_migration field is preparation
metadata naming the third source extension, not evidence it remains unapplied.
The earlier before-apply FAIL expectation was historical. No independent
provider/device acceptance or activation is inferred. This seat made no
network/backend call, deployment or key/customer-row read. Nonsecret client/team
configuration is main-owned. At that earlier review, main reported private
key/keyID absent and capture not activated; that historical statement is not
a fresh credential/configuration readback.

### v4 local verification receipt

This seat's focused final run passed **32/32, zero failures/skips**, using
`node_modules/.bin/tsx --test scripts/tests/launchSecurity.test.ts scripts/tests/launchSecuritySql.test.ts`.
The complete single-result audit binds against the actual approved Apple
migration on synthetic prerequisites. All Apple schema/default/state/unique/FK/
trigger checks pass; the deliberately incomplete unrelated baseline still makes
the overall fixture FAIL and dormant controls PASS. No false overall acceptance
is asserted.

Twelve new behavior checks mutate real PostgreSQL catalogs through supported
DDL, then re-run the whole read-only audit. They prove rejection of extra Auth
FKs, deferrable FK, disabled/conditional/argumented cleanup, missing Auth guard,
anonymous RPC EXECUTE, direct service-role intent SELECT, disabled provider
guard, duplicate Apple trigger, removed refresh ACK column and a changed function
body despite matching signature/ACL. Existing policy atomicity, restrictive
freeze, owner SELECT/UPDATE and Storage rollback acceptance fixtures still pass.
Source tests replay all 49 function/argument contracts and pin the exact three
approved source SHA-256 identities, rather than deriving acceptance from live
bodies. The strict targeted TypeScript check passes with existing dependencies.

The test harness initially had missing synthetic prerequisites and a nested-test
context error; those fixture issues were corrected before the final passing run.
Disposable clusters use private Unix sockets, no TCP listener or deployed DSN,
and are stopped/removed afterward. No dependencies or package files changed.

## Historical hold — original Apple custody profile withdrawn

Main reports only owner-policy hardening was applied. The original Apple custody
migration was **not applied**. Darwin found a must-fix interval outside the SQL
commit locks: Apple can issue a grant after deletion has removed Auth, leaving a
late response that the old capture path cannot retain for revocation. The earlier
SQL-only "no new blocking defect" conclusion below is superseded; it did not
prove safety across the external exchange interval.

Lagrange is revising durable in-flight accounting. Do not baseline that mutable
source or treat original hashes as accepted. The audit now has a machine-readable
`APPLE_INFLIGHT_REVIEW_PENDING` hold and an unconditional REVIEW check, preventing
overall PASS even if the obsolete original profile's other checks pass. Remove
the hold only after Darwin's **actual-diff** verdict and exact source identity
are received and the approved migration's tables/RPCs/plan/completion fences are
reviewed and encoded. No new live body hash may become an expectation by itself.

Required revision properties: reserve intent durably before exchange; let users
initiate deletion; fence success/completion/Auth removal while any earlier
exchange outcome remains unresolved; retain late valid responses for revocation;
never interpret TTL, timeout or crash alone as "no grant" or successful removal.
Unknown Auth-FK relationships remain fenced, with only individually reviewed
exact relationships allowed. Coordination messages were sent to Lagrange and
Darwin; implementation and actual-diff verdict remain pending.

Darwin subsequently endorsed the **design for implementation only**, explicitly
withholding migration/actual-diff approval. Conditions include an exact one-use
reservation (duplicates cannot re-exchange or close it), durable ambiguous
outcomes, and service-only exceptional `capture_outcome_unknown` recovery that
does not claim legacy absence or verified revocation. Lagrange acknowledged the
hold and will provide revised source/tests and exact hashes after review. Those
design messages are not approval to refresh the current catalog manifest.

### Independent review of the 376-line intent candidate — not approved

Reviewed migration SHA-256
`d82ec133054c0e4230606b1cfde94d1ffcb38fe1d45134147a80dd7b56e82ba0`.
This identifies a **rejected/intermediate review snapshot**, not a new accepted
manifest baseline. Findings were sent directly to Lagrange and Darwin during
review, before implementation completion:

1. **Known token histories lacked per-response revocation acknowledgement.**
   store_stride_apple_grant retained all completed responses in capture_intents,
   while adopt selected only the latest grant or preserved a repaired primary
   job token. One aggregate revocation attestation then deleted grants and all
   intent Vault responses. A Vault purge test proves cleanup, not revocation of
   every distinct known credential. Lagrange accepted the countercase and reports
   Apple's supplied-token revocation contract does not establish an all-retained-
   tokens guarantee. A bounded per-token drain with durable, exact lease/request/
   intent/type/hash acknowledgements is being implemented. Aggregate provider
   success, Auth removal and completion must remain fenced until all known tokens
   are acknowledged. Mixed manually-unavailable exchanges must retain their
   truthful unknown outcome rather than becoming verified revoked.
2. **Manual recovery did not reach the actual shared worker acceptance path.**
   SQL providers_ready accepted explicitly attested manual_required /
   capture_outcome_unknown, but src/utils/deletionFulfillment.ts still accepted
   manual_required only for legacy_token_unavailable. That fails closed but
   strands the intended recovery path. Lagrange/Darwin were asked for a narrow
   provenance-preserving guard update and actual fulfillDeletion-path tests,
   never a relabel to legacy/revoked.

Source inspection found all **nine** public function signatures covered exactly
by the service-only EXECUTE revoke/grant list, all three private tables with RLS
and no API-role grants/schema access, and no TTL-to-success branch. Both reviewed
Auth-FK exceptions required one exact validated/nondeferrable owner CASCADE,
unconditional zero-argument enabled BEFORE DELETE cleanup, and the matching Auth
guard. Per-intent cleanup addresses both Auth cascade orders. These structural
positives do not approve the revocation semantics above. No database execution,
deployment, key read, or source-manifest hash refresh occurred in this review.

Main reports nonsecret native client/team identifiers were checked against the
signed binary. Private key/key ID remain unavailable and capture is not activated.
This seat did not inspect or provision any credential/configuration values.

Prepared 2026-11-02 against clean canonical source `cbf19327a342cd12ece722647b127f9179aa6615`
at `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.
The backend identity to bind independently is StrideOS `pbzgrhnxpbtlkzpreizy`,
not Bet Desk. This seat prepared the audit, this handoff, the new policy migration
and `scripts/tests/launchSecurity*.test.ts`. Main independently executed v1 and
provided the catalog and trigger-body review. This seat performed no deployment,
deployed SQL execution, network call, account creation, customer-row inspection,
secret read, deletion, or activation. Newly authorized SQL fixtures ran only in
temporary synthetic PostgreSQL clusters with private Unix sockets and no TCP
listener. No dependencies or package changes. A local cached
CLI created the new migration file; no migration was applied.

## Main's baseline readback and prepared correction

Latest main report: the exact hardening migration was applied through MCP to
`pbzgrhnxpbtlkzpreizy`, returning `success:true`. This seat has not independently
read back that application. **Do not reapply the one-shot migration**: its
preflight deliberately expects the old PUBLIC policy roles. New Storage live
behavioral acceptance remains pending execution of the prepared probe below.
Custody deployment is not established by the hardening application receipt.
Main's `docs/handoff/STORAGE_OWNER_ACCEPTANCE_20261102.json` records the entire
Storage probe completing successfully through ROLLBACK on the correct project,
with all assertions true, zero Auth users/identities created, and byte/HTTP-JWT/
DELETE tests explicitly false. This accepts those live database semantics only;
at that earlier receipt it was separate from the then-unapplied Apple flow.
The newer applied/readback receipt at the top supersedes that deployment status. The main-owned receipt was
read and not edited by this seat.

Historical v1 capture: `docs/handoff/LAUNCH_SECURITY_CATALOG_20261102.json`
(main-owned; not edited here). Main reported **catalog 915 PASS / 15 FAIL /
2 REVIEW; dormant controls 3 PASS**. These counts are not v3 acceptance.

- Six role-scope failures were policies `TO PUBLIC`, with full auth.uid owner
  predicates. This is no evidence of anonymous row exposure. The prepared
  migration narrows only the roles of `own profile`, `own videos`, `own requests`,
  and Storage `own video files read`, `own video files upload`,
  `own video files delete` to authenticated, preserving existing predicates.
- Storage UPDATE coverage was genuinely missing for the upload helper's upsert
  behavior. Add `own video files update` with the same movement-bucket/first-owner-
  folder scope on both USING and WITH CHECK. The restrictive deletion freeze
  still ANDs with this permissive policy, including for UPDATE.
- Eight service-role CRUD failures were an **audit requirement error**, not
  missing required grants. No `.from('movement_videos'|'analysis_requests')`
  consumer exists in src/app/backend source. Definer inventory and Auth cascades
  do not require service-role CRUD. V2 requires denial of all direct service-role
  table/column privileges on those legacy tables. Do not grant unused CRUD.
- Main reviewed both actual trigger bodies; approved hashes and rationale below
  resolve the two REVIEWs. Later body, mode, path, or RPC-signature drift FAILS.

Prepared migration: `supabase/migrations/20261102083331_launch_owner_policy_hardening.sql`.
Its single DO statement is atomic. It locks the four affected relations against
concurrent DDL, checks all six complete saved policy expressions, commands,
permissiveness and exact PUBLIC role lists before any policy change, refuses an
already-present applicable UPDATE policy, then applies six role-only ALTERs and
one CREATE. It checks the restrictive freeze's catalog snapshot is unchanged.
Any mismatch raises and rolls back the statement. It touches no rows, function
bodies, grants, bucket flags or deletion controls. Main must review/apply this
exact migration; this file is not evidence of application. The Apple grant
handoff now reports source readiness, and main authorized incorporating it into
the expected manifest. V3 expects both migrations, so run it for acceptance only
after main has separately reviewed/applied both. Do not use blanket migration
up/db push to apply unrelated pending migrations.

## Prepared live Storage owner probe — main execution only

`scripts/probes/storage-owner-rollback.sql` is new and **has not been run against
the deployed project by this seat**. Main has now executed it successfully, as
recorded above; the following are its preserved execution instructions. Execute its entire
batch once via execute_sql. It has BEGIN, bounded statement/lock/idle timeouts,
request-local role/JWT changes, one DO assertion block, one final JSON SELECT,
then ROLLBACK. No COMMIT or DDL. The connector returns the last SELECT; there is
only one data-bearing result. Require successful completion of the full batch,
including ROLLBACK. On an error discard/roll back the transaction; never salvage
fixtures by saving them. Do not split the batch across unbound tool connections.

All fixture IDs are generated inside the DO and are not returned. No existing
customer ID is supplied. The probe creates no Auth users, identities or sessions
and uses no email: JWT + first-folder RLS does not require a real Auth identity,
and the deletion request's old Auth FK has already been removed. Object rows omit
nullable owner/owner_id metadata. If deployed schema requirements differ, abort
and review rather than substituting a real owner. This tests database role/claim
semantics, not HTTP JWT signature verification or the Auth API.

Fixture writes are only three generated Storage object rows, a temporary private
bucket configuration (needed to make the cross-bucket target a valid FK), and
one deletion-request marker for the generated subject. Storage's own metadata
triggers may maintain derived prefix metadata in the same rolled-back transaction.
Every object read/write is scoped to generated IDs. No file bytes, original user
media, secrets, tokens, deletion RPCs, lease claims, control flags, cron, HTTP or
worker execution are involved. Objects/freeze marker/bucket and all LOCAL claims
disappear on ROLLBACK; normal source triggers are not disabled or replaced.

The probe asserts owner SELECT/UPDATE/readback/INSERT; denied foreign-owner read
and update in both subject directions; cross-prefix and cross-bucket UPDATE
WITH CHECK rejection; genuine no-subject anon SELECT/UPDATE/INSERT denial; and
frozen-owner SELECT/UPDATE/INSERT denial. It requires table-level grants so a
name/bucket column-permission error cannot masquerade as a CHECK test. A final
privileged generated-ID read verifies denied operations changed nothing. It does
not invoke DELETE or any file API; receipt fields explicitly mark delete, byte
access and HTTP JWT verification untested.

Expected result: `receipt.probe=storage_owner_rollback`, allAssertionsPassed=true,
the owner/foreign/move/anon/freeze assertions true, syntheticObjectRows=3,
authUsersCreated=0, authIdentitiesCreated=0, rollbackOnly=true and
requiresFinalRollbackSuccess=true. A JSON receipt alone is not independent proof
that the final ROLLBACK was accepted; main's capture additionally states full-
batch execute_sql completion without error, including ROLLBACK.

The exact script passed in the disposable PostgreSQL source fixture. After it
finished, zero object/freeze rows remained, only the pre-existing bucket remained,
and the original operator role was restored. Dropping UPDATE coverage made the
same script fail at Owner UPDATE; explicit rollback also removed that failed
run's fixtures. This validates preparation, not live Supabase acceptance.

## Independent Apple SQL semantics review

**Historical review of the original, unapplied source — withdrawn as launch
acceptance following Darwin's in-flight finding.** The points below describe
local SQL properties only and do not settle external issuance/custody races.

This seat read the custody migration and the original deletion contracts, in
addition to verifying fingerprints. No new blocking SQL logic defect was found
in the current intended service-only flow:

- Owner/subject checks, token payload validation and an Auth-user row lock precede
  custody commit. The deletion-insert trigger takes that same owner lock; the
  completed exchange does not hold a database lock while contacting Apple.
- New Vault secret creation, grant replacement, capture receipt and old-secret
  retirement share the transaction. A failed statement cannot acknowledge the
  replacement while leaving old custody partly changed.
- Leased adoption checks the request/owner and existing disposition. A job's
  existing refresh/explicit repair takes precedence over older retained custody;
  stale/invalid leases do not gain access through the new wrapper.
- Original bodies are retained under private names with client/service direct
  access revoked; public wrappers remain service-only. Purge triggers cover
  confirmed revocation, completion and the grant's Auth cascade.

The captured-code retry intentionally means "this owner/code succeeded and a
custody row/Vault entry for this subject/client remains": after replacement, an
old code-hash receipt may acknowledge the newer retained grant. This is not a
claim that Apple still accepts that token. It does not restore the old
token. This behavior is explicit in the custody tests. Service-role RPC callers
remain trusted to supply the server-verified client/subject; SQL is not itself
an Apple JWT verifier. Runtime Auth/Apple verification, Vault encryption and
actual provider revocation remain main's separate acceptance. The plan wrapper
exempts only the reviewed grant table by name; v3 independently rejects schema
drift such as an extra Auth FK on that same table, so future schema changes must
not bypass the catalog gate.

## Historical v3 custody source extension — withdrawn

The original `20261102081943_apple_grant_custody.sql` was previously part
of v3's **expected post-migration** state. This profile is withdrawn; the
current v4 identities and contracts are at the top of this document. This is not a claim it was deployed.
Its handoff reports 74 focused tests; this seat independently replayed its
function contracts from source and added catalog gates. No live body hash was
used to accept the new code.

| Reviewed source extension | SHA-256 |
| --- | --- |
| 20261102081943_apple_grant_custody.sql | 0201b9516283758f8dbd96bf835e3b363d73eeea888fb190696e9e89ae68a2e0 |
| 20261102083331_launch_owner_policy_hardening.sql | 5082af90a0de256fecdd67e062fabd444e78fde9d0ec82ea456bb0b29b039c96 |

The JSON's source_head remains the unchanged base `cbf1932`; source_migrations
records these two reviewed extensions and acceptance_revision distinguishes v3.
Any extension file change fails the source-integrity tests until reviewed and
explicitly rebaselined. Missing deployed objects or old wrapper bodies FAIL v3.

Custody adds two private deny-all tables, two service-only public RPCs, private
owner-check/adoption/purge functions, and four trigger bindings. Three old public
bodies move into the private schema with new names before wrappers replace them:
read_stride_deletion_provider_tokens, read_stride_deletion_owned_status and
stride_deletion_plan. Their private copies retain the exact source hashes and
lose direct API-role EXECUTE. The new wrappers are fingerprinted separately.

**start_stride_deletion itself is unchanged** in this migration: its source body
still hashes to 690c1a331fe6c8115e850d6c5fb9da2b. The deletion-start change is the
new BEFORE INSERT owner-lock trigger on stride_account_deletion_requests, not an
invented replacement RPC body. V3 checks that exact trigger/function binding.
It also checks Vault purge before grant deletion, purge after confirmed
revocation, and purge on completion, including trigger timing/event/column scope.

The only new Auth-FK exception is validated grants.owner_id -> auth.users.id
ON DELETE CASCADE. An additional Auth FK even on that same table FAILS; there is
no private-schema exemption. Exact columns, grant/capture primary keys, cascade
to captures, unique Vault reference, private RLS/no policies/grants/schema access,
and the purge-trigger binding are independently required. No grant, receipt,
capture, Vault, or customer values are read by the deployed audit.

## Deliverable and execution boundary

The new `.sql` file follows the repository's SQL-probe convention, at the
requested `scripts/auditLaunchSecurity.sql` path. Unlike the existing
`scripts/sql/*probe.sql` files, it creates no fixtures and invokes no app RPCs.
Do not use the older probes as deployed readback substitutes: those insert Auth
fixtures, and the automation probe requires disposable mocked HTTP/cron.

The main task owns execution and connection identity. The new script begins a
repeatable-read, READ ONLY transaction, uses local statement/lock timeouts, and
ends with ROLLBACK. **Exactly one SELECT returns one row containing one JSON
object**, with `phases.catalog` and `phases.dormant_control`. This accommodates
the main task's MCP probe showing only the last SELECT result is returned.
No result-set concatenation is required. It creates no temporary objects,
changes no roles/JWT claims, calls no application functions, and performs no
HTTP, scheduler, Storage API, Auth API, or provider action. Catalog introspection
uses PostgreSQL built-ins, not the privileged deletion inventory/dispatcher.

Only these non-catalog relations are read:

- `stride_deletion_private.control`: aggregate row count and booleans derived
  from singleton/enabled/empty owner scope/fixed worker target. No owner UUIDs
  or `gateway_apikey` are selected.
- `storage.buckets`: only the `movement-videos` configuration's count/privacy.
- `cron.job`: aggregate counts for the named deletion job or commands mentioning
  the dispatcher/worker. Commands are inspected by predicates, never emitted.

There are no queries of `auth.users`, `auth.identities`, app history, receipt
rows, request state, token/ticket rows, `storage.objects` contents, or Vault
contents. References to these relations in catalog OID lookups do not read their
rows. Vault table/view **privileges** are inspected, not secrets.

Use an existing privileged operator readback session capable of seeing catalogs
and the three configuration relations. Do not grant access to make this audit
pass. A missing object, permission error, timeout, or aborted transaction is a
failed/incomplete audit, even if an earlier result was printed. psql example for
the main task only, after independently binding the correct existing connection:

```sh
psql "$STRIDEOS_AUDIT_DATABASE_URL" -X -qAt --set=ON_ERROR_STOP=1 \
  --file=/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local/scripts/auditLaunchSecurity.sql \
  > /tmp/strideos-launch-security-20261102.jsonl
```

The script intentionally does not read a connection URL, key, environment file,
or credentials itself. The sample variable is not populated by this task.

## Machine acceptance contract

Every check has `check_id`, `target`, `status`, and `observed`, inside its phase.
Control checks use `target=configuration`. Statuses are PASS, FAIL, REVIEW.
FAIL means an explicit acceptance invariant is violated. REVIEW means unverified
or unfamiliar metadata, not an automatic security defect and not acceptance.
The catalog rollup is FAIL if any FAIL exists, otherwise REVIEW if any REVIEW
exists, otherwise PASS. An absent result is never PASS.

The machine gate requires a successful SQL process **and exactly one** JSON
document, with both required phases, matching audit/source/project-profile IDs,
PASS rollups and all individual checks PASS. For example, using an already available jq (not added as
a project dependency):

```sh
jq -s -e '
  length == 1 and
  all(.[];
    .audit == "strideos-launch-security-v5" and .source_head == "cbf1932" and
    .acceptance_revision == "20261102-legacy-maintenance-5" and
    .maintain_supported == true and .server_version_num >= 170000 and
    (has("acceptance_hold") | not) and
    .source_migrations["20261102081943_apple_grant_custody.sql"] == "747d3e324a7856eb113f372c37f3469d359d8a6a6dc02a802c64a27372cbc1b3" and
    .source_migrations["20261102100131_launch_legacy_maintenance_privileges.sql"] == "a55122b148001bd2ed463de8e5c8f6cb3c85abea69b8431886ffce9cc73b915b" and
    .expected_project_ref == "pbzgrhnxpbtlkzpreizy" and .status == "PASS" and
    (.phases | keys) == ["catalog", "dormant_control"] and
    all(.phases[]; .status == "PASS" and (.checks | length > 0) and
      all(.checks[]; .status == "PASS")))
' /tmp/strideos-launch-security-20261102.jsonl
```

Run that gate only if psql itself exited zero; do not ignore errors or use an
old/partial output file. JSON schema changes or reviewed source changes require
an explicit audit revision. The script's source identity does not prove the
connection's project identity; main must record that independently.

### Explicit invariants

| Checks | PASS requirement / failure rule |
| --- | --- |
| `role` | anon/authenticated/service_role exist; anon/authenticated are neither superusers nor BYPASSRLS. |
| `table_rls` | All 28 named application/private/archive/Storage relations exist as tables or partitions and are not owned by anon/authenticated. RLS is required on the 19 active/private/manifest/Storage relations. Nine archived Bet Desk tables may retain either original RLS state: their boundary is denied API-role schema access and table/column grants, with service SELECT-only. FORCE RLS is not required: trusted backend/owner bypass is intentional. |
| `table_acl`, `public_table_column_acl` | Effective privileges include inherited and column grants; PostgreSQL 17+ MAINTAIN is checked alongside the seven older table privileges. Core six client tables require authenticated table-level CRUD and prohibit maintenance/grant options; anon has no access. Legacy movement/request tables allow authenticated CRUD without requiring unused operations, and deny all direct service-role privileges. Storage requires authenticated CRUD and denies client maintenance/grant options; anon table CRUD may exist but no anonymous permissive Storage policy may exist. Private tables deny even service_role direct access. PUBLIC relation/column grants are rejected. Service operators require CRUD on the other active tables; all nine archived tables plus manifest are SELECT-only. |
| `receipt_shape`, `receipt_column_acl`, `receipt_hash_unique` | Nine expected receipt columns exist. Authenticated may SELECT only id/user_id/requested_at/status/completed_at; no hidden-column read or client write/reference/grant option. A valid one-key unique receipt-hash index is required, either unconditional or restricted exactly to nonnull hashes. No receipt value is read. |
| `owner_policy`, `owner_policy_coverage` | Each granted operation has an applicable authenticated permissive policy. Every applicable permissive policy must be a recognized exact owner equality. UPDATE/ALL enforce ownership in USING and effective CHECK (PostgreSQL's USING fallback is allowed). Anonymous permissive policies FAIL. Unknown forms REVIEW, including equivalent but unrecognized predicates. Extra restrictive policies REVIEW because they may block intended access. |
| `deletion_freeze` | Each of eight owner tables and Storage has the named restrictive ALL/authenticated policy. USING and CHECK must match the complete recognized pending-request denial; Storage additionally exempts other buckets. Missing named policy FAILS; different shape/roles REVIEW. The script does not execute the pending-account predicate against users. |
| `private_rls_no_policies`, `operational_client_policy` | The four deletion-private and three Apple-private tables intentionally have **zero policies**, RLS on, and no direct API-role grants/schema access. Public usage/archive tables must have no anon/authenticated permissive policy. A service-only usage/manifest policy is legitimate. |
| `schema_acl`, `required_schema_usage`, `vault_client_acl` | Clients cannot CREATE in public; clients cannot USE/CREATE in deletion-private/Apple-private/archive. service_role also cannot directly USE/CREATE in either private schema. Intended public/Storage/archive operators have USAGE. API roles have no table/column SELECT on either Vault relation. |
| `function_contract`, `function_rpc_arguments` | 47 migration-backed bodies plus two explicitly main-reviewed trigger bodies exactly match fingerprints, SECURITY DEFINER/invoker mode and SQL/PLpgSQL language. Migration-backed functions pin empty search_path; both accepted legacy triggers pin pg_catalog. None is owned by an API role. RPC argument names, return types and default counts match, including trigger/event_trigger results. Missing/drifted contracts FAIL. Unknown functions still REVIEW. |
| `function_execute`, `function_public_execute` | No PUBLIC EXECUTE, including PostgreSQL's implicit function defaults. Public operational RPCs are service-only. Goal-archive merge is authenticated/invoker (service execution is permitted, not required). Private helpers are not directly executable by any of the three API roles. Effective inherited EXECUTE and grant options are checked. |
| `configure_defaults`, `signup_trigger_search_path`, `signup_trigger` | Configure defaults are NULL gateway + **empty**, not NULL/global, owner list. Signup function keeps pg_catalog path and exactly one enabled AFTER INSERT/row trigger on Auth; its reviewed body is now pinned. |
| `unexpected_function`, `extension_definer_api`, `uninventoried_relation`, `legacy_archive_location` | Unexpected non-extension public/private/archive functions and relations REVIEW. Each of nine expected Bet Desk tables must exist in betdesk_archive_20261031, with no same-named public duplicate. Public extension-owned definers executable by clients also REVIEW. They are not silently accepted. Extension-owned invokers/relations and other platform schemas are outside this application's complete-object baseline. |
| `shared_auth_foreign_key`, `owner_auth_cascade` | Any auth.users FK outside eight supported owner tables (excluding platform auth/storage) and the two exact, guarded Apple owner CASCADE exceptions FAILS; this includes a receipt FK that would erase recovery state. Each supported owner key must have the expected single-column CASCADE FK to auth.users.id. Catalogs only, no user counts. |
| `apple_private_column`, `apple_private_column_inventory`, `apple_cascade`, `apple_primary_key`, `apple_vault_reference_unique`, `apple_trigger`, `apple_trigger_inventory`, `apple_auth_fence`, `apple_intent_unique`, `apple_intent_default`, `apple_intent_state_constraint` | Exact eight grant/two capture/thirteen intent columns, types/nullability, defaults, four durable states, owner/code and owner/generation uniqueness, owner cascades and primary keys; unconditional unique Vault references on grants/intents; exactly eight enabled zero-argument unconditional bindings with reviewed timing/event/update column. Auth exceptions additionally require exactly one reviewed nondeferrable validated FK and exact cleanup/Auth guards. Missing/mismatched structure FAILS independently of source-body checks. |
| `dormant_control` | Exactly one control row, singleton true, disabled, nonnull empty owner list, fixed StrideOS worker URL. NULL owner scope means global activation and FAILS this dormant profile. No key is read or validated. |
| `private_movement_bucket`, `dormant_scheduler` | Exactly one movement bucket, private. No active named or dispatcher/worker-referencing cron job. An inactive matching job may remain. Missing prerequisites FAIL or abort; nothing is installed/unscheduled. |

## Accepted trigger review and remaining source gaps

The checked-in migrations do not recreate the original owner/Storage policies,
base app tables, `handle_new_user` body, or `rls_auto_enable` body. Main supplied
explicit review of the deployed bodies after the v1 run, not just hash readback:

| Trigger | Accepted body MD5 | Main's review rationale |
| --- | --- | --- |
| public.handle_new_user() | fc0e692c32cd0f78ccc2f2a239cea040 | Simply INSERT public.profiles(id,email) VALUES(new.id,new.email), return new. Schema-qualified write, pg_catalog lookup path, no client-controlled dynamic function lookup. |
| public.rls_auto_enable() | 99be20677b456ea8d3be47bdd44fb369 | Iterates builtin pg_event_trigger_ddl_commands(), filters public tables only, uses EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity). Server-generated quoted object identity, pg_catalog lookup path, no function-lookup shadowing. |

Both are SECURITY DEFINER PL/pgSQL, zero arguments/defaults, results trigger and
event_trigger respectively; direct API-role EXECUTE remains denied except for
the intended service role. V2 pins all these properties. The exact bytes were
reviewed/read by main; this seat verified the recorded hashes against main's
catalog and encoded the accepted contract. Do not replace hashes with a new
readback merely to obtain PASS. Any future change requires substantive review.

Owner and Storage policy comparison uses a deliberately narrow grammar, not
substring matching. Accepted owner predicates are column = auth.uid() (either
order, optionally qualified/scalar subquery); accepted Storage predicates combine
the movement bucket with first-folder = auth.uid()::text. The normalizer removes
formatting parentheses and the generated scalar uid alias; it does not discard
additional logical tokens. Since the accepted expressions contain no mixed
AND/OR, an unexpected OR cannot be hidden by removing parentheses. More complex
safe policies (extra owner_id checks, alternate UUID casts, reversed bucket
conjunctions) REVIEW. Policy operation/role/permissiveness checks are separate.
Unknown expressions cannot be converted to PASS through a lexical "contains uid"
test. Full permissive-policy inventories matter because applicable permissive
policies combine with OR; one valid policy never excuses another broad policy.

### Potential source defects requiring deployed readback

1. **Incomplete legacy ACL hardening, deployment-dependent exposure risk.**
   `20261031153222_grant_strideos_owner_access.sql:3-12` revokes the six core
   tables from anon/authenticated, but not PUBLIC or pre-existing column grants.
   For movement_videos/analysis_requests it removes only maintenance privileges.
   These statements do not establish absence of earlier anonymous/PUBLIC reads,
   column grants, or broad permissive policies. The new audit detects these
   effective grants and refuses unrecognized policies. This is a hardening gap,
   not proof that any deployed customer row is exposed. Main's v1 readback
   passed the effective table/column-grant checks apart from the erroneous legacy
   service expectation; the prepared fix narrows policy roles rather than adding
   grants. Main has now applied the reviewed maintenance follow-up and supplied full v5
   PASS readback; see the current receipt above.
2. **Uncaptured trigger hardening contract.**
   `20261031151916_harden_trigger_privileges.sql:3-7` pins handle_new_user's
   search_path and revokes direct client execution of both trigger functions,
   but does not pin rls_auto_enable's search_path or include either body. Whether
   the event-trigger body has an exploitable lookup path cannot be concluded
   from the old migrations alone. Main's subsequent explicit deployed-body
   review found the pinned pg_catalog path and safe operations; accepted above.
3. **Dormant automation is not a universal operator kill switch.**
   The automation migration intentionally preserves fulfillment_version=0 manual
   operator claim/renew/complete semantics. Disabled control blocks automatic v1
   processing, not every service-role deletion capability. Service-only EXECUTE
   and unexposed private state are therefore required even when disabled.

### Security Advisor: intentional deny-all versus a defect

RLS-with-no-policy on `stride_deletion_private.control`, `request_state`,
`job_tickets`, `provider_tokens`, and Apple-private `grants`/`captures` is expected and gets PASS only together with
the independent RLS/grant/schema gates. These tables are accessed by reviewed
owner-executed helpers; neither clients nor service_role need direct table
access. Do **not** add an authenticated/service allow-all policy to clear an
advisor message. "No policies" on a client history table is instead a coverage
failure when its client operation is expected. RLS disabled, broad permissive
policies, accessible secrets, client maintenance privileges, PUBLIC privileged
EXECUTE, unsafe definer lookup paths, or unidentified public views/functions are
not explained away by the intentional private-table pattern.

## Source provenance and remaining acceptance

The checkout was clean at task start. Concurrent main-task auth/deletion edits
and `20261102081943_apple_grant_custody.sql` subsequently appeared on the shared
tree. Their files were not edited by this seat. After its source-ready handoff,
main explicitly authorized the Apple migration's v3 manifest extension. Base
replay uses `git show cbf1932:<migration>`; only the two named whole-file-pinned
extensions use reviewed working-tree source. Unexpected objects yield REVIEW,
changed body contracts FAIL, and no live hash is automatically adopted. The two
legacy trigger exceptions remain main-reviewed, not migration-derived.

The nine expected archive names come directly from the isolation migration:
betdesk_bets, betdesk_closing_lines, betdesk_clv_observations, betdesk_daily_picks,
betdesk_game_results, betdesk_model_snapshots, betdesk_profiles,
betdesk_sheet_export_events and betdesk_user_settings. All are inspected via
catalogs only, not by reading even the archive manifest's stored row counts.
This is the StrideOS database's isolated legacy archive, not Bet Desk production.

Reviewed all ten migrations, the three existing probes, deletionRuntime.ts,
deletionHandlers.ts and worker/account/status entry points, plus deletion
fulfillment contracts. Account endpoints authenticate the caller and derive the
owner; status uses a private receipt capability; the worker consumes a request-
bound ticket before scheduling work. The audit never calls those boundaries.

Fingerprints are MD5 of the exact UTF-8 function body **between** `$$` delimiters,
including whitespace/comments; they detect drift, not cryptographic authenticity.
Apply CREATE/REPLACE bodies in filename order. At the automation migration's
rename, carry the then-current stride_deletion_plan body into
stride_deletion_inventory_v0 before replacing stride_deletion_plan. Replay the
Apple migration's ALTER SET SCHEMA and RENAME events in source order too. There
are 47 migration-backed functions and two main-reviewed trigger contracts. Compare argument names,
types/results/default counts as well; parameter names are part of PostgREST RPC
contracts. Do not regenerate expectations from live database bodies.

Validation now includes real disposable PostgreSQL fixtures, not more policy-
format assertions. The cached local engine uses private Unix sockets with TCP
disabled; fixtures are synthetic and removed afterward. Eight drift cases span
all six saved policies plus changed command/permissiveness. Missing freeze,
pre-existing UPDATE, and a forced late CREATE POLICY failure each leave the
complete before/after policy snapshot identical. The late failure occurs after
role ALTERs, proving statement rollback rather than only early rejection.

The success fixture proves authenticated role scope, SELECT-dependent UPDATE,
same-owner write, foreign-owner/bucket denial, both new-row CHECK protections,
anonymous denial, and frozen-account SELECT/INSERT/UPDATE/DELETE denial. Another
fixture executes the complete combined audit: it binds, returns one JSON, reports
its deliberately incomplete source schema as FAIL, keeps dormant checks PASS,
accepts private RLS/no-policy boundaries, and rejects an extra Auth FK on the
otherwise-approved Apple grants table. This does not validate deployed Supabase
behavior, Storage bytes, provider credentials or Vault encryption.

Source tests separately replay all 47 migration contracts plus two reviewed
trigger contracts and verify both whole-file migration hashes. Main's historical
metadata capture was read and not edited. No current online Expo/Supabase docs,
advisors or backend APIs were queried; this work changes no Expo code.

Historical pre-intent-revision focused run: **19/19 passed, zero failures/skips** using
`node_modules/.bin/tsx --test scripts/tests/launchSecurity.test.ts scripts/tests/launchSecuritySql.test.ts`.
Strict targeted TypeScript compilation of both test files passed with the
existing local compiler and Node types (`--noEmit --ignoreConfig --module esnext
--moduleResolution bundler --target ES2022 --types node --esModuleInterop
--skipLibCheck --strict`). Changed-file whitespace checks passed. Temporary
PostgreSQL clusters were stopped and removed. No app-wide TypeScript, backend
deployment, or new deployed-catalog PASS is claimed by this seat.

Main still owns: actual target-project binding, SQL/catalog compatibility and
readback, resolution of REVIEW/drift, deployed Edge Function code/config/JWT
settings, exposed Data API schemas, secrets *presence* verification without
printing values, server/network configuration, and any separately authorized
synthetic behavioral acceptance. Catalog PASS cannot prove owner isolation or
freeze behavior with live JWTs, receipt/ticket replay resistance, provider
revocation, session invalidation, Storage byte access or deletion completion.
No new synthetic fixtures are included: the existing behavioral probes need
disposable infrastructure and are unsuitable for this deployed read-only pass.
Even complete audit PASS is not public-launch, billing, or deletion activation
approval. Preserve all current controls until separately authorized.
