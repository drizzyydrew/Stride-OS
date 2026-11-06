# Build 113 — signing failure, not distributed

The authorized attempt from `ee037b3cd0eac72ab9a52f11877074c4b0e416d9`
failed before producing an IPA. EAS job `84bc7fdd-6e2c-46bd-abb2-58755f963d91`
reports `ERRORED / XCODE_BUILD_ERROR`: the saved phone provisioning profile
lacked Associated Domains for the new password-autofill entitlement. No Apple
submission or TestFlight delivery occurred.

`BUILD113_PREFLIGHT.json` preserves the passing 1,796-test/TypeScript/bundle/Expo
source checks; those did not establish that Apple signing was configured.
`BUILD113_FAILURE.json` records the actual failed cloud state. The capability
and refreshed profile were independently read back in
`BUILD114_SIGNING_REPAIR.json`, preserving the existing certificate, HealthKit,
app group, Watch and Live Activity profiles. A temporary local copy of the
existing submission key was removed after verification; no new key was made.

The new candidate is **114**. See `BUILD114_RELEASE.md` and
`BUILD114_OWNER_TEST_GUIDE.md`. There is no build 113 for the owner to install.
