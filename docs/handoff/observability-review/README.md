# PostHog And Sentry Integration

October 23, 2026. Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`. User authorized implementation, push, an iOS build and TestFlight submission. This source update includes the previously approved activity Work presentation. Activity spacing, refresh-button relocation, tutorial replay/redesign and Health recovery changes remain outside this release scope.

## Data Boundary

- Two independent, default-off choices in Settings > Privacy & Diagnostics. Consent is stored locally, account-bound, versioned and excluded from cloud training settings. Positive consent requires a successful storage write. Pending, malformed or unreadable consent stays off. Logout removes saved consent; other accounts cannot inherit it.
- Every runtime reconciliation requires current authenticated access, a matching consent owner and completed auth loading. Telemetry does not gate splash, auth, GPS task registration, training bridges or navigation. SDK imports/initialization occur only after consent.
- PostHog is manual-only. The allowlist is `app_opened`, `settings_opened`, `onboarding_completed`, and the existing feature-tour events. Tour properties are limited to a known tour ID, matching static version and optional fixed entry source; step contents and timestamps are omitted. `feature_tour_replayed` represents the existing replay request event, not proof a walkthrough appeared.
- No identity calls or persistent vendor identifiers. PostHog's random identifier is session-only. This supports basic usage/session and tutorial analysis, not cross-launch user retention or account-level funnels. No replay, automatic screens/touches/lifecycle events, person profiles, feature flags, surveys, push tracking, logs or exception capture. The transport permits only the exact ingestion batch endpoint and reconstructs its contents.
- Initial onboarding completes before the Settings opt-in and therefore is not measured for fresh installations. No pre-consent events are cached for later upload.
- The app-lifetime PostHog client has bounded SDK lifecycle listeners. Re-enabling resets its random identity and discards old queue entries. Session-specific event UUID permissions prevent stale in-flight/queued batches from crossing a consent boundary. Revocation cancels pending sends; old connections cannot disable a newer session.
- Sentry reports sanitized JavaScript exceptions only. Native SDK initialization/crash collection, sessions, tracing, logs, screenshots and view hierarchies are disabled. Original error messages, arbitrary context, users, requests, breadcrumbs and attachments are removed. Only fixed error classes, safe bundle coordinates, validated event/debug IDs and build metadata survive. Safe Hermes frame rewriting is preserved for later symbolication verification.
- Sentry's custom transport accepts error envelope items only, has no offline queue or retry path, and rejects redirects. Its flush waits for pending sends up to the specified deadline. Revocation gates transport and aborts pending requests before closing the captured client.
- Neither integration receives health/workout measurements, GPS, notes, photos/videos, coach messages, account identifiers or auth URLs. Server connections still expose network IPs to receiving infrastructure. No claim of anonymity or blanket legal compliance is made.
- Turning off cannot recall already transmitted data. If device storage cannot persist an off setting, reporting remains off for the current session, an error is shown, and a Save sharing off retry is provided. No persistence guarantee is claimed while all storage operations fail.

## Configuration Required Before Release

The initial source-only checkpoint had no service configuration. The user subsequently created both US-region projects and saved the private Sentry uploader credential directly in Expo. Current configuration, live policy publication and release checks are recorded in [Build 103 Release](../BUILD103_RELEASE.md). No agent accepted terms or purchased a plan.

Required production variables:

- `EXPO_PUBLIC_POSTHOG_API_KEY` and `EXPO_PUBLIC_POSTHOG_HOST`.
- `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT`.
- `SENTRY_AUTH_TOKEN`: build-only secret, never public configuration, committed source or app extras.

The production EAS pre-install hook rejects missing, malformed or placeholder values and source-map upload bypass settings without printing values. The runtime and hook share ingestion validators. These syntax checks do not prove correct accounts/projects or working ingestion.

Sentry's official Expo/Metro plugins are wired for source-map upload; existing Metro exclusions are retained. Source maps disclose app source to Sentry independently of athlete runtime consent. Validate the intended private project, uploader permissions, retention, IP handling and access settings before upload. Review/update the published privacy policy and App Store privacy disclosures; the edited `docs/privacy.html` is source only until publication is confirmed.

## Verification And Release State

- Focused privacy/consent/bridge/transport/guard tests: `/tmp/strideos-observability-focused-final.log`.
- Settings component browser preview: 12 checks passed across dark/light at 320/393/768 px, independent toggles and failed-save recovery; zero page errors or external requests. `/tmp/strideos-observability-browser.log`, `/tmp/strideos-observability-preview/receipt.json`. The preview uses actual UI and consent logic with in-memory storage, not live services or a native device.
- Initial full serial suite: 1172/1173 passed; the unchanged production Swift deadline probe reached its existing 30-second process timeout during concurrent validation. Isolated retry passed 5/5 without changing the timeout: `/tmp/strideos-observability-swift-retry.log`.
- Final serial suite after the review fixes: 1194/1194 passed, zero failures/skips, in 106.7 seconds (`/tmp/strideos-observability-full-final.log`). The final suite includes 45 focused consent, bridge, payload, release-guard and SDK-lifecycle cases. Both reviewers issued source-only GO, not vendor/native/release acceptance.
- Earlier typecheck and iOS Hermes export passed before the final review corrections. Export: `/tmp/strideos-observability-ios-export/`, bundle `entry-3ddef82cbe73b9de931bf9a66bcb5270.hbc`. These receipts are not a signed native build or final vendor verification.
- Final semantic typecheck passed (`/tmp/strideos-observability-typecheck-final.log`). Final iOS Hermes export passed after all review corrections: `/tmp/strideos-observability-ios-export-final/` and `/tmp/strideos-observability-ios-export-final.log`; 3,675 modules bundled. This is a JavaScript export only, with no live vendor configuration, not native compilation, upload or TestFlight acceptance.
- Clean iOS prebuild passed. Generated host is `ios/StrideOS.xcodeproj`; host, Watch and Live Activity identifiers/entitlements remain consistent. The SDK57/RN0.86 template recommendation warning also occurred for Build 102; this work retains SDK56/RN0.85. No native pods/linking/physical-device acceptance is claimed.
- Live `expo:check` reports seven existing SDK56 patch updates. Offline bundled compatibility reports up to date but is not treated as the live release gate. Align/review only the reported SDK56 patches and repeat release checks before building; do not upgrade to SDK57 to silence a template warning.
- Production preflight deliberately fails with the missing configuration names. Build number remains 102; remote history was checked and Build 102 was the latest completed artifact. No new EAS build or TestFlight submission has been started.

Next release gates: actual service projects and region; private build credentials; live synthetic ingestion and exact-artifact Hermes symbolication; SDK56 patch compatibility; native archive/privacy-manifest and App Store disclosure checks; fresh unused build number; exact source commit/build-ID/artifact match; Apple processing and tester-availability readback. Installed-device behavior remains unverified.

## Reproduce UI Checks

```sh
node docs/handoff/observability-review/build-preview.cjs
node docs/handoff/observability-review/check-preview.cjs
```

The second command needs Playwright on Node's module path. The fixture starts and closes its own temporary server/browser; it cannot send vendor data.
