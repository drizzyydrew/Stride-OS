# Signup and automated email-account deletion acceptance

At **2026-11-21 01:15:33 UTC**, an actual disposable account completed the production automated deletion flow. Public email signup, real email confirmation, confirmed password login, real recovery email without changing the password, and the expected native callback URI were verified on the server. Native-device navigation and local device cleanup remain separate checks.

Root enabled only public signup through the provider UI, preserving required email confirmation and existing providers/SMTP. Three unique aliases belonging to the verified owner mailbox were used during diagnosis; no account was created or confirmed through an admin bypass. Credentials, email-link tokens, JWTs and deletion receipt secrets were kept in process memory and are absent from these records. No owner account, health record, workout or image was changed.

## Actual failure and narrow correction

The first account's deletion request was accepted but remained pending. The Apple grant-custody migration had accidentally removed the original social-provider filter from `stride_deletion_private.provider_actions(uuid)`. This reported `email` as a pending OAuth action, which the unchanged worker validator correctly rejected. Email authentication requires no external OAuth revocation.

The reviewed correction restores only `and p in ('apple','google')`. It preserves the inventory of all identity providers, unknown-provider rejection, Apple capture guards, function ownership, ACL, security definer setting and empty search path. Root applied migration **20261121010258_restrict_deletion_actions_to_social_providers** and verified the exact live definition. Sixty real-Postgres and worker/handler tests passed without skips. See [migration receipt](LAUNCH_READINESS_20261120_DELETION_MIGRATION.json).

The first failed fixture was removed through strictly guarded admin cleanup, then its exact empty pending QA metadata footprint was removed. It was never marked completed. A second fixture exposed a test-harness mistake: signup already creates the profile, so a second insert conflicted. The harness was corrected to read and update only its existing owned profile through its own JWT; no production change was required.

## Successful production acceptance

The third fixture completed real signup and email confirmation, then wrote/read a harmless profile marker using its own JWT. Its first deletion attempt returned an edge 503 after 24,910 ms; no deletion request was created. The same window contained a PostgREST timeout-manager event. This establishes intermittent dependency failure, not its exact infrastructure cause. No second project restart or policy relaxation occurred.

One approved retry reused that same confirmed account through a real recovery email, with its password unchanged. Fresh Auth/REST/RPC preflight succeeded. Deletion automation was allowlisted to **only this disposable UUID**, then the actual authenticated deletion request returned **202**. The actual worker completed, the receipt returned `completed`, Auth no longer contained the account, all eight inventory counts were zero, and there were no retained/unsafe storage objects. The old JWT was rejected with **403**. The successful deletion used no admin fallback.

The script restored the original disabled control. Independent SQL then verified **enabled false, non-global empty allowlist, no gateway key, cron count 0, unfinished requests 0, all three QA aliases absent from Auth, one completed receipt for the successful fixture and no remaining profile row**.

## Production activation

After scoped acceptance and independent restoration checks, root explicitly approved enabling production automation. Fresh SQL verified **all unfinished deletion requests = 0**, and an immediate service REST check returned **200 / empty**. One activation RPC returned **200 / true**, using the existing public gateway key and explicit `test_owner_ids: null` for production scope. No key was created or rotated.

The restricted reviewer signed in, made a **GET only** to the account-deletion endpoint and received **200** with `automaticProcessing: true` and no deletion request. Apple code exchange and Google token-revoke configuration booleans were true; they do not prove live grant revocation. The temporary reviewer session signed out locally with **204**. No owner/reviewer deletion was requested.

Independent final SQL verified **enabled true, global scope true, existing public gateway valid, exactly one active cron job every minute with the expected dispatch command, all unfinished requests 0 and all QA aliases absent from Auth**. The first ordinary scheduled invocation at **01:19:00 UTC** also succeeded (one SQL result row; no pending deletion jobs). This supersedes the earlier restored-OFF checkpoint for the final production control state.

## Boundaries

This accepts the actual server email-account flow. It does not claim native-device callback/local cleanup, Apple/Google grant revocation, a post-deletion password-login attempt, sustained capacity, absence of future timeouts or public App Review submission. Historical failure receipts are retained in the [sanitized evidence](LAUNCH_20261120_SIGNUP_DELETION_ACCEPTANCE.json).
