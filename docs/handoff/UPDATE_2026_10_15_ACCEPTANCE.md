# October 15 Candidate Acceptance

## Implemented Capability Map

| Request | Candidate path |
| --- | --- |
| Established login remains usable offline | Owner-bound local access, explicit logout fence, retryable transport errors distinct from invalid identity; cloud access still requires valid credentials |
| One saved run per recording | Exact recording/source lineage, durable completion/discard journals and serialized Activity persistence; no fuzzy merging of nearby legitimate runs |
| All outdoor sports | Running, walking, hiking, cycling, downhill skiing, XC skiing, snowboarding, ski touring and snowboard touring |
| Consistent active screen | Shared map-first presentation, units-aware metrics, watch state, pause/resume and Finish; existing Training Run presentation preserved |
| GPS recovery | Permission request when possible, otherwise actionable Settings guidance and Settings link |
| Live phone/watch data | Shared native identity/control contracts, exact End cleanup, timestamped HR/cadence/power, native Live Activity freshness; actual sensor availability required |
| Outdoor post-workout review | Route/profile scrubbing with time, distance, altitude, grade, HR and available cadence/power, splits and recorded summaries |
| Snow summaries | Conservative inferred ascent/descent/idle segments, peak/longest/vertical metrics from vetted observations; raw route retained |
| Running cadence | Phone motion, Watch or supported foot pod, with explicit SPM rather than cycling RPM |
| Power | Experimental live outdoor cycling road-load estimate with confirmed mass; sourced post-workout cycling and running metabolic estimates; hiking climbing-work component |
| Explicit navigation | Stack swipe-back disabled; fixed two-chevron Back with light brown/blue and dark clay; draft/active-session guards retained |
| Recoverable overlays/tours | Top-left down chevrons, slide dismissal, outside-card cancellation, independent tour Close/fallback and stale-target invalidation |
| Sharing | Actual outdoor route only in Story; compact equal-margin Square layout; optional provenance-labelled power |
| Approved badges | Approved families integrated, future 5K Month retired, historical earned records retained, 150K/200K remain canonical |

## Deliberate Boundaries

- No competitor artwork, branding, copied screen layout or proprietary algorithm.
- Local GPS and connected sensors do not require cell service. Downloadable
  offline basemaps were not added; missing tiles do not stop recording.
- Power estimates are not meter measurements. Running metabolic watts are not
  cycling crank watts or wearable mechanical power. Unsupported sports do not
  receive invented total-human-watts or power badges.
- Health reads/imports use available relevant non-swim data. This is not complete
  quantity-write parity: original phone/BLE sensor series are retained locally,
  not newly exported as every Health quantity. Native Watch workout samples
  remain native Health records. Estimated power is never written as measured.
- Legacy duplicate records without exact lineage are not destructively deleted.
- No public App Store release or new external tester invitations are authorized.

## Device Acceptance Still Required

Source/VM tests and browser component inspection are not device certification.
On an actual iPhone/Watch, verify offline cold/warm launch after prior sign-in;
phone lock/background GPS; denied-location Settings recovery; HR/cadence freshness;
simultaneous/delayed phone/watch/Lock Screen End; one history item after Health
round-trip; treadmill distance confirmation; two nearby legitimate workouts;
tour escape and Movement Lab scrub; native map follow/gesture behavior; VoiceOver;
and the installed TestFlight binary. Power model accuracy needs field comparison
against a calibrated reference, not just successful arithmetic tests.

Release IDs, final test totals and Apple processing states belong in the release
record once actually verified. No successful upload or tester availability is
claimed by this document alone.
