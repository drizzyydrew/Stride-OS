# Build 126 membership and policy source audit

Source-only checkpoint. Nothing in this record changes Build 125's pending App Review submission or publishes the edited policy pages. Root coordinates build, release, service and publication decisions separately.

## Implemented source scope

- Dedicated Membership comparison for Free/Pro; current localized subscription purchase/restore flow preserved, simplified active status, life-change adjustment copy, lower Restore/manage links. Extra-message purchases are explicitly unavailable in this build pending their separate approval/activation.
- Shared capability IDs for custom routes, structured/reusable custom workouts, schedule changes and forecasts, alongside existing personalized-plan/rebuild/Movement Lab gates.
- Every Movement Lab feature route, including existing saved detail/playback/results, is behind active Pro. Expiry never deletes records. Separate free data controls export records and available local/cloud originals and delete saved items; no playback/results UI is rendered there.
- Verified RevenueCat entitlement expiration is retained, checked synchronously and observed by an expiry timer. Owner-keyed feature children are discarded when the owner changes. A verified same-owner refresh preserves draft state; mutations still await fresh access and recheck before commit. Store-reported grace extensions are represented by the entitlement expiration.
- Custom route/run builders are deep-link gated and save behind fresh checks. Saved custom running templates cannot be newly selected/restored or started after access ends. New custom starts recheck after the location-permission gap. Existing active recordings can continue, pause, finish or stop.
- Forecast cards, details and modal contents are gated on dashboard and Performance. Historical Scores remain available.
- Ordinary ad hoc exercise logging, GPS/open recording, history, calculators, exercise instructions and sharing remain outside these added paid boundaries.

## Public policy source corrections

`docs/privacy.html`, `terms.html`, `support.html`, and `index.html` are edited source drafts only, not published pages.

- Removed the active Strava integration/upload claim. Repository search finds OAuth/upload definitions in `src/lib/strava.ts` but no app/component call site. Legacy credential cleanup and old handoff records remain untouched; dormant code is not proof of an active integration.
- Retained disclosures for actual supported Supabase, Resend, support Gmail, Anthropic, HealthKit, optional PostHog/Sentry, and RevenueCat paths.
- Added previously missing coordinate-processing disclosures for Open-Meteo weather/air quality/elevation, OSRM/OSM routing, Mapbox native maps/offline maps and platform geocoding. Evidence: `src/lib/weather.ts`, `src/lib/routing.ts`, `src/components/maps/MapComponents.native.tsx`, `src/lib/mapboxOffline.ts` and training map code.
- Updated Movement Lab retention/access distinctions, free owner data controls, and future capability descriptions. The owner's latest instruction expressly includes already-saved Movement Lab items; the older saved-content-free language is superseded in this draft, not rewritten in historical release records.
- Described per-message 24-hour StrideOS history expiry, foreground physical cleanup, and persistent explicit profile/goals/training context without automatic chat memory. Provider retention is separately disclosed; no universal 24-hour deletion claim is made.

## Verification and limits

Focused membership, access, subscription lifecycle and owner-boundary tests passed. New behavioral tests exercise inactive/cross-owner denial, expired access during refresh, free export single-flight, account switch during local/cloud export, and expiry/unmount during route save. Root's final aggregate typecheck/tests/native verification remain authoritative after all lanes merge.

No provider policy, native telemetry, deployed Storage RLS, physical-device playback/share sheet, or current store metadata validation is implied by this source audit. Mapbox is used in native source; the inspected component/config does not show a telemetry-disable call. Its actual SDK/service collection and Apple privacy-label correspondence require release review rather than treating the PostHog/Sentry toggles as proof about Mapbox.

Cloud-only media export needs a current owner session and internet; local exports require the original file to exist. Exported copies remain under the user's control. No external services were accessed by running these export/deletion paths during this task.
