# November 18 owner and allowance readback

Owner: "the lock screen logo looks excellent." Uploaded physical-phone photo shows the approved transparent three-chevron logo beside Paused · Training Run. Ordinary Lock Screen logo acceptance is owner-reported and visually supported. Installed build number is inferred from the requested119 check, not visible in the photo; Always On acceptance is not claimed.

Two genuine current membership photos show Training that grows with you, Personalized plans, Adapt your week, AI Coach, Up to20 requests per UTC day, and Your Pro subscription is active. Received chat JPEGs are not yet verified full-resolution App Store image exports.

## Apple access

- Chrome navigation to developer.apple.com/account resolves to Sign in to Apple Developer. Browser session is not signed in. No credentials entered or sign-in attempted.
- Existing App Store Connect API credential successfully read app6782788130 at2026-11-18T09:15:48.945Z. App name StrideOS: Run, Lift, Recover. API access and Developer website sign-in are separate.

## Live allowance and app behavior

Read-only Supabase checks against pbzgrhnxpbtlkzpreizy confirm:

- Deployed ai-coach function ACTIVE/v16/verify_jwt true calls consume_stride_coach_allowance before the AI provider.
- Live database function reserves at most20 requests/account/UTC day and500 globally/UTC day, using a transaction lock. Closing/reinstalling the client does not reset this account/server counter.
- Usage is stored in stride_coach_usage by UTC date and account scope, with a separate global row. Cleanup occurs during reservation for dates older than seven days.
- Aggregated last-seven-day usage query returned no rows. No customer identifiers or conversation content were retrieved. This result is not proof of successful authenticated AI use or entitlement enforcement.
- Both account/global exhaustion return HTTP429 with: AI Coach has reached its daily request limit. Try again tomorrow; on-device Insights remain available.
- src/lib/aiCoach.ts forwards that error to the chat view, which shows an inline error box. The input/send control is not quota-disabled and the response has no remaining count or reset timestamp.
- Reservation happens before the provider fetch; provider failure does not refund it. Counts are request reservations, not successful replies or token/cost measurements.
- No dedicated usage dashboard/automated alerts/token-cost reporting is established by this inspection. Manual aggregate database monitoring is available. Prior global billing configuration was not re-read in this turn and must not be inferred from deployed code.

The owner asks whether the allowance was changed. Current local launch118/GROWTH_PLAN.md explicitly retains20 requests and does not promise unlimited; the personalized-plan membership bundle was expanded. No new allowance policy was selected or implemented during this readback.

No provider request, purchase, quota mutation, configuration change, build or public submission occurred. Public-launch paid access and capacity gates remain open.
