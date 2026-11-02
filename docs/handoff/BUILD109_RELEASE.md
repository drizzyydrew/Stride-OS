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

Record the exact build ID, submitted source revision, signed-artifact identity,
upload result and Apple/TestFlight state here after verification. A queued job
or source check is not an accepted archive or tester availability.

## Remaining public gates

Production SMTP is off and new signup remains closed. Verify confirmation and
recovery delivery/deep links before reopening. Actual Apple/Google deletion,
native GPS/Health/Watch/offline acceptance, reviewer navigation and current real
assets remain outstanding. AI vendor spending enforcement is unverified.
Purchase lifecycle testing is still deferred and required before charging.
General deletion automation and public payments remain off. No public review
submission or release is authorized by internal-candidate preparation.
