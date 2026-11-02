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
A corrected build has not yet been queued or verified.

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
