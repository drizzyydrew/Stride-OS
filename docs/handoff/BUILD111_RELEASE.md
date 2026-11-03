# Build 111 — cold-start password-reset correction

Production-profile internal candidate, version 1.0.0 (111), payments off.
Source: `dc318bf8e9c296efc3ef63351bb2d7dca8b3faa2`.

- Final serial suite **1,623/1,623 passed**, zero failures/skips/cancellations.
  Semantic TypeScript and Expo dependency compatibility passed. See
  `AUTH_RESET_COLD_START_20261102.md` for the incident and independent automated
  platform/security review, including rejected/delayed-storage failure checks.
- EAS build `be1f0cb0-dc73-4089-839a-4e23d1af4a86` is **FINISHED**. The exact
  downloaded IPA is 129,571,853 bytes, SHA-256
  `38425e76a2644301fc2c4b65229413905cd798abc86f9ee5c1223fc06ee9142a`.
- App, Watch and Live Activity each report 1.0.0/111 with valid deep/strict
  signatures and the intended application/team IDs. HealthKit, Apple sign-in
  and shared app-group entitlements remain where applicable. All 21 privacy
  manifests parse; compiled 1024px icon is opaque; embedded bundle is Hermes
  bytecode; no private-credential filenames were found in the archive. Exact
  receipt: `BUILD111_ARTIFACT_VERIFICATION.json`.
- Decoded raw Xcode log confirms Sentry **Source Map Upload Report**, release
  `com.mooremovement.strideos@1.0.0+111`, and **File upload complete**. This is not
  native crash-symbolication acceptance or permission to expand diagnostics.
- Exact-build submission `709968c7-bcb0-4a62-8fcf-4c8c1b8e89b3` **FINISHED**
  using the existing Apple API key and the existing **Team (Expo)** internal
  group. Fresh browser readback confirms one internal owner tester, previously
  installed 109. No new group/tester, external invitation or optional paid
  submission feature was requested. Fresh official Apple status confirms
  **111 VALID / IN_BETA_TESTING**, not expired, with matching EAS build and
  submission IDs. Browser build-list readback confirms Team (Expo) assignment
  and one internal tester. See `BUILD111_APPLE_ACCEPTANCE.json`. This establishes
  installable internal availability, not device acceptance or public review.
- The build-specific What to Test instructions are saved in Apple and verified
  after reload. Save is disabled with no pending edits; one internal group/tester
  remains. Proof: `/tmp/strideos-build111-testflight-ready.png`.

## Remaining acceptance and release boundary

Build 111 is available internally. The owner must now repeat the exact
reported flow: request reset, close StrideOS, open the newest email, privately
save the password and sign in; repeat with another email. Check warm opening,
old/used links, interrupted connectivity and preserved account history.

Current public draft was previously verified as 109/manual release; this run
has not submitted it for public review or changed that attachment. Private
billing QA build 110 remains isolated. SMTP/delivery work does not reopen
signup or enable payments/deletion. Broader GPS, HealthKit/Watch, billing,
delete/recovery, current screenshots and other launch gates remain separate.
