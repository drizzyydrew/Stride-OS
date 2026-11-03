# Auth email templates — deployed; native recovery acceptance pending

Saved in Supabase Auth for StrideOS `pbzgrhnxpbtlkzpreizy` after the owner
connected Resend SMTP. Both HTML files match full-reload editor readback exactly. These files contain no real recipient, token,
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

The custom SMTP prerequisite is now satisfied. Both subjects and complete HTML
bodies were saved, reloaded, compared exactly and previewed in the dashboard.
Proof: `/tmp/strideos-confirm-email-saved.png` and
`/tmp/strideos-reset-email-saved.png`. These are template previews, not native
screenshots or inbox delivery evidence. See `RESEND_SMTP_ACCEPTANCE_20261102.json`.

The owner has now initiated a reset: Gmail inbox arrival, expected sender, TLS
header and visible branded rendering are confirmed by two supplied screenshots.
The raw link was not retrieved. No password change was performed by the agent.
Signup remains
closed and Confirm email is currently off; verify the intended confirmation
policy before reopening signup. Actual iPhone callback/reset and one-use link
acceptance still require owner participation. Keep tokens/passwords out of chat.
