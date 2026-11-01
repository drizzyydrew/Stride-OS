# Build 105 release record

Prepared October 31, 2026 Pacific / November 1 UTC in the canonical Developer
checkout on `build-19-v3-foundation`. The owner authorized completing launch
engineering, pushing and TestFlight submission. Public App Review/release,
new paid services, binding agreements and deletion of existing customers are
outside this release.

## Changes

- Native secure deletion receipts survive loss of the initial HTTP response and
  Auth removal. A confirmed server completion permits explicit, verified local
  history/media/credential cleanup, followed by a fresh-process check before
  ownership can reopen. Recording, owner conflicts, offline recovery and late
  writes fail closed. Apple/Google credential repair requires an explicit action;
  background polling never opens an identity prompt.
- Provider revocation, encrypted temporary credentials, request leases and
  single-use worker tickets support independently scheduled server retries.
  Missing legacy credentials produce explicit manual-disconnection guidance;
  known provider/configuration failures remain pending rather than claiming
  success. No purchase key is reused for Apple identity.
- Added compatible `expo-crypto` and patched the Babel build dependency to
  7.29.6. SDK 56, RN 0.85.3 and Purchases 10.16.0 remain unchanged. The reviewed
  residual audit has 17 findings (16 moderate, 1 low), with no high/critical;
  exposure and limitations are in `DEPENDENCY_EXPOSURE_REVIEW.md`.
- Added billing boundary tooling/acceptance records and corrected the policy,
  support and terms drafts to match actual deletion stages and retained records.

## Independent review and live backend evidence

The platform/client and independent contrarian reviews give scoped source/test
judgments of 95/100 and 96/100 after fixing credential resurrection, cancelled
lease revival and stale navigation access. These are review judgments, not
measured reliability probabilities or device acceptance. Six adversarial cases
passed. An independent harness review found all 149 assertions and 22 test
declarations/bodies unchanged in the adjusted activity-persistence harness.

Applied only to StrideOS `pbzgrhnxpbtlkzpreizy`:

- `20261101054636_deletion_automation_receipts_and_tickets`
- `20261101055116_enable_deletion_scheduler_extensions`
- Exact deployed source readback matched `account-deletion` v3 (JWT verified),
  receipt-status v1 and worker v1 (their own private receipt/ticket authentication).
- Three new disposable accounts alone were allowlisted. No existing owner was
  eligible. Owner backup read/write and dummy-file upload passed; cross-owner
  backup read/update and file retrieval were denied. Unauthenticated deletion,
  forged worker tickets and unknown receipts were rejected.
- Immediate deletion completed at `2026-11-01T05:52:52.896211Z`. Synthetic legacy
  Apple fallback completed at `05:53:10.214721Z`, explicitly `manual_required`.
- An interrupted fixture had an issued/consumed ticket and expired worker lease.
  No status request or manual dispatch followed. Read-only SQL observed the
  `05:54:00Z` cron run, HTTP 202, and completion at `05:54:01.769662Z`, with two
  dispatch attempts. Its Auth identity, records and dummy file were removed.
- All three fixtures were removed. Original aggregate counts remained exactly:
  Auth 1, profiles 1, workouts 15, strength logs 5, storage objects 2; all other
  covered app-table counts 0. Three minimal completed fixture receipts remain.
- Afterwards automation was disabled, allowlist reset to empty, gateway key
  cleared and the cron job removed. Existing customer data was not deleted.

Security advisors retain the pre-existing leaked-password-protection warning
and four informational no-policy notices for intentional private/default-deny
tables. No plan upgrade or client grants were added to silence those notices.
See `DELETION_ACCEPTANCE.md` for provider/native/retention limits.

## Release checks and remaining receipts

Semantic TypeScript and Expo dependency checks passed. Clean iOS prebuild and
iOS Hermes export passed. The original ignored native tree was preserved at
`/tmp/strideos-build105-native-backup-ios`; the new generated host plist uses 105.
The existing Starter account showed $0/$45 build credit used before this build;
no plan change or add-on was selected.

The first serial suite had 1,390/1,412 passes: 21 old VM harness failures from
loading native bootstrap without a mock, plus the unchanged Swift deadline
compiler's 30-second timeout while Metro export competed for resources. The
harness now exercises the real barrier with native bootstrap mocked and a shared
host Promise realm for Zustand. Its 22 cases and 66 affected checks passed.
The unchanged native Swift file passed 5/5 separately (compiler probe 3.9 seconds).
No assertion or timeout was weakened. The complete final serial rerun passed
**1,412/1,412**, zero failures/skips, in 154.8 seconds, including the unchanged
Swift compile probe (`/tmp/strideos-build105-final-tests.log`). Final backend
factory/runtime tests passed 49/49; all three Deno entrypoints typechecked.

Final full-suite result, source commit, EAS build, actual IPA inspection,
source-map upload, exact submission and Apple processing are recorded below
only after verification. Preparation does not establish an uploaded build.

## Completed baseline build; submission held

- Source `04158fc924692611e6f4bbef4b4ff9128f96ed2b` is committed and pushed.
  EAS build `d639ada9-80c2-413c-adb8-2f59da229b5a` finished at
  `2026-11-01T06:17:19.342Z` on Xcode 26.4.
- Actual IPA downloaded and inspected at `/tmp/strideos-build105.ipa`.
  SHA-256: `a9b296096ab6b9c9cce7578ba5c6c208351519a36e6b3900362f2aaca4634eb6`.
  Phone, Watch and Live Activity all use 1.0.0/105, intended identifiers and
  device SDKs. Deep/strict signatures and production entitlements passed;
  20 privacy manifests parsed and the compiled 1024px AppIcon is opaque.
- Decoded Xcode logs confirm Sentry source-map upload for
  `com.mooremovement.strideos@1.0.0+105`, dist 105. This is upload evidence,
  not consented-device symbolication proof.
- Fresh cloud Doctor found the SDK 56 Hermes memory regression and the dynamic
  config marker warning. These are distinct from npm's high-severity audit.
  The source/test pass does not clear this runtime warning. See
  `SDK57_RUNTIME_REVIEW.md`: an isolated supported SDK 57 candidate is being
  qualified, preserving this exact build as a baseline.
- **Build 105 has not been submitted to Apple.** The intended next beta candidate
  is Build 106 with the supported runtime fix, subject to its own checks. No
  Apple processing, TestFlight availability or public launch is claimed for 105.

Paid billing and general automatic deletion remain disabled pending intended-user
acceptance. Real provider revocation, native cleanup/restart, iPhone/Watch and
StoreKit purchase lifecycle, operational retention/support decisions and owner
App Store agreements/labels/details remain separate gates. No public launch is
claimed.
