# AI metering and capacity preparation — November 20, 2026

This is metering/capacity preparation and evidence, not an enforced spending control or public-launch acceptance. This lane's initial AI Coach readback was version 17 with JWT verification on; root's later AI deployments have separate receipts. The final transport guards below require the matching final deployment. No quota, price, model, provider budget, public billing policy, signup setting or database schema was changed by this lane. No real model-generation request or purchase was made.

## What is prepared

The provider wrapper preserves the current fixed Messages endpoint, safety prefix, original selected context/messages, model setting and 1,024-token output limit. It rejects provider redirects to prevent forwarding the API key, and bounds provider JSON to 65,536 bytes. Those guards change unexpected failure handling, not the normal request policy. A successful provider response emits a strict metadata whitelist: the recognized pinned model, input/output/cache counters, availability status, and an integer-nanodollar estimate at standard text-token rates before discounts. It contains no prompts, answers, owner identifiers, request identifiers, keys, arbitrary model strings, account names or raw provider errors. Missing/malformed counters, contradictory cache totals, unknown models, nonstandard tiers or unexpected billable tools make the estimate unknown rather than zero. Cache reads, five-minute writes and one-hour writes have separate rates.

Provider failures emit unknown usage without guessing whether a request was billed. A successful empty answer still records any known usage. Synchronous or asynchronous logging failure cannot discard a valid answer, delay it or cause an automatic provider retry. These are best-effort provider-response logs, not an invoice, complete durable ledger, provider hard-cap proof or measured cost forecast. A runtime killed before logging can still leave an unobserved billable request. The existing usage retention and vendor-log settings were not changed.

The new pure capacity planner takes an explicit hypothetical budget and assumptions. It changes no configuration and labels its result as a scenario rather than observed usage. Tests preserve the difference between personal allowance, shared capacity and currency budget.

## Reconciliation still required

At the previously recorded prices of $9.99/month and $79.99/year, $10,000 gross MRR needs 1,002 monthly-only subscribers or 1,501 annual-only subscribers. After recovery, an actual read-only database query reconfirmed twenty requests per account per UTC day and five hundred globally per UTC day. The reservation uses its day-level advisory lock; only service_role has EXECUTE permission, and usage RLS is enabled. Before root's permitted generation test, the last eight UTC days' aggregate returned no rows. This lane's read-only checks consumed or exhausted no production allowance; root's later single-request result is recorded below.

An illustrative 2,000-input/400-output-token request at the pinned model's standard prices is $0.004. For a thirty-day month:

| Scenario | Requests | Estimated token cost |
| --- | ---: | ---: |
| One account uses its full personal allowance | 600 | $2.40 |
| Existing shared limit is fully used | 15,000 | $60.00 |
| 1,002 accounts each use their full personal allowance | 601,200 | $2,404.80 |
| Historical $20 limit at the illustrative request size | 5,000 | $20.00 |

The shared request limit can cover twenty-five full-allowance accounts, while the illustrative $20 budget can cover only eight full-allowance accounts for that month. Different token sizes materially change those results. The examples exclude the rest of the app's costs, taxes, refunds and acquisition. No target revenue, usage pattern or margin is guaranteed. Annual payments must be normalized across twelve months for MRR.

The private metadata reference captured November 4 names the deployed-key digest and a capped organization, but its owner-run key/organization check had no completed receipt. That snapshot was not used as current proof. The actual metadata check and current Console comparison below have now established the deployed provider key's capped organization. No provider key was read from dotenv or printed. An actual provider invoice remains separate. Raising the shared quota, removing the budget cap or advertising unlimited use would not resolve capacity by itself.

## No-key-copy diagnostic alternative

A separate temporary `ai-provider-organization-probe` function was independently reviewed, used for the bounded metadata check, and removed. Gateway JWT verification stayed on. Its handler required the exact existing service-role credential, never ordinary user claims, editable metadata or a QA-owner shortcut. It made one fixed-host HTTPS metadata GET to Anthropic's organization endpoint, with redirects rejected, a ten-second timeout and a sixteen-kilobyte JSON limit. It returned only the provider HTTP status and validated organization UUID. There was no model-generation call, user-database lookup or diagnostic logging.

Root approved one temporary metadata check after the backend review approved the auth boundary. Version 1 was deployed with gateway JWT verification on and all three source files read back exactly. The official CLI could read the existing legacy service-role JWT privately and validate its project, role and expiry without printing or saving it. The first HTTP attempt stopped during Python's TLS certificate verification (`SSLCertVerificationError`, verification code 20), before an authenticated HTTP request or provider metadata call was sent. This was a local transport failure, not a provider denial or organization mismatch.

The temporary function was deleted successfully. Management function-list absence and an unauthenticated, TLS-verified curl HTTP 404 both confirmed cleanup. After root's single project restart recovered Auth/database availability, a fresh TLS-verified Auth health request returned 200 and the absent probe route returned 404. Root then authorized a bounded curl alternative with the authorization header supplied only through stdin configuration, TLS verification retained and redirects disabled.

The second deployment again had gateway JWT verification on and all three files read back exactly. Its one authenticated curl request returned HTTP 401, without provider status or organization data. Cleanup again succeeded and both management-list absence and route 404 were verified. No key was printed or saved and no model-generation call occurred. A bounded metadata-only log query found one 401, an execution identifier, version 1 and 474 ms execution time. The recorded response length was 65 bytes, while the reviewed handler's null response is 49 bytes uncompressed and exactly 65 bytes with gzip. Content encoding was not recorded. Therefore execution-ID presence and length do not establish whether the platform or handler rejected the credential. The raw response body was discarded; no missing-header, invalid-signature or built-in-key mismatch diagnosis is claimed.

Root then approved, and the backend reviewer inspected, a different strict binding: SHA-256 of the exact existing legacy service-role JWT read from the trusted Management CLI after project/role/expiry validation. That same credential was held only in process memory through hash construction and invocation. Its digest was injected only into the temporary upload bundle, starting from an invalid fail-closed placeholder. The handler hashed the presented bearer token and compared fixed-size digests without trusting client claims, query parameters or a client-supplied expected hash. Gateway JWT verification remained on; the normal public apikey header was also supplied. No new credential or scope was created.

Fresh TLS-verified Auth health was 200 and the absent probe route 404 before this corrected check. All three uploaded source files and JWT verification were read back before its one request. At **2026-11-21 00:48:51 UTC**, the function and Anthropic both returned **200** with a validated organization UUID. The UUID is retained only in the private local receipt; the public JSON records its hash. This is actual deployed-key organization metadata, not an owner-supplied assumption. Cleanup succeeded with management-list absence and route 404. No plaintext key was printed, saved, placed in argv/environment or written to source. No model-generation request occurred. No further live probe is planned.

## Current provider Console readback

The existing owner Google account signed back into the official Console without a new password, credential or additional scope. The Spending Limits page showed the individual organization with a **$20 monthly organization limit**, **$0.00 displayed spend**, reset **December 1, 2026 UTC**, and **$19.94 balance**. Default workspace had no separate limit and inherited the organization limit. No budget setting was changed, credits purchased or automatic-reload control touched.

The current Organization settings page's Organization ID was read and matched the actual deployed-key organization UUID exactly. This closes the key-to-capped-organization identity gap. The organization-wide $20 cap covers its workspaces; a workspace-specific cap can further restrict availability. Console spend is a rounded display, not an exact invoice or a deliberate burn-to-limit enforcement test. No account address was retained in these receipts. Browser control was handed back to root immediately for RevenueCat cleanup; no unrelated Bet Desk tab or account was changed.

The metadata result plus the matching current Console ID/budget readback establish the deployment's existing capped organization without asking the owner to copy a key. No additional provider-organization probe is needed or planned. A future deployment/check would require a concrete new reason, root's coordinated go and the same independent review, source/JWT readback and finally-cleanup conditions.

Final cleanup also removed `supabase/functions/ai-provider-organization-probe/index.ts` and its now-empty directory from the repository, so a deploy-all operation cannot accidentally ship the temporary endpoint. Only the safe shared handler factory and its tests remain. A fresh management function list again omitted the slug, and an unauthenticated, TLS-verified fixed-host request returned **404**. The retained helper's seven tests and Deno check passed after entrypoint removal. No credential configuration was added.

## One actual provider and metering result

Root reports one permitted normal public-path paid request on v22 returned 200, a nonempty reply and a counter change from 0 to 1. An independent metadata-only log query for **01:13:30–01:15 UTC on November 21** found one matching `coach_provider_usage` event from v22: **124 input tokens, 36 output tokens, and zero cache-read/five-minute-write/one-hour-write tokens**. Usage was available. Its standard text-token estimate was **304,000 nanodollars = $0.000304**, matching `124 × $1/MTok + 36 × $5/MTok` exactly.

This is a measured token count and a recomputed base-price estimate for one small synthetic QA request. It is not an invoice, a typical conversation average, a larger-audience forecast or a burn-to-limit test. The query retrieved no prompt, reply, owner/request identifiers or credentials. This lane made no additional model request or retry. See root's paid-server receipt for the separately verified public paid gate, temporary grant and counter results.

## Candidate controls after provider and database recovery

A later scoped change can count input tokens before a Messages request, retain necessary safety/context/latest question, and remove only older conversation history when the approved bound requires it. Anthropic's token-counting endpoint is free but its documentation describes an estimate; it is not sufficient by itself to promise an exact invoice ceiling.

An atomic, service-only currency-reservation ledger would need an explicit approved budget/configuration, inspected deployed schema, idempotent reservations, and conservative handling of failed or missing provider usage. A failed or cancelled call cannot automatically refund a reservation because the provider may have performed billable work. Such a ledger has not been added or deployed. The matched provider organization cap remains the verified existing spending guard. The personal twenty-request allowance must not silently change to fit a low budget.

## Verification and independent challenge

The metering/planner, organization probe and existing RevenueCat, actual entrypoint QA, usage, prompt and subscription regressions pass 68/68, with no failures, cancellations or skips. Deno checks the actual AI Coach entrypoint, capacity helper and probe successfully. The hash-bound organization probe's seven focused tests reject ordinary JWTs, client hashes, query-supplied expected digests, invalid deployment placeholders and malformed provider responses. No client UI, app binary, image asset or dependency changed. Machine-readable local evidence is in `LAUNCH_AI_CAPACITY_20261120.json`.

At the first pass, the backend reviewer correctly challenged a ready-to-submit claim based on telemetry alone: key/organization and current budget binding were then missing, and a five-hundred-request pool cannot serve the target cohort's full allowance. The implementation omits provider request IDs as well as owner IDs, includes cache categories, and labels incomplete billing data unknown. Public launch remains dependent on working Auth, actual paid access, deletion, reviewer/account flows and reconciled provider capacity.

After the real organization match, the Chair call is narrower: AI can be technically review-ready for bounded reviewer/testing use inside the verified existing budget, while public release stays Manual and larger-scale capacity is not claimed. Final source/JWT/paid-gate proof, active and inactive access checks and QA-setting cleanup remain root's acceptance record; the independently observed single-response token/meter proof is recorded above. The request used a fixed short public-fitness question with no personal context/history. No budget increase, purchase or new allowance is approved by this call. The retained 1,024-output-token cap is not a formal bound on input cost, and the single short response must not be extrapolated to a real-world conversation average.

The scope distinction is deliberate: review-ready for a bounded account inside the current cap does not establish that StrideOS can serve 1,002 full-allowance subscribers. It also cannot waive missing Apple materials, deletion acceptance or any other non-AI submission requirement.

Current primary documentation checked:

- [Haiku 4.5 model and standard/cache prices](https://platform.claude.com/docs/en/models/haiku-4-5/overview)
- [Usage and Cost Analytics API](https://platform.claude.com/docs/en/manage-claude/usage-cost-analytics-api)
- [Current organization associated with an API key](https://platform.claude.com/docs/en/api/http/beta/organization/retrieve)
- [Organization and workspace rate/spend limits](https://platform.claude.com/docs/en/api/rate-limits)
- [Token counting, pricing and estimate boundary](https://platform.claude.com/docs/en/build-with-claude/token-counting)
