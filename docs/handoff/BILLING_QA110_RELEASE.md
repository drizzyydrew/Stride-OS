# Build 110 — private purchase QA only

November 2, 2026. **Never select this QA binary for public release.** Production
109 remains selected in the manual-release draft. Global server billing is off,
no QA owner is bound, and no purchase or AI request was executed by preparation.

## Source and verification

- Isolated branch `codex/strideos-billing-qa110`, pushed source
  `fe8d4db0e8d38435cc8c32a6b86fb59946b71661`, prepared from `d71403e`.
  Only app build number 109 → 110 and its preparation note differ. The existing
  `billing-qa` profile enables the client purchase screen; canonical production
  configuration and build number remain unchanged.
- TypeScript/Expo checks and 49 billing/privacy/observability tests passed.
  These are focused checks, not a new full regression or native acceptance.
- Existing Expo Starter allowance was checked before starting one medium job;
  displayed usage was $12 of $45. No plan, credit pack or add-on was purchased.
- EAS build `94bf0704-0f90-452f-938f-3d2986ed853f` finished at
  `2026-11-02T21:10:01.583Z`. Downloaded exact IPA: 129,568,275 bytes, SHA-256
  `43f9795b61c94d200b81dcae31242d9864d0329ebd80cd190121e450770a1a69`.
- Host, Watch and Live Activity all report 1.0.0/110 and pass strict/deep
  signature checks with intended identifiers and no debug signing. Twenty-one
  privacy manifests parse; compiled 1024px icon is opaque. Archive entitlement,
  purpose-string and credential-filename checks passed. See
  `BILLING_QA110_ARTIFACT_VERIFICATION.json` for exact hashes and target metadata.
- Cloud Xcode log records Sentry Source Map Upload Report, release
  `com.mooremovement.strideos@1.0.0+110`, dist 110 and File upload complete.
  This does not establish native crash-symbolication acceptance.

## Internal delivery

- Submission `339b15c4-4671-4dac-86be-13459a3a2186` **FINISHED**. Fresh official
  Apple status confirms **110 VALID / IN_BETA_TESTING, not expired**, matched
  to the exact EAS build/submission. Apple build
  `8f68d310-df68-4087-9126-c2386e00a80e`; see
  `BILLING_QA110_APPLE_ACCEPTANCE.json`.
- Browser readback shows Team (Expo), Internal, one tester; no individual
  testers or additional groups. The group was already owner-only. No external
  invitation, public beta link or public review submission was created.
- A separate fresh draft readback shows 109, manual release, Prepare for
  Submission. That read did not change the draft or select 110.
- Browser control disconnected during entry of the optional What to Test note.
  No Save/readback is confirmed. Before testing, save the private-QA warning
  from `HOME_LAUNCH_SESSION_20261102.md` after browser reconnection. Do not count
  the attempted note as completed website work.

## Required before purchases

Confirm the dedicated authenticated test identity, bind only that UUID to the
inert server pathway, and verify RevenueCat customer identity before owner
sandbox dialogs. No owner/global flag was set during this preparation. The
existing iOS SDK public key and RevenueCat App Store app match; monthly/annual
packages and Pro entitlement are attached. This is configuration evidence, not
purchase acceptance. Renewal/expiry/refund/grace, restore and account switching
still require real supported lifecycle testing. The deliberate QA 429 confirms
verified access without spending AI quota; it is not normal Coach success.

Prepare a separate intended paid-production variant only after acceptance and
the remaining email/deletion/device/privacy gates. Keep canonical 109 as the
billing-off baseline and preserve history and existing Asset Library originals.
