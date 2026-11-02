# Email delivery — sender setup still required

November 2, 2026. No provider account, domain, plan or SMTP credential was created
or purchased. Existing free website URLs stay unchanged. The owner was asked
whether an existing sender can be reused; that answer is pending.

## Preferred next action

Reuse an existing approved transactional SMTP service if available. Supabase
supports custom SMTP, including Brevo, Resend and other providers. Its built-in
sender is restricted to team addresses, currently two emails/hour, and explicitly
not intended for production. An API success is not inbox delivery evidence.
[Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

If no service exists, prepare a free-tier choice for owner review rather than
silently buying a domain or starting a subscription. Brevo is one candidate:
its published Free plan allows 300 sends/day and includes branding. After that
limit, transactional mail can queue, with a finite queue; it is not unlimited
or an established production capacity for StrideOS.
[Brevo free limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

Brevo's SMTP setup guide requires an authenticated domain and a transactional
sender; its troubleshooting guide describes temporary rewriting of unauthenticated
or free-email sender domains to a Brevo domain. That fallback is not proof that a
new account will be approved or a domain-free setup is suitable long term. Verify
the actual account, sender, delivery and applicable terms before selecting it.
Use an SMTP key, not an API key; keep credential entry private.
[SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP),
[sender rewriting](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication).

## Acceptance before signup reopens

1. Verify the approved sender and SMTP settings in isolated StrideOS only.
   Review privacy disclosures for any new processor before production use.
2. Require confirmation for future email signups. Keep existing accounts and
   history intact; do not mass-reset passwords or claim retroactive verification.
3. Disable authentication-link rewriting/tracking where the provider offers it;
   verify the actual confirmation and recovery deep links on the native candidate.
4. Use an agreed disposable identity/inbox. Verify receipt, actual sender,
   inbox/spam placement, confirmation, recovery, password replacement and sign-in.
   Owner enters credentials and confirms inbox outcomes privately.
5. Verify refusal of unconfirmed password access and same-email identity-linking
   ownership behavior. Preserve Auth rate limits; do not disable confirmation to
   manufacture success or raise limits beyond verified sender capacity.
6. Reopen signup only after these checks pass. Record the exact configuration and
   results separately; this plan is not activation or acceptance.
