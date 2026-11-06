# Build 113 — new-feature regression candidate

Version **1.0.0 (113)**, production-profile store archive, purchases disabled.
The owner explicitly authorized the updated build and TestFlight submission and
requested complete App Store launch preparation. This supersedes the prior
TestFlight hold for this candidate. Public review/release remains separate.

## Included work since normal internal 111

- Recovered outdoor-session Resume/Stop prompt, editable first/last name and
  local display username with separate visibility, forgot-password email
  carry-over and native credential-autofill integration.
- Running auto-pause Off persistence and live-mode corrections, distinct spoken
  announcement labels, and pause-aware recording anchor corrections.
- Existing archive-link compatibility, yellow measured tour highlights and
  scrolling, readable PR date/time form, explicit race/time-trial results and
  source-linked PR/VDOT/pace/prediction updates.
- Health setup drives optional Watch permission review; separate metrics setup
  button removed and raw sync diagnostic panels hidden in release.
- Six canonical race-PR badges (800m, mile, 5K, 10K, half marathon, marathon),
  repeat strictly-faster-result celebrations and source/durable deduplication.
  Half-marathon and marathon faces use **13.1** and **26.2**.
- Expo SDK 57 patch alignment through `expo install --fix`: Expo 57.0.32 and its
  eight companion patches. No SDK-major or purchase-SDK upgrade. The release
  dependency contracts now check Expo CLI's actual JSON-schema replacement for
  runtime Zod, retaining valid/invalid consumer behavior and lock verification.

Source-feature provenance remains in the dated phone-feedback, badge and mileage
receipts. These features have not been accepted on an installed 113 by preparing
this document.

## Current release state

Prepared; local validation and exact source identity are recorded in
`BUILD113_PREFLIGHT.json` when complete. Cloud build, signed artifact, submission,
Apple processing and existing-group assignment must each be recorded explicitly
before calling this candidate available. No build ID is inferred here.

## Validation and scope boundaries

The normal `production` profile resolves store distribution, production EAS
environment, remote credentials and client billing false. Generated phone
Info.plist reports 1.0.0/113; source uses continuous native generation and ignored
`ios/` is excluded from the uploaded source. Inspect the actual signed phone,
Watch and Live Activity versions/capabilities before submission.

No new customer records, account reset/deletion, signup activation, subscription
activation, server QA binding, invitations, public review or public release are
authorized as an incidental part of this normal candidate delivery. App Store
manual release remains confirmed by the fresh supported metadata pull.

Walking/Hiking retain manual pause controls. A race time does not establish
measured HRmax; usernames are device-local aliases; arbitrary cross-route tours
end on leaving the route; Apple controls password save/update prompts. These are
explicit behavior boundaries, not omitted release fixes.

## Owner next steps and public packet

Use `BUILD113_OWNER_TEST_GUIDE.md` in order. Updated store-copy/reviewer/privacy
variants, field limits, image-gap inventory and remaining gates are assembled in
`store-package-20261105/`. Public policy availability is separately recorded in
`PUBLIC_SITE_READBACK_20261105.json`.

Public launch readiness remains false until corrected-candidate device tests,
clean-account/reviewer/signup acceptance, approved disposable provider/native
deletion, payment lifecycle for a paid scope, final genuine captures, operations
and final owner release decisions are resolved. Private QA112 and the last
recorded public draft's 109 selection are not this candidate.
