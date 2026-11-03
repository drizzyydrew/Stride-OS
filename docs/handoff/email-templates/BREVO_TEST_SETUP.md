# Brevo free email testing setup — not connected

**Superseded:** the owner selected Resend after raising concerns about Brevo's
required organization-address form. Do not continue Brevo onboarding or connect
it. Preserve the partially created account; no deletion is authorized. Use
`RESEND_SETUP.md` for the active plan. The historical research below is retained.

November 2, 2026. Owner confirms no existing email service and no controlled
domain. Keep GitHub Pages URLs and the no-unapproved-purchase preference.

Brevo's current Free plan includes transactional email and 300 daily sends,
with no card or time limit. The free-plan signup form is open for the owner to
create the account, enter a private password, accept terms and verify email.
No account was created by the agent. Do not select Starter, add-ons or credits.
[Plan details](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans).

For free-address or unauthenticated-domain senders, Brevo documents temporary
sender rewriting, including a transactional `t-sender-sib.com` address. It calls
this a stopgap, not a permanent solution. Availability, activation, actual From
address and delivery must be checked in this specific account; do not promise
domain-free production acceptance or fabricate a domain/DNS ownership proof.
[Sender handling](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

## After the owner reports account ready

1. Confirm the $0 plan and real transactional-platform activation. New accounts
   can require an owner support request; do not send a ticket without explicit
   authorization or upgrade to bypass review.
2. Have the owner verify an inbox they control as the intended sender. Use
   StrideOS as the display name. Do not import contacts, enable campaigns or
   add marketing automation/tracking.
3. Prepare StrideOS-only SMTP settings in Supabase. Official relay host:
   `smtp-relay.brevo.com`. Use the exact SMTP Login displayed by this account,
   which can differ from account email. Password is a dedicated SMTP key, not
   the account password or API key. The owner creates/enters credentials
   privately; no key is put in chat, source, screenshots or receipts. Supported
   ports include 587, 465 and 2525; confirm transport configuration before save.
4. Confirm the processor/privacy disclosure and exact permitted recipients for
   test messages before connecting/sending. Keep login tokens confidential.
   Apply the prepared Supabase templates without replacing ConfirmationURL.
   Disable provider open/click tracking for Auth messages and verify the result.
5. Test confirmation and recovery on the signed app with the owner's disposable
   inbox identity, including one-use/expired/resend behavior and correct project
   callback. Record redacted delivery/bounce and app outcome, not raw links.
   Reopen registration only after acceptance. Preserve existing users/history.
6. Decide a durable authenticated sender before a public launch. Any domain
   purchase or paid provider plan needs separate approval. The free website
   URLs can remain unchanged if an email-only domain is later approved.

[SMTP configuration](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP),
[activation and sender troubleshooting](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP).

Current state: signup handed off; SMTP off; no email sent; no sender or delivery
acceptance. Provider setup can add elapsed time independent of code changes.
