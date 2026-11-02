# Build 109 — internal candidate

November 2, 2026. Canonical Developer checkout; production profile, version
1.0.0 / iOS build 109. Payments explicitly off. Internal TestFlight only.

## Source and preflight

- Implementation `7b5877e000dcef5d491ef0b29e47f24796d934ba`: safer native
  Apple sign-in/grant capture, deletion status handling, membership refresh and
  truthful email copy. Build 108 does not contain these source changes.
- Exact implementation source previously passed 1,581/1,581 tests, no skips or
  failures, semantic TypeScript, Expo compatibility, four Deno entrypoints and
  billing-off Hermes export. See `LAUNCH_SOURCE_VERIFICATION_20261102.json`.
- Build-number-only app change: 108 → 109. Semantic TypeScript and Expo
  compatibility rerun passed; no dependency, native module or scope changes.
- Separate Apple key `RZ49DF832J` installed and all four server setting digests
  matched. Seven fresh endpoint boundary checks, reviewer authentication and
  registration guard passed. Real Apple exchange/revocation remains untested.
- Local production environment execution cannot download EAS SECRET visibility
  values. Its observability check therefore reported missing SENTRY_AUTH_TOKEN.
  A fresh cloud environment inventory confirmed that variable exists as SECRET
  in production; it was not exposed or replaced. The real cloud pre-install
  guard must pass with cloud credentials; no sentinel or bypass was introduced.
- Signed-in Expo billing readback: existing Starter plan, $12 used of $45 build
  allowance. One medium build fits the observed allowance. No plan/add-on
  purchase or optional release-note service is authorized by this receipt.
- Public marketing/support/privacy/terms URLs returned HTTP 200. No URL/domain
  change or new hosting service is needed.

## Execution

- EAS build `eefedb6a-dee7-433a-a1fd-1bf8eb9ab5c3`, exact source
  `38e6d60dc7c536a564dc47269005d3d5f2776453`, finished November 2 at
  `15:31:29.728Z`. One production medium job; no duplicate build or bypass.
- Cloud observability pre-install guard and Expo Doctor 21/21 passed.
  Compilation completed with 0 errors and 33 warnings. Existing dependency,
  Live Activity `contentState` deprecation and script dependency warnings remain;
  none were suppressed. The packaging step was slow but completed successfully.
- Raw Xcode log confirms Sentry **Source Map Upload Report**, release
  `com.mooremovement.strideos@1.0.0+109`, dist `109`, and **File upload complete**.
  This is an upload receipt, not a native crash-symbolication acceptance test.
- Downloaded exact IPA: 129,566,670 bytes, SHA-256
  `aaf30393d7e234f819d34d5287641b730d00945f24426ad9135fa15f298b9e0e`.
  Host/Watch/Live Activity all report 1.0.0/109, valid deep/strict signatures,
  intended team and application IDs, and production signing. Apple sign-in,
  HealthKit, app group/APNs and purpose-string checks passed where applicable.
- All 21 privacy manifests parsed. Compiled 1024px icon is opaque. No credential
  filenames in the IPA; embedded bundle is Hermes bytecode. The framework's
  `CFBundleShortVersionString` is 1.0.0, **not an engine-version declaration**.
  See `BUILD109_ARTIFACT_VERIFICATION.json` for exact metadata/bundle hashes.
- Exact-build submission `e371e292-a467-4695-b986-f7a379122ac9` finished
  `2026-11-02T15:33:47.141Z`. Apple upload succeeded; initial processing/status
  read did not yet list 109. A subsequent official status read confirmed
  **1.0.0/109 VALID, IN_BETA_TESTING internally, not expired**, with exact matching
  EAS build/submission IDs. External state is READY_FOR_BETA_SUBMISSION, not
  external-beta approval. See `BUILD109_APPLE_ACCEPTANCE.json`.
- Internal availability is established; installation and device acceptance are
  not. Existing owner deferral of physical/purchase tests is preserved.
- The public draft initially selected old build 1. After 109 became available,
  main replaced only that draft attachment with 109 and saved. Manual release
  remains selected. No uploaded binary was deleted, and no public Add for
  Review/Submit for Review/release action has been performed.
  A full reload confirmed build 109, disabled Save (no pending edits), manual
  release selected and version 1.0 still Prepare for Submission. Browser proof:
  `/tmp/strideos-build109-draft-saved.png` (no review credentials in the image).

## Remaining public gates

Production SMTP is off and new signup remains closed. Verify confirmation and
recovery delivery/deep links before reopening. Actual Apple/Google deletion,
native GPS/Health/Watch/offline acceptance, reviewer navigation and current real
assets remain outstanding. AI vendor spending enforcement is unverified.
Purchase lifecycle testing is still deferred and required before charging.
General deletion automation and public payments remain off. No public review
submission or release is authorized by internal-candidate preparation.

Final narrow database readback: one deletion control row, automation disabled,
empty allowed-owner scope and zero active deletion-worker jobs. Installing the
Apple key did not activate deletion. A local run of the actual shared Deno signer
with the downloaded key verified its ES256 signature, expected Apple claims and
short expiry; no Apple token endpoint/revocation request was made by that check.

The owner questions still pending are existing SMTP-provider availability and
sign-in to the existing Anthropic API console. Neither absent response is
approval to create accounts, accept terms, purchase plans or invent credentials.
Native computer control was retried and still timed out; no new screenshot
capture build or paid workaround was started. Existing captures/library assets,
customer accounts and training history were preserved.
