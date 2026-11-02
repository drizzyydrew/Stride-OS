# Email auto-confirm and identity linking — security assessment

November 2, 2026. Documentation/source review only. No Auth configuration writes,
emails, account creation, customer-record reads or live exploit test occurred.
Supplied live settings: email auto-confirm true, email/Apple/Google enabled,
signups enabled. The exact hosted GoTrue version, provider-linking domains and
any project-specific mitigation were not verified.

**Conclusion: a concrete pre-account-takeover risk exists under the inspected
default linking behavior. Treat unrestricted unverified email signup as a public
launch blocker, not merely an email-delivery inconvenience.** This is a
source-supported configuration risk, not evidence of an existing compromise or
a claim that the hosted deployment was exploited.

## Evidence

- [Supabase identity-linking documentation](https://supabase.com/docs/guides/auth/auth-identity-linking#automatic-linking)
  describes same-email automatic linking and removal of unconfirmed identities
  to prevent pre-account takeover.
- Upstream source was pinned to commit
  `a7e97d665b9ea03853edb66d014bcde323f7894b` (October 30, 2026).
  [signup.go:228–237](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/signup.go#L228-L237)
  confirms the user immediately when Mailer.Autoconfirm is true; lines 305–315
  issue a password-grant session. No mailbox challenge occurs on that branch.
- [linking.go:119–145,197–213](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/models/linking.go#L119-L145)
  finds matching emails within the applicable linking domain and chooses the
  existing user for linking.
- [external.go:412–428](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/external.go#L412-L428)
  runs protective cleanup only when the existing user is unconfirmed.
  [user.go:1030–1060](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/models/user.go#L1030-L1060)
  shows that cleanup clears the old password and other identities. An already
  auto-confirmed user skips that cleanup condition.
- Native ID-token authentication also reaches the shared external-identity
  linking function: [token_oidc.go:335–340](https://github.com/supabase/auth/blob/a7e97d665b9ea03853edb66d014bcde323f7894b/internal/api/token_oidc.go#L335-L340).
- App source `src/store/authStore.ts:190–229,268–366` exposes password signup/
  login, Google OAuth and native Apple ID-token sign-in through Supabase. It
  accepts an immediate signup session. Device owner/generation checks protect
  local-account boundaries; they do not distinguish two people authenticated
  under the same server user UUID. No separate mailbox-proof gate was found.

## Supported risk scenario and limits

An attacker first registers a not-yet-used victim email with an attacker-known
password. Auto-confirm supplies access. Later, the legitimate mailbox owner
uses an OAuth identity returning that same email in the same linking domain.
The inspected code links to the existing confirmed user without removing the
old password; the attacker can retain password access to that shared account.
This inference follows the code above; no such accounts were created here.

It is not an assertion that an attacker can overwrite every existing account.
The scenario requires matching provider email/linking scope. Apple's private
relay can produce a different address, so the same-email assumption must not be
generalized to every Apple login. Manual-linking settings and UI button hiding
do not establish that automatic linking or public signup endpoints are closed.

## Recommended production and temporary-beta policy

- **Production:** require email confirmation (`mailer_autoconfirm=false` / Confirm
  email enabled) alongside verified SMTP or Send Email Hook delivery and working
  app redirects. [Supabase password-auth policy](https://supabase.com/docs/guides/auth/passwords#enabling-email-and-password-based-authentication)
  documents the confirmation setting. Keep CAPTCHA/rate limits and existing
  owner/auth guards; they do not replace mailbox proof.
- **Until then:** retain the closed public gate. Recommend an owner-approved
  server-side pause of new public registrations and existing, owner-verified
  testers with disposable/controlled identities. An unlisted TestFlight build
  alone does not close the public Auth endpoint. No new registration-control
  feature or configuration change is implemented by this assessment.
- A later owner-authorized disposable test must check unconfirmed password
  access, same-email OAuth linking and rejection of the old password. Existing
  accounts created under auto-confirm need a separately scoped trust/remediation
  review; changing the flag is not proof they were retroactively reverified.
  No mass deletion, forced account changes or customer audit is authorized here.

The email-delivery/public-launch gate remains closed. This intentional
confirmation-policy recommendation is security hardening, not a suggestion to
toggle safeguards merely to make a delivery check pass.
