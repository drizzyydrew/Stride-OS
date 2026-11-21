# Backend recovery and reviewer acceptance — November 20, 2026 Pacific

This is the initial recovery snapshot; subsequent signup/deletion acceptance and the observed intermittent PostgREST failure are recorded in [LAUNCH_20261120_SIGNUP_DELETION_ACCEPTANCE.md](LAUNCH_20261120_SIGNUP_DELETION_ACCEPTANCE.md).

The project-specific Auth/database outage was recovered through one official **Restart** of the existing StrideOS project. This closes the previously observed timeout as an immediate availability blocker and verifies the existing restricted reviewer credentials. It does not complete public-launch acceptance.

## Before recovery

Management metadata said ACTIVE_HEALTHY and the health advisor returned no lints, while actual Auth health/settings returned HTTP 522 and one bounded SQL request timed out. Last-24-hour service logs recorded 108 token requests returning 522, eight authorize failures, Realtime migration connection-queue timeouts, and 87 Storage migration failures. A fixed-host, TLS-verified metrics request using an existing project secret also returned 522. These establish a project runtime/database dependency outage. They do not establish out-of-memory, full disk or connection exhaustion as the exact cause.

## Recovery actually performed

Root clicked the official Restart confirmation once at **2026-11-21 00:27:40.826 UTC**, after verifying stride-os and project ref pbzgrhnxpbtlkzpreizy. Provider UI and management metadata both entered RESTARTING, then metadata returned ACTIVE_HEALTHY. No pause/restore, upgrade, new project, data reset or key rotation occurred. A private legacy credential diagnostic had stopped before any Management request or restart POST; it was not retried.

After normal boot grace, actual TLS-verified Auth health and settings both returned **200** at 00:30:32 UTC. GoTrue identified version v2.198.0. Public signup is still disabled, email confirmation is required, and Apple/email/Google providers are enabled. No signup policy was changed.

Actual PostgreSQL responded at 00:31:04 UTC and reported start time **00:30:13 UTC**, confirming the provider restart. Database size was 35,859,603 bytes, with 15 of 60 connection slots used, one active connection, no idle-in-transaction sessions and no active query older than two minutes. These are observations at that instant, not a traffic/capacity test.

The actual Metrics API then returned **200** with 300 metric names and pg_up=1. It showed approximately 426 MB total memory and 122 MB available, plus swap use; the startup one-minute load was 3.81. A single load sample is not CPU utilization. Filesystem availability across the sampled mounts was positive. This is not evidence that resource sizing is sufficient for the intended paid audience or that the earlier crash cannot recur.

## Existing restricted reviewer accepted

The protected Apple App Review username/password were read privately in memory. The check refused any identity equal to the developer contact address. Password authentication returned **200**, the authenticated identity matched the protected reviewer and email was confirmed. An authenticated usage GET returned **200**, showing 0 used, 20 allowed and the next UTC reset. This request generated no AI response and consumed no quota. The newly created reviewer session was signed out with **local scope**, returning **204**.

Credentials, keys, user IDs, JWTs, emails and provider response bodies are absent from this receipt. No owner training data write/delete query, purchase or account-creation request was issued. The usage GET does not execute RevenueCat paid verification, so this result must not be called a paid-entitlement or purchase-lifecycle test. Native reviewer navigation is also separate.

## Still to accept

- Public signup with a real confirmation email and native return; freshly read settings still disable signup.
- Server-side paid access and renewal/expiry/refund/restoration evidence.
- A separately scoped disposable account's real deletion/provider absence/device cleanup.
- AI spending/capacity and other remaining Apple materials.
- A later bounded stability recheck, without restart loops or unapproved upgrades.

The sanitized machine-readable evidence is LAUNCH_20261120_BACKEND_RECOVERY.json. The prior Build 122 timeout receipts remain historical evidence and are not silently rewritten.

Official guidance: [database timeout recovery](https://supabase.com/kb/troubleshooting/failed-to-run-sql-query-connection-terminated-due-to-connection-timeout), [522 and crashed-instance symptoms](https://supabase.com/kb/troubleshooting/failed-to-retrieve-tables), [Restart API](https://supabase.com/docs/reference/api/v1-restart-a-project), and [Metrics API](https://supabase.com/docs/guides/observability/metrics). The guidance supported the scoped recovery; actual post-restart requests establish the observed result.
