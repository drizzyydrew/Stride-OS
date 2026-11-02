# Native capture startup finding — November 1, 2026

## Observed failure, not a screenshot acceptance

The owner requested genuine native screenshots. Simulator capture build
`05c212a2-9c70-4da6-886e-e79b6470ac81` finished from source
`227da64ee1ba7f28dfce31bb0d3567358c68c763`, based on native Build 106 source
`13feb937c5c94d223635ab9509ab1090ba7f0d2b` plus capture tooling only.

The downloaded archive SHA-256 is
`65c2db2d8b8a23ed751f003be3573d413e24f397f4141f86c76c865acfd95c8f`.
Static inspection covered 20 Mach-O files / 40 architecture slices, including
phone, Live Activity, Watch and 16 frameworks. Simulator platform, x86_64/arm64
and minimum OS checks passed. This is not physical-device acceptance.

On this Intel Mac (Xcode 16.4), a new iPhone 16 Pro / iOS 18.6 simulator required
one normal restart after first-boot migration. Installation then succeeded.
An initial CLI launch timed out, but OS logs subsequently recorded successful
process creation and foreground activation. Actual native sign-in eventually
rendered. A process sample showed UIKit resource I/O and system-service waits;
no source change was justified merely by the slow launch.

A new ordinary synthetic account was provisioned through Supabase's server-side
Auth Admin API on the existing StrideOS project. Its password login and own
profile read succeeded. No email was sent, no existing account was changed,
and credentials remain owner-only outside Git. The temporary owner account-form
request was withdrawn; that form was closed without submission.

Native password sign-in then returned:

> Existing local training data has no verified owner. Restore a verified account
> backup or explicitly resolve ownership before continuing. No history has been
> moved or deleted.

This installation had received no onboarding, Health import, workout, profile
or other user training entry. Read-only inspection of its AsyncStorage manifest
found only:

- `integrations-store`: startup preferences, no connected account;
- `activity-store`: schema marker and an empty activities array;
- `athlete-store`: the embedded default athlete snapshot, written during startup.

No native or web state was injected, owner marker reassigned, storage cleared,
or existing record deleted to pass the gate. The failed simulator and a local
failure screenshot were preserved. No new store image was uploaded or accepted.

## Cause and scope of correction

`athleteStore` unconditionally recalculated recovery after hydration, including
when storage returned no record. Recalculation calls Zustand `set()`, which
persisted the seeded defaults. Ownership discovery correctly treated that
persisted athlete record as unclaimed data and refused first login.

Two separate agent source reviews agreed to prevent the startup write at its
origin. The correction must use actual read provenance, preserve compatible
legacy records and passive recovery behavior, protect failed/unsupported reads,
and preserve genuine edits made while a successful empty hydration is pending.
The ownership guard and athlete defaults are not loosened or reclassified.

Focused tests exercise actual Zustand persistence and ownership discovery,
including both hydration/discovery orderings, existing unowned/default-looking
records, verified-owner decay, cross-account conflict, unreadable data, later
setters after rejected hydration, and edits made during an initially empty read.
The producer fix is implemented. An independent agent re-review reproduced and
then verified fixes for rejected-record writes and overlapping hydration edits.
All 21 focused tests and 57 existing ownership/offline tests passed, and the
reviewer identified no remaining must-fix in this scoped change. The final broad
run passed **1,447/1,447 tests**, with no skipped tests. TypeScript semantic and
Expo dependency checks also passed. No native fix acceptance is claimed by
local checks alone.

## Retest environment and remaining boundaries

The first phone `C95E7869-1F81-4B5E-9E46-6FDAFD629F7E` is preserved and shut
down. Fresh retest phone `8AF50910-CFC6-496F-85AC-E32BCEFD179F` is named
**StrideOS Screenshots 107**, iPhone 16 Pro / iOS 18.6. Build number 107 and a
reusable simulator Release profile are prepared in source, with client billing
off. Generated local host/extension build identities were also synchronized to
107, without weakening their assertions. The first broad regression run passed
1,443 of 1,445 tests; its two failures were stale generated build 106 settings
and a 30-second standalone Swift compiler timeout. The build settings were
corrected, and the unchanged Swift deadline assertion passed in isolation and
in the final serial broad run. No assertion or timeout was weakened.
Corrected simulator build `4e4061e5-6bf2-4eaf-9ae0-f6fe203a8a2e` was then
queued from pushed source `3e1513c8cd6dfbe8e75139d1a83ab9bd1154b72a`.
Resolved configuration verifies simulator=true, Release, medium, pinned Xcode
26.6, build 107, autoIncrement=false and client billing=false. No automatic
submission was requested. The build subsequently finished; the scoped native
retest receipt follows below.

The fresh 107 phone's first migration reported a system migration failure before
app installation. One normal shutdown/boot was used to retest that blank device;
no app data was erased. Its new paired Watch Series 10 46mm / watchOS 11.5 is
`B1B4402E-15FF-4464-B079-44728A650634`, pair
`D3444B4C-44E0-4CC0-A2B4-D7536BD281FD`. The original 106 phone/Watch pair is
preserved. These environment steps do not establish corrected app behavior.

The existing EAS Starter allowance had $41 remaining before the first capture
build; no plan, add-on or domain was purchased. Post-build billing readback still
shows the existing $19 plan estimate, with usage reporting potentially delayed.
Remote EAS Simulator availability returned `available: false`; no remote
session was started. Use the local environment and existing build allowance.

Replacement images must show the actual corrected native candidate and fictional
entries through ordinary UI. A source fix, passing local test, successful
installation, splash screen or sign-in form is not the completed marketing set.
Phone/Watch hardware, billing lifecycle, privacy declarations, App Review and
public release remain separate gates.

## Corrected native retest and capture receipt

Simulator build `4e4061e5-6bf2-4eaf-9ae0-f6fe203a8a2e` finished from
`3e1513c8cd6dfbe8e75139d1a83ab9bd1154b72a`. Downloaded archive SHA-256:
`794deb831b29efb3d74e1143b282b0235a69f74253fa3b0e10b2457f401d8db3`.
Host, Live Activity and Watch plists identify 1.0.0/build 107 and the correct
Simulator platforms. Host and Watch installation succeeded.

Before native login, a read-only inspection of the fresh phone's manifest found
only `integrations-store` and `activity-store`; **no athlete-store snapshot**.
The synthetic account then signed in successfully, reached onboarding, and
completed all steps through normal UI. General Running, default fictional
physiology, no recent PR, beginner strength and no injury were selected. The
nickname field was populated with Demo Athlete. Location access was declined;
no Health history, personal backup, routes or media were imported. Today and
Calendar rendered. The first-login ownership failure was not reproduced.

Normal Log Activity saved a fictional 45-minute/4.5-mile/RPE-5 run and a
90-minute/3.2-mile/800-foot/RPE-5 hike. Both appeared in history with loads
225 and 450 (total 675). No HR/GPS readings were entered. Hike notes explicitly
identify the fictional, manually entered data. Work correctly withheld its
estimate because an explicit profile weight was absent.

Four unmodified native 1206×2622 PNGs were exported with Simulator Save Screen;
the originals and hashes are in `docs/assets/screenshots/native-107/manifest.json`.
Calendar and Activity history passed independent agent visual review for draft
placement. Running detail is held: an unlinked manual entry misleadingly says
Completed as prescribed. Strength presets also passed agent visual review for
draft placement, supporting preset browsing rather than completed lifting. Today is
excluded due to the hardcoded Drew greeting discovered during capture. Source
corrections are separate from the installed 107 binary and require a later build
and recapture before claiming those screens corrected natively.

This establishes fresh-install login, onboarding and two manual save/readback
journeys on the stated Simulator. It does not establish physical-device,
Watch-transport, Health/GPS, account-switch, backup/deletion, billing or release
acceptance. No native state was injected and no personal data was cleared.

## Follow-up source corrections, not installed-build acceptance

The actual capture journey also exposed hardcoded personal/demo copy. A scoped
patch now uses the active profile name for Today and Settings, removes the
fabricated five-year/2,814-mile Settings history, corrects the account-required
onboarding disclaimer, and softens unsupported injury-prevention/diagnosis
promises. Activity summary shows Manually logged for an unlinked manual entry;
prescription comparison requires a real scheduled-session link. Saved records
are not rewritten and linked completion classifications remain visible.

All **67 related tests** and the full semantic TypeScript check passed, including
four new behavioral cases built from actual manual-entry defaults, unlinked
metadata, every linked classification, and a linked legacy record without a
classification. Whitespace checks passed. A condensed React review found no
new network requests, effects, conditional hooks or accessibility-control changes
in the patch. Installed 107 predates these follow-up source edits. A subsequent
native build and affected-screen recapture remain necessary.
