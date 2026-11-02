# Prepared Auth email templates — not deployed

Use Supabase Auth's template editor for StrideOS `pbzgrhnxpbtlkzpreizy` after the
approved sender is connected. These files contain no real recipient, token,
credential or tracking pixel. The placeholder is not an actual email link.

| Template | Subject | Supabase content field |
| --- | --- | --- |
| `confirm-signup.html` | Confirm your StrideOS email | `mailer_templates_confirmation_content` |
| `recover-password.html` | Reset your StrideOS password | `mailer_templates_recovery_content` |

Both preserve `{{ .ConfirmationURL }}`. Do not replace it with a fixed app link,
forward credentials to GitHub Pages, echo raw tokens or enable link tracking.
Supabase builds the verification URL and its app redirect. Current native code
requests `auth/callback` via Expo Linking; the exact signed-app callback and
production redirect allowlist must be tested before accepting delivery.

Reference: [Supabase templates](https://supabase.com/docs/guides/auth/auth-email-templates).
Mail security scanners can consume one-use links; test the owner's actual inbox
and resend/recovery behavior rather than claiming a static preview proves it.

Dashboard readback explicitly requires **custom SMTP before template editing**.
The CLI preview showed subjects only, not complete HTML-body changes, so no
partial configuration was pushed. Both drafts rendered and were visually
inspected locally. This proves neither delivery nor mail-client rendering.

Not changed by this preparation: SMTP, confirmation policy, signup restriction,
rate limits, provider accounts, public URLs or existing users. No email sent.
Previewing these HTML files is not native-app screenshot or inbox acceptance.
