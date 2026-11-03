# Resend Auth email setup — SMTP and templates saved; delivery pending

Verified November 2, 2026 Pacific (November 3 UTC). This supersedes the earlier
cart/private-card checkpoint in `RESEND_ACCOUNT_PREPARATION_20261102.json`.
The current redacted receipt is `RESEND_DOMAIN_CONNECTION_20261102.json`.

## Completed and verified

- The owner completed Vercel registration of **strideosfitness.com**. Its order
  is completed for one year at a listed registration price of **$12.03**;
  final tax/charged total was not independently inspected. The approved cap
  was $15 including fees. No additional purchase was made by the agent.
- Expiration is **November 2, 2027**. The initial registration enabled renewal.
  The UI toggle did not persist; the official CLI disabled it and the connector
  independently returned **renew=false**. Manual renewal is required to retain
  the domain after this term. No hosting upgrade or add-on was purchased.
- Authoritative nameservers are Vercel. Existing root/wildcard ALIAS and CAA
  records are preserved. The domain is not attached to a Bet Desk project.
- Resend's **auth.strideosfitness.com** domain now reads **Verified / ready to
  send emails**. The actual dashboard supplied a public DKIM TXT record and
  two Forge CNAME records; these were added exactly as supplied, rather than
  substituting an older generic MX/SPF setup. Both authoritative DNS and a
  public recursive resolver returned the exact values.
- The optional provider-recommended `_dmarc` TXT baseline is `v=DMARC1; p=none;`.
  It specifies no reporting recipient and does not reject mail. See the receipt
  for separate DNS propagation/readback status.
- Resend Free was verified: 3,000/month, 100/day, $0 plan, pay-as-you-go off.
  No receiving mailbox or tracking subdomain was created. The tracking editor
  was only inspected and left without saving its default draft options.
- Existing free GitHub Pages website/support/privacy/terms URLs remain in use.
  Registering this domain does not automatically move the website or create a
  support inbox. Preserve the unfinished Brevo account and its records.

## SMTP and templates now saved

The owner created the dedicated `StrideOS Supabase Auth` key and saved it
privately in Supabase. A reload verifies custom SMTP on, stored password hidden,
Resend host, port 465 and StrideOS sender name. Resend key metadata independently
shows **Sending access**, domain **auth.strideosfitness.com**, zero uses at the
checkpoint. Its secret was not read or copied by the agent.

- Sender: `no-reply@auth.strideosfitness.com`; name StrideOS.
- Host: `smtp.resend.com`; port 465; username `resend`.
- Confirmation subject: **Confirm your StrideOS email**.
- Recovery subject: **Reset your StrideOS password**.
- Both prepared HTML templates are saved in the exact StrideOS project. After
  full reload, their complete editor contents matched the canonical files
  exactly; previews retain `{{ .ConfirmationURL }}` and the support-page link.
- The public privacy page now explains Resend's processing of recipient email,
  authentication-message content/links and delivery records. Hosting commit
  `ef830a1d08fa4151b8357ae28259270db4473ac5` is built; the live HTTP-200 page
  exactly matches the canonical privacy file. No workout/health/media fields
  are added to the authentication templates.

Current receipt: `RESEND_SMTP_ACCEPTANCE_20261102.json`. The earlier domain
connection receipt describes the prior unsaved handoff, now completed.

## Remaining acceptance

1. Using a dedicated test/reviewer identity in signed TestFlight build 109,
   request a reset through **Forgot password? → Send Reset Link**. Verify actual
   inbox/spam delivery and provider delivery events. No email was sent by the
   agent at this checkpoint. A hidden stored key does not prove SMTP acceptance.
2. The owner opens the link on the iPhone and enters any new password privately.
   Verify native return, successful new-password sign-in, one-use/expired/resend
   behavior and account-history isolation. Keep raw tokens/links out of receipts.
   If this changes Apple's review-account password, update App Review Information
   directly before review; never leave stale reviewer credentials.
3. Verify confirmation with a controlled test identity before reopening signup.
   The live dashboard currently shows **signup off** and **Confirm email off**;
   neither was changed by template editing. Enable/test the intended confirmation
   policy with attention to existing accounts before public signup is reopened.
4. The redirect list includes the exact `strideos://auth/callback`, plus existing
   `strideos://auth/new-password` and `strideos://**`. Site URL is `strideos://`.
   No redirect rules were added or broadened. Actual signed-device handling is
   still a separate acceptance check.
5. Check delivered footer/address exposure and mail-client rendering. No tracking
   subdomain was configured. Public signup, payments and public release remain
   closed; Bet Desk and real customer records are outside this setup.

## Primary references

- [Resend Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
- [Verified domains](https://resend.com/docs/dashboard/domains/introduction)
- [Restricted API keys](https://resend.com/docs/dashboard/api-keys/introduction)
- [Auth deliverability](https://resend.com/docs/knowledge-base/how-do-i-maximize-deliverability-for-supabase-auth-emails)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend pricing](https://resend.com/pricing.md)
