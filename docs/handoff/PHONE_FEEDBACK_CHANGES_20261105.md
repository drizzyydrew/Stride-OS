# November 5 phone feedback corrections

Scope: implement the owner's archive, feature-tour, race-result, PR-form, Watch
permission and release-diagnostics requests in the canonical Developer checkout.
These are source changes for a later candidate. Installed phone build 111 and
its already reported Watch control/save pass do not include these corrections.

## Archive navigation

The listed archive and its detail screen used the same owner-scoped store, but
the detail screen compared a stored percent-escaped ID with an ID decoded again
by Expo Router's `useLocalSearchParams`. The installed Router implementation
reproduces the mismatch. This is a navigation bug, not evidence that the saved
training activities or archive snapshot disappeared.

New links transport an opaque URL-safe archive key. Legacy decoded links resolve
only if exactly one already visible owner archive matches. Malformed, ambiguous,
foreign-owner and absent archives stay unavailable. This change does not rewrite
archive IDs, recreate training history, change frozen totals, or bypass ownership.
Opening the owner's actual archive remains a future device check.

## Feature tours

Targets now reveal through their nearest vertical scroll container and remeasure
after layout with bounded retries and cancellation. Real measured targets have a
yellow `#FFD84D` outline. The callout offers explicit, safe navigation taps for
Running Active, Calendar views, Strength areas and earned-badge details. It never
starts, saves, deletes or publishes a workout/badge on behalf of a tour.

Compact Today temporarily reveals the Forecast during its tour step without
changing the saved experience setting. Missing conditional content is explained;
nonexistent targets were replaced by existing sections. Outside-tap dismissal,
Skip, Back and route-exit cancellation remain. A continuous walkthrough across
arbitrary route changes is not implemented; current guided actions use subtabs
or end at a final detail action, and leaving the route dismisses the tour.

Local browser fixtures use the actual provider/target/scroll components. An
offscreen target scrolled 900 points into view with a measured yellow outline;
Next highlighted the next actual fixture and Close removed the overlay.
Native safe-area, large-text and scroll geometry still need candidate-device QA.

## Race results and calibration

Activity Log/Edit now has an optional Race or Time Trial section for running.
It requires a completed event date, event/course distance and explicit elapsed
finish time. These are separate from recorded GPS distance and active time.
An already saved run can be marked via Activity detail → Edit. Historical live
Race-mode records contain tempo/notes rather than structured official results;
the app does not infer a finish time or race distance from those notes.

Manual profile PRs, explicit archived race results and marked Activity results
feed source-linked performance records. The first valid result at each exact
event distance is a personal best; a faster result becomes the best while older
results stay in performance history. Current-fitness calibration still considers
the latest valid performance rather than forcing an old lifetime best into the
current prediction. Corrections/removal/partial status/sport changes withdraw
derived evidence without rewriting manually entered PRs or raw activity metrics.

The foreground reconciler refreshes VDOT, pace zones, race predictions and
calibration context from current owner inputs after hydration. It uses serialized
writes, stable signatures and bounded persistence-error retries. Invalid/future
PRs do not drive calibration or inflate confidence. Generic legacy custom-log
durationMinutes is not promoted to elapsed race evidence; those logs can still
contribute training-history context.

Direct entry into Activity/Profile loads the existing owner-scoped archive
collection without creating new archives. After reads, ownership/hydration and
current profile edits are rechecked. A missing linked archive with unconfirmed
sync state (local, syncing or error) cannot erase a saved derived result; it
preserves the profile and retries with bounded backoff. Present local archives
still support offline result edits. Confirmed synced absence can withdraw a
source-derived result.

HRmax/resting-HR fields and HR formulas are unchanged. A race finish time cannot
establish measured HRmax. Manual measurements and the existing age/threshold
methods remain their sources. Today Performance Forecast is a load/readiness
trajectory; the reachable race-time predictions use profile calibration.

## PR entry layout

The finish-time and date fields are stacked at full card width, preventing the
date label and digits from collapsing into the vertical column in the screenshot.
Added accessible field/action labels, selected distance state, strict elapsed-time
validation, per-distance Personal best labels and links to edit derived sources.
The existing calendar was exercised in a local fixture at 390 and 320 widths;
date selection remained readable and future dates remained disabled.

## Health setup and diagnostics

The Watch Enable Workout Metrics button is removed. The existing iPhone Apple
Health setup/review action requests supported phone scopes and queues an explicit
Watch Health setup request. Already-connected users can tap Apple Health's
Connected control → Review permissions. No separate metrics setup button is needed.

The Watch persists/deduplicates/expires request tokens and presents its permission
sheet only when foreground and idle, after an outstanding location prompt. It
does not auto-launch a workout or change latest workout context. A start attempted
during the sheet asks the user to finish permission setup and retry; the phone can
keep recording. Request processing is never represented as all read grants being
approved or all sensors producing measurements. Old native modules fall back
without breaking phone Health setup. Watch Health purpose text now covers the
measurements the user chooses to share and completed-workout saving.

The normal Watch startup authorization, watchdog, workout creation and pause/
resume/end implementations are preserved. Independent platform and custody review
each scored this bounded change 96/100 subjectively; this is not a measured device
success probability. Comparing against watch-working-build90 retained its four
baseline read types and workout-write scope. The updated unsigned Release Watch
target compiled/linked/validated for arm64_32; the new source was included.

Raw Watch Sync details/start-trail UI is DEBUG-only. The phone settings toggle
and both Running diagnostics renders are also development-only, including when
an old persisted toggle is true. Useful connection status, retry and error messages
remain. This implements the owner's request to remove troubleshooting details
from the release UI; do not restore them for launch. The Release Watch binary was
checked for absence of the removed button and Sync details labels.

## Badge follow-up retained

The catalog contains fastest 1K/mile/5K/10K entries, but the existing PR evaluator
does not award those from race-result records. There is no generic new-race-PR
celebration or half-marathon/marathon race-speed award wired. Do not tell the owner
one will pop up. The owner requested being told if absent so a separate badge can
be designed; no new art or award rules were invented in this correction.

## Validation and next candidate

See `PHONE_FEEDBACK_VALIDATION_20261105.json` for final automated results and the
online Expo compatibility recommendation. Dependency versions and app build
numbers are unchanged. No EAS build, installation, Apple submission, public
release, production backend mutation, account reset or personal-history repair
was performed.

The online Expo compatibility check now recommends newer SDK-57 patch versions:
expo ~57.0.32, asset ~57.0.21, constants ~57.0.23, image-picker ~57.0.21,
location ~57.0.23, notifications ~57.0.25, router ~57.0.30, splash-screen
~57.0.11 and task-manager ~57.0.22. It exits 1 for these recommendations. An
offline check against the installed Expo 57.0.31 bundle reports up to date and
warns that offline validation is unreliable. These are distinct results; do not
report the online check passed. Patch-version alignment remains a separate next-
candidate preparation item; dependencies were kept stable during these fixes.

Next candidate device checks: open the actual listed archive; run tours in compact
Today and the named subtabs with scrolling/large text; add/edit/remove a confirmed
race result and inspect PR/VDOT/predictions; review Health permissions with Watch
idle, active and initially closed; deny individual scopes and confirm useful
fallback; verify optional measurements only when actual authorized samples exist;
repeat basic phone/Watch start, pause, resume, stop and exactly-one saved session.

Local previews (synthetic data, actual production components with environment
fixtures; not screenshots of an installed candidate):

- [PR form at phone width](update-2026-11-05/pr-form-390.jpg)
- [Tour reveal and yellow outline](update-2026-11-05/tour-390.jpg)
