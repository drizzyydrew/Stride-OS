# November 2 launch continuation

This checkpoint is for the canonical Developer checkout on `build-19-v3-foundation`.
Implementation source is committed and pushed as
`7b5877e000dcef5d491ef0b29e47f24796d934ba`. The final source/test/export receipt is
`LAUNCH_SOURCE_VERIFICATION_20261102.json`; subsequent receipt-only edits do not
change that implementation.
Build 108 remains the previously inspected internal TestFlight binary. Source edits
in this continuation have not become a new binary or public release. Payments and
general deletion automation remain off; the owner's physical testing deferral is
preserved. Existing financial, medical-declaration, review-login and current
billing-off App Privacy receipts do not need repeating without changed evidence.

## Verified deployed changes

- Closed NEW public registrations with the single declared Auth setting
  `auth.enable_signup=false`. The reviewed CLI diff contained exactly that one
  change; its update receipt listed only Auth/enable_signup. All existing users
  and data were retained. Fresh public Auth settings reported signup disabled;
  the same dedicated reviewer login and both authenticated GETs still succeeded.
  This is a reversible beta safety guard, not production email readiness or
  retroactive verification of existing email identities. See
  `AUTH_IDENTITY_LINKING_REVIEW_20261102.md`. Reopening requires verified delivery
  and an appropriate confirmation/identity-ownership policy.
- Applied only `launch_owner_policy_hardening` to StrideOS
  `pbzgrhnxpbtlkzpreizy`. Six existing policies now apply to authenticated users;
  their owner predicates remain unchanged. Added the missing owner-scoped Storage
  UPDATE policy with both old-row USING and new-row CHECK protections. The
  restrictive deletion freeze was preserved. No Bet Desk project was changed.
- The live, all-rollback Storage probe passed owner SELECT/INSERT/UPDATE,
  foreign-owner denial, cross-prefix/cross-bucket UPDATE rejection, anonymous
  denial, and deletion-freeze checks. Only generated metadata fixtures existed
  inside the rolled-back transaction. It created no Auth users, identities,
  sessions, real file bytes, emails or network actions. It does not prove Storage
  byte access through the HTTP API. See `STORAGE_OWNER_ACCEPTANCE_20261102.json`.
- Published only `docs/privacy.html` to the existing free Pages branch at
  `d7017479ca09a44072519da51e3d440c0faa4faf`, preserving unrelated files. HTTP 200
  uncached readback matched source exactly, SHA-256
  `b49764e615c7d58120ca318159c14016eca833a660aff2b3d2a74b2cc0985b55`.
  The new paragraph conditionally discloses encrypted Apple sign-in token custody,
  replacement and revocation/deletion cleanup. URLs and hosting costs did not change.

  Final wording was clarified for retained older responses and unknown interrupted
  exchanges in privacy-only Pages commit
  `073389fdf55207fb37f8d3656a0761f6edac220d`. Its uncached HTTP 200 readback matched
  source exactly, SHA-256
  `81a4f67188209344439725a30e0fe4da92bd0ee28d37e1aa9bad4bf57092710c`.
- Verified the signed 108 archive's native bundle identifier, team and Apple
  sign-in entitlement. Saved `STRIDEOS_APPLE_CLIENT_ID` and
  `STRIDEOS_APPLE_TEAM_ID` to the isolated server and verified their names in a
  fresh inventory. Key ID, private key and static-secret fallback remain absent.
  No key values were read; this does not enable successful Apple exchange.

## Further evidence and current limits

- The dedicated Apple review login authenticated against the isolated backend.
  Its ES256 access token also passed authenticated GETs to account-deletion and
  AI Coach (both HTTP 200). No AI POST, deletion POST or purchase was made.
  Deletion capabilities reported automatic processing false and Apple exchange
  false. These checks did not expose credentials or request training data.
- Public Auth settings reported email/Apple/Google enabled, signups enabled,
  phone disabled and email autoconfirm true. This is not evidence of delivery to
  ordinary users. Custom SMTP/send-hook configuration and reset/confirmation
  delivery remain unverified; no signup or recovery email was sent by this check.
  A later CLI configuration dry run changed no remote Auth settings and did not
  provide sufficient SMTP/send-hook information to establish readiness. The
  signup restriction above supersedes the earlier enabled-signup observation.
- Fresh npm audit: 0 high, 0 critical, 15 moderate and 1 low package entries.
  Reviewed findings propagate four build-tool advisories, with no demonstrated
  customer runtime path in the inspected source. Preserve the compatible SDK 57
  graph rather than force a framework change. See `DEPENDENCY_AUDIT_20261102.md`;
  residual tooling exposure and final-bundle reachability limits are explicit.
- Chrome inventory is reachable, but binding the observed StrideOS Auth tab
  returned **Debugger unattached**. No private provider/email settings were changed.
  Native app control previously timed out. Official serve-sim requires Apple
  Silicon; this Mac is Intel. EAS cloud simulator availability returned false.
  No paid workaround or new cloud build was started. The task's simulator was
  shut down; existing containers/captures/assets were preserved.
  Later, a fresh Chrome task tab restored control. Apple Developer confirmed
  StrideOS is already its own primary Sign in with Apple identifier. The existing
  Bet Desk key was preserved. A StrideOS-only key draft is prepared at Register,
  not submitted. The owner was asked to Register/Download it privately; no reply
  or new key is assumed. The handoff tab and screenshot are retained.
  The actual SMTP screen then showed custom SMTP **off**, and Auth Hooks showed
  no configured hooks. Production sender setup is missing, beyond the still-open
  end-to-end delivery/recovery check. Neither page was edited. No mail provider,
  domain or paid plan was connected.

## Source and backend verification

Membership refresh, same-owner UI fencing, accurate post-purchase verification
messages, and truthful email-request copy are implemented. New Apple sign-in
uses independent nonce/state, an in-memory Supabase exchange, server custody
acknowledgement before persistent session commit, and bounded cleanup that can
recognize a refreshed session without matching only its owner. Retained-grant
deletion skips only the initial Apple prompt; explicit repair remains available.

Independent review required a further backend revision: deletion must account
for token exchanges already in flight. The accepted revision registers durable
intents before exchange, denies login acknowledgement during deletion, retains
late responses for cleanup and requires individual credential acknowledgements.
Unknown outcomes do not expire into success. Exceptional stopped-capture recovery
is service-only, explicitly attested and reported as manual/unknown, never as
confirmed provider revocation. Current UI offers accurate pending messages and
the existing support link. The shared coordinator requires strict trusted-server
proof for that Apple-only manual outcome; pending is always blocked.

Darwin independently approved the actual frozen revision and coordinator.
Backend/deletion checks passed 91/91; coordinator/fulfillment checks passed 17/17.
The exact reviewed grant migration
`747d3e324a7856eb113f372c37f3469d359d8a6a6dc02a802c64a27372cbc1b3`
was applied. Its live all-rollback probe passed full-response custody,
idempotency, failed-replacement preservation, identity/lease/finalization fences,
late custody without login acknowledgement, per-credential acknowledgement
requirements and Vault cleanup including Auth cascades. It used two generated
fictional owners and fake credentials only. No Apple request or real customer
deletion occurred. See `APPLE_GRANT_ACCEPTANCE_20261102.json`.

Deployed and freshly downloaded all four functions: account-deletion v5
(gateway JWT true), status v3 (private receipt), worker v3 (private ticket),
apple-grant v1 (gateway JWT true plus independent verified-user/Apple checks).
All 33 downloaded source files matched submitted source bytes exactly. See
`EDGE_DEPLOYMENT_20261102.json`. Post-deployment authenticated/unauthorized probes
passed all seven expected responses, and existing reviewer authentication and
the signup guard still passed. A preliminary probe incorrectly expected worker
400 rather than its documented 401; only that probe expectation was corrected,
along with status-handler 404. No handler or security guard was weakened.

The full v4 catalog audit first identified unused legacy service maintenance
rights. Direct ACL review also found PostgreSQL 17 MAINTAIN leftovers for all
three API roles on the same two legacy tables. The guarded, independently
reviewed third migration revoked only maintenance rights; it changed no CRUD
grants, policies or records. Focused database tests passed 38/38. The final live
v5 audit passed **1,259 catalog checks and 3 dormant-control checks**, with zero
FAIL/REVIEW items. Automation remains off, owner scope empty and no deletion cron
active. Full metadata receipt SHA-256
`a44ab49c8e08db8028fe63282228af41f683ada3e0ab76c66cb5d1c1222abbe5`;
audit SQL SHA-256
`fdad9eeefe929074a5e2280df9a82caec5720e952d96c470dbdf48cd66a9b1e3`.
See `LAUNCH_SECURITY_ACCEPTANCE_20261102.json`. Catalog acceptance is scoped,
not a guarantee of every deployed configuration or independent security clearance.

The initial full serial run had 1,538 passes / 2 failures / 0 skips (1,540 total).
One failure was the strict root-deletion test fixture's unmapped new pure helper;
the other was the unchanged 30-second Swift compiler process timeout. The same
Swift test then passed unchanged in its five-test file (14.5-second compilation).
This initial run is retained as a failed run, not relabeled green. Final source
checks and any subsequent exact run are recorded separately.

The next full serial run passed 1,575/1,575 with zero skips in 156.7 seconds.
Semantic TypeScript, Expo compatibility and Deno checks for all four endpoints
passed. A second iOS production-environment Hermes export, explicitly billing-off
and including the final cleanup text/protocol, completed at
`/tmp/strideos-launch-source-export-final-20261102` with a 15 MB bytecode bundle.
These are source checks; they do not install or accept a new native artifact.

One later minimal synthetic AI POST returned HTTP 200 and verified a real text
response through the deployed provider path. It sent no personal training or
health data and consumed one request reservation; the existing API service was
used. No response text or credentials were saved in the receipt. The vendor
console requires sign-in, so its dollar spending cap remains unverified. The
20/account/day, 500/global/day and 1,024-output-token limits remain distinct from
a financial hard cap. See `LAUNCH_ENDPOINT_ACCEPTANCE_20261102.json`.
AI Coach v12 source was separately downloaded. Its upstream-reply binding and
request validation match current source. The repository's additional private
billing-QA policy remains deliberately undeployed, as recorded in the earlier
owner deferral; it is not falsely reported as an exact three-file source match.
Global billing remains off and no QA owner is configured. No additional AI
deployment or provider call was needed to establish this bounded receipt.

After the final maintenance/audit extension, the complete source suite passed
**1,581/1,581, zero failures/skips**, in **145.8 seconds**. No test assertion or
Swift timeout was weakened. The six additional tests cover the maintenance
correction. This is the latest regression receipt; earlier runs remain above.

## Public-launch gates

Real Apple configuration/exchange/revocation, reliable account email recovery,
new exact-artifact native acceptance, ordinary-user deletion operation, current
authentic native assets/reviewer navigation, and real StoreKit/server lifecycle
acceptance before charging remain separate requirements. No new screenshot was
fabricated or existing library asset deleted. Source tests and synthetic SQL
tests cannot close these gates. No contractor, paid plan or domain was purchased.
