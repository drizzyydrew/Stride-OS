# Resend Auth email setup — selected, not connected

Owner decision: use Resend instead of Brevo. Canonical StrideOS Supabase project
is `pbzgrhnxpbtlkzpreizy`. Bet Desk is outside this change. Existing free website,
support, privacy and terms URLs stay unchanged. Preserve the unfinished Brevo
account and its records; do not delete it or complete its address form.

## Prepared

- Owner sign-in is verified in Resend. The owner reports Google sign-in; the
  dashboard and actual usage page confirm the expected owner account and Free
  transactional plan, 0/3,000 monthly sends, 0/100 daily sends and 0/3 domains.
  Pay-as-you-go switches are off. This does not guarantee later billing or fraud
  checks never request an address.
- Existing confirmation/recovery HTML templates can be reused without app code
  or another native build merely to change the SMTP provider.
- Current published Free transactional plan is $0, 3,000 emails/month and
  100/day. SMTP is included. Do not select Pro, add-ons, paid inboxes or credits.
- Sending domain and DNS ownership are still required for production. The
  GitHub project website is not a domain whose email DNS the owner controls.
  Resend's shared `resend.dev` sender can only test the account's own inbox;
  it cannot be a production-sending workaround for arbitrary app users.
- Vercel's read-only connector returned `trainwithstrideos.com` and
  `strideosfitness.com` available, each quoted at $12.03 for one year and $12.03
  renewal at lookup time. No purchase is authorized by this research. Tax/final
  checkout, current availability and renewal settings must be checked before
  any charge. The owner has now chosen **strideosfitness.com**; it remains
  unpurchased and no DNS record is written. A fresh exact-name/one-year lookup
  still returns available, $12.03 registration and $12.03 renewal.
- The first three candidates returned `available:false`: `strideos.app`,
  `getstrideos.com`, `strideos.run`. That means unavailable or not confirmed,
  not proof of ownership. See `RESEND_DOMAIN_OPTIONS_20261102.json`.

## Execution after account and domain approval

1. Verify the correct owner Resend account and Free plan. Account creation and
   terms are owner actions. Keep credentials and codes out of chat and logs.
2. Present the exact chosen domain, registration term, final price/tax, renewal
   preference and registrant privacy for approval before purchase. Registrars
   still require truthful contact information even when public WHOIS privacy is
   included. Private registrant details are owner-entered, not copied from chat
   history. No automatic renewal or unrelated Vercel plan is authorized here.
3. After ownership is established, add an authentication sending subdomain in
   Resend, using the exact DNS records it supplies. Keep existing records and
   website URLs. Verify actual DNS and Resend status, not just accepted writes.
   Disable open and click tracking for Auth messages; prepare DMARC accurately.
4. Prepare a dedicated `StrideOS Supabase Auth` API key with Sending access,
   restricted to the verified sending domain where supported. The owner handles
   creation/copy/private entry. Never place it in public app/EAS variables,
   source, screenshots or chat. Do not generate an unrestricted spare key.
5. Configure only StrideOS Auth SMTP: host `smtp.resend.com`, port `465`,
   username `resend`, password the private API key, and verified-domain From
   address with display name StrideOS. These are Resend's documented Supabase
   SMTP settings; use Supabase's secure transport configuration. No credential
   exists or is installed yet. No provider switch is saved by this document.
6. Review the email processor/privacy disclosure before activation. Apply the
   prepared Supabase HTML templates preserving `{{ .ConfirmationURL }}`.
   Enforce the correct native callback/redirect allowlist and existing limits.
   A paid Supabase custom domain is an optional deliverability improvement,
   not an automatic purchase or prerequisite for this SMTP integration.
7. Test confirmation and recovery in signed native build 109 using an agreed
   disposable identity: inbox delivery, one-use/expired/resend behavior, reset
   password, correct project/callback and retained-history isolation. Keep raw
   tokens/links/private inbox contents out of receipts. Check the delivered
   footer to establish actual address exposure instead of generalizing the
   former Brevo banner. Reopen signup only after accepted outcomes.

## Current owner handoff

The Vercel cart contains only strideosfitness.com at $12.03. Both the compact
and full checkout routes stalled at Billing Information; the separate team
billing page loaded and confirms **no payment method added**. Its Add a Card
form is prepared for owner-only entry. The draft checkbox using this billing
address as the team's primary address was unchecked; no card, address or team
setting was saved. Do not infer an actual saved card from the quote tool's
generic default-payment-method wording.

An explicit owner decision is pending for a proposed **$15 total maximum**, one
year and **auto-renew off**. The read-only quote discloses non-refundable,
immediate registration and possible tax/fees beyond its $12.03 base. A proposal
is not authorization. Quotes expire; refresh/recheck before any charge. No
Vercel plan upgrade or add-on is part of this scope. WHOIS privacy is listed as
included for .com; truthful registrar contact information is still required
privately. Do not copy contact or payment details from prior chat or memory.

Resend's Add domain form is prepared with `auth.strideosfitness.com` but not
submitted. Establish ownership before creating the sending domain and its key.
Cart proof: `/tmp/strideosfitness-domain-cart-ready.png`. Free-plan proof:
`/tmp/strideos-resend-free-plan-verified.png`.

Current state: owner account signed in and Free plan verified; domain chosen,
purchase approval pending, no account/key creation by agent, no domain purchase,
no SMTP save, no test email, no delivery acceptance. See
`RESEND_ACCOUNT_PREPARATION_20261102.json` for the redacted checkpoint.

## Primary references

- [Resend signup](https://resend.com/signup)
- [Current pricing](https://resend.com/pricing.md)
- [Supabase SMTP integration](https://resend.com/docs/send-with-supabase-smtp)
- [Verified sending domains](https://resend.com/docs/dashboard/domains/introduction)
- [Shared sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- [Auth deliverability and tracking](https://resend.com/docs/knowledge-base/how-do-i-maximize-deliverability-for-supabase-auth-emails)
- [Vercel domain pricing and WHOIS privacy](https://vercel.com/domains/pricing)
