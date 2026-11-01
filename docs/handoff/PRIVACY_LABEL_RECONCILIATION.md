# Privacy label reconciliation — November 1, 2026 Pacific

Read-only source review against native Build 106 (`13feb93`) and current source
`dcc8120`, plus a live App Store Connect inspection. Independent platform and
contrarian agents reviewed the classifications and cross-examined their findings.
This is engineering preparation, not legal clearance or observed customer traffic.

## Live state and action boundary

The app remains **1.0 Prepare for Submission**. The App Privacy page says
**Published 4 months ago** and lists 11 types: Health, Fitness, Name, Email Address,
Other User Contact Info, Photos or Videos, Other User Content, User ID, Hands,
Head and Precise Location. All are linked except Precise Location. Name has
Personalization and Functionality purposes; the others show Functionality.

The location editor was advanced with the proposed linked answer and its existing
Functionality/no-tracking answers. Its final action is **Publish**, with no
separate save-draft action. The editor was **cancelled**: no privacy-label answer
was published or saved. This file is the reviewable draft. Do not describe the
location correction as applied to Apple's label.

## Proposed answers and remaining evidence

| Type | Proposed treatment for 106 | Evidence / unresolved point |
| --- | --- | --- |
| Precise Location | Collected, **linked**, Functionality, no advertising tracking | `src/types/activity.ts:110` defines precise coordinates; `src/lib/syncService.ts:130` backs up the whole activity with `user_id`. This is a definite correction. |
| Health / Fitness | Retain collected and linked, Functionality | Account-bound activity, strength and check-in backup. Review Personalization too where retained AI context is used for tailored advice. |
| Name / Email / User ID | Retain linked | Authentication/cloud ownership and personalized Coach context. Do not claim an unused profile-sync helper proves profile backup. |
| Photos or Videos | Retain linked, Functionality | Signed-in Add Video uploads original bytes through `movementVideoStorage.ts`; the account owns the storage path. Local still analysis is a distinct path. |
| Other User Content | Retain linked | Coach messages, athlete notes and selected movement findings are transmitted. Review Personalization and provider retention; do not assume an immediate-service exemption. |
| Product Interaction | Add to the draft | Account-scoped daily AI counts support linked Functionality; optional PostHog allowlisted app/tutorial events support Analytics. One app-level type must account for both paths. See `20261031150809_launch_privacy_and_coach_limits.sql` and `posthogClient.ts`. |
| Other Diagnostic Data | Add to the draft; linkage unresolved | Sanitized JS types, bundle code locations, optional event timestamp/ID and release/build are sent to Sentry. No account UUID or original message is in the reviewed payload. Vendor IP retention/correlation still needs verification. |
| Crash Data | Add as a source-supported draft candidate; linkage/exemption unresolved | The installed Sentry JS handler captures fatal exceptions. Sanitization removes mechanism details but retains the exception and stack coordinates; changing severity to error does not change the originating failure. Native capture being off does not justify omission. |
| Hands / Head | Propose removing from the source-backed draft after the bounded outbound inventory below | Local pose storage is not collection; uploaded video is media. No normal 106 writer or Coach serializer was found transmitting dedicated structured hand geometry or head movement. This is not a runtime guarantee for unexpected historical fields. |
| Other User Contact Info | Identify the actual field | No dedicated additional contact transmission was established by the bounded review. Generic free-text notes alone do not establish that the app solicits another contact type. |
| Purchase History | Reassess before billing activation | 106's production billing flag is off. RevenueCat's account-bound SDK configuration exists but is gated; package presence alone does not prove collection in 106. |

PostHog uses a random session-only distinct ID, memory persistence and a payload
allowlist. Neither randomness nor omission of an account UUID proves anonymity,
and the session token is not automatically a Device ID. Likewise, transport IP
exposure alone does not establish a location or identifier category: retention,
use, enrichment and correlation matter. No advertising tracking was demonstrated
in the reviewed paths; this is not a full vendor contractual audit.

Ordinary optional disclosure requires **all** Apple criteria, not just opt-in.
Apple's separate Product Improvement Program exemption also requires exclusive
improvement purposes, reversible opt-in, unchanged functionality/cost and
unlinkability. Source-only payload scrubbing does not establish those vendor
guarantees. Keep the proposed disclosures in the draft until an exemption is
substantiated. The Sentry org currently redirects to its login page; its live
IP-retention setting was not verified or changed.

## Structured body-data inventory

The additional platform pass inspected the complete normal activity/workout/
strength/custom/check-in record shapes, profile helper and goal-archive builder,
Movement persistence/uploads, Coach serializers and measurement allowlist, and
telemetry reconstruction. No reachable normal 106 path was found transmitting
dedicated hand geometry/movement or head movement. `poseSequenceStorage.ts:23`
writes local JSON. `movementVideoStorage.ts:94` uploads video bytes rather than
structured pose data. `measurementMatrix.ts:84,303` admits knee, hip, trunk,
elbow, shoulder and pelvic/frontal measurements and rejects unlisted names.
Coach's selected findings include arm symmetry and exercise cues, not raw pose
landmarks, hand geometry or head-motion measurements.

There is indirect derivation: elbow angles use wrist coordinates and signed hip
motion uses nose/neck orientation (`poseAngles.ts:95,117`). The transmitted
results describe elbow/hip measurements, which does not itself establish Apple's
Hands/Head collection. Conversely, whole-object backups do not strictly filter
unexpected historical properties. The proposed removal applies to reviewed normal
writers, not arbitrary notes/chat, malformed objects or unknown older records.
No Apple Body declaration was changed during this inventory.

Contrarian cross-review accepted this bounded draft removal with no must-fix
within its scope: **No reachable build-106 structured Hands/Head export found
in supported writers; unexpected historical properties in whole-record backups
remain unverified.**

The cross-review also clarifies that operational usage counts record request
reservations/attempts, not necessarily successful conversations: allowance is
reserved before the provider response. They cannot inherit a telemetry-only
optional-disclosure exemption. Personalized AI prompt use is source-supported;
processor retention is a separate outstanding fact.

## Apple sources

- [Data types, linkage, purposes and disclosure exemptions](https://developer.apple.com/app-store/app-privacy-details/)
- [Managing app privacy and publication](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)

Reconcile the app-level label against the actual available version and every
distributed platform, not only an internal TestFlight build. Keep the exact
binary, source preparation, vendor configuration and published declarations
separate. Do not publish a partially reconciled label as a completed privacy audit.
