# Build 114 — new-feature regression candidate

Version **1.0.0 (114)**, production-profile store archive, purchases disabled.
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
receipts. These features have not been accepted on an installed 114 by preparing
this document.

## Current release state

EAS build `184207fd-0412-4788-8790-806c723579f5` is **FINISHED**, from source
`0b24c1c744b448d2a0fb0c4d8d1658ddd042b4fe`. The exact downloaded IPA is
129,611,690 bytes, SHA-256
`0e6a360f9566cc36cfe2f7c3c501cf01691ccf974f82bb63c287784d808820ba`.

`BUILD114_ARTIFACT_VERIFICATION.json` records strict/deep signed app, Watch and
Live Activity version 1.0.0/114, expected team/application IDs, no debug signing,
HealthKit/shared app groups, signed webcredentials domain and compatible
provisioning, 21 parsed privacy manifests, opaque compiled 1024px icon and
Hermes bytecode. No credential-like filenames were found in the IPA.
`BUILD114_CLOUD_VERIFICATION.json` confirms cloud Expo Doctor 21/21 and the
Sentry source-map upload report, matching release and completed upload. Native
crash-symbolication and physical-device behavior remain separate.

Exact-build submission `aad9c5ce-e380-4f47-8aca-54b0825bdaf2` is **FINISHED**.
Fresh official Apple readback confirms **114 VALID / IN_BETA_TESTING**, not
expired, and actual assignment to the existing **Team (Expo)** internal group
with **one tester**. No new group or invitation was created. The 3,535-character
What to Test instructions were saved through Apple's beta-build localization API
and read back exactly. `BUILD114_APPLE_ACCEPTANCE.json` records the full identity
chain and text hash. This is internal availability, not physical acceptance.

Fresh Apple readback also confirms public draft **1.0 / 109 / Prepare for
Submission / Manual**. No public review or release was performed. The prepared
normal candidate is intentionally billing-off; paid lifecycle and final public
candidate selection are separate acceptance gates.

## Validation and scope boundaries

The normal `production` profile resolves store distribution, production EAS
environment, remote credentials and client billing false. Generated phone
Info.plist reports 1.0.0/114; source uses continuous native generation and ignored
`ios/` is excluded from the uploaded source. The actual signed phone, Watch and
Live Activity versions/capabilities were inspected before submission.

The signing repair refreshed the phone profile from M5L3226NG3 to FAN8XCTS36.
Historical private QA112 predates both this profile change and the new features;
its dated archive inspection is not a current delivery authorization/validation.
Revalidate or replace that private purchase candidate when coordinating StoreKit
acceptance after the normal candidate's regression. Do not deliver old QA112
merely because its prior receipt said it was ready.

No new customer records, account reset/deletion, signup activation, subscription
activation, server QA binding, invitations, public review or public release are
authorized as an incidental part of this normal candidate delivery. App Store
manual release remains confirmed by the fresh supported metadata pull.

Walking/Hiking retain manual pause controls. A race time does not establish
measured HRmax; usernames are device-local aliases; arbitrary cross-route tours
end on leaving the route; Apple controls password save/update prompts. These are
explicit behavior boundaries, not omitted release fixes.

## Owner next steps and public packet

Use `BUILD114_OWNER_TEST_GUIDE.md` in order. Updated store-copy/reviewer/privacy
variants, field limits, image-gap inventory and remaining gates are assembled in
`store-package-20261105/`. Public policy availability is separately recorded in
`PUBLIC_SITE_READBACK_20261105.json`.

Public launch readiness remains false until corrected-candidate device tests,
clean-account/reviewer/signup acceptance, approved disposable provider/native
deletion, payment lifecycle for a paid scope, final genuine captures, operations
and final owner release decisions are resolved. Private QA112 and the last
recorded public draft's 109 selection are not this candidate.
