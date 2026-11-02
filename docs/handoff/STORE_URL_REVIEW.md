# Store URLs and marketing tools — November 1, 2026 Pacific

## Completed URL review

| Purpose | Existing URL | Result |
| --- | --- | --- |
| Marketing | https://drizzyydrew.github.io/Stride-OS/ | HTTP 200; homepage corrected and published at the same URL |
| Support | https://drizzyydrew.github.io/Stride-OS/support.html | HTTP 200; support/contact and account-help content present |
| Privacy | https://drizzyydrew.github.io/Stride-OS/privacy.html | HTTP 200; existing corrected policy preserved |
| Terms | https://drizzyydrew.github.io/Stride-OS/terms.html | HTTP 200; existing terms preserved |

The addresses themselves are functional. The old marketing destination was the
problem: two App Store download buttons used `href="#"`, older screenshot exports
were displayed, and the Movement Lab wording implied overly broad private cloud
storage. The updated page states private iOS beta/no public download or open
signup, uses working feature/support links, and describes current tracking,
strength, check-in, optional goals/open training, archives and limited AI/media
behavior. Check-in copy was corrected to the actual sleep duration/quality, body,
energy and stress fields after independent review.

The same public URLs can remain in App Store Connect. No URL value was changed
merely to create the appearance of work; no App Store, TestFlight or Android
download link was invented. The owner explicitly chose **Keep the existing free
URLs**; existing hosting is retained.
No domain, hosting plan, ads, SDK or new paid service was bought. A later
simulator-only native capture build uses the existing EAS build allowance;
its exact preparation and acceptance boundaries are recorded below.

## Source, publication and verification

- Canonical source commit: `ce7a5085710dfce686f8de85ffcef7243ffbb162`.
- Existing GitHub Pages configuration was read back: branch
  `claude/stride-os-visibility-sxl7xl`, `/docs`, `cname: null`.
- Published separately as `b74f82fac1a2e38909c51d552a135314e83f8c08`.
  The publication worktree diff/commit contains **only `docs/index.html`**;
  privacy, terms, support, native source and other public files were not changed.
- GitHub Pages subsequently read back **built**, at that publication commit,
  with no error. The live page's rendered state was also inspected.
- Uncached public GET returned HTTP 200 with exact byte equality to the new source.
  SHA-256: `006590370d3494e8400a8ca66e2198b3722a13216bb4b87f80c98fb1bdf81454`.
  Title: `StrideOS — Run, Lift, Recover · iOS beta`.
- Local rendered desktop and phone review passed. DOM checks at 1280, 768, 393
  and 320 px show no horizontal overflow. All 13 anchors have valid targets;
  skip-link keyboard focus has a visible outline. Zero scripts, external font
  requests or old screenshot references. This is a bounded web review, not full
  accessibility certification or native-device QA.
- Independent product/copy and contrarian/platform passes cross-examined the
  page. The check-in-copy must-fix was resolved; no remaining homepage must-fix
  was identified. The scope is a prelaunch information page, not a cleared store
  screenshot set or public app release.

## Apple tools — what to use and when

| Item in the owner's photos | Decision |
| --- | --- |
| Asset Library | Use now to manage the real screenshot set. Its colorful Get Started popup is Apple's example artwork, not StrideOS assets to redesign. The 12 files in the table are StrideOS's historical assets. |
| Custom Product Pages | Later, for real audience/campaign needs such as running-focused versus strength-focused links. First finish one accurate default page. A custom page is an alternate App Store listing with its own shareable URL, not a new app or backend. |
| Product Page Optimization | Later, after the base listing is accepted and there is sufficient traffic for a meaningful comparison. Test one hypothesis with a small number of variants; don't start an empty or underpowered test now. |
| Creative header / search artwork | Optional later. Different placement rules do not turn a brand-only card into an acceptable app-in-use screenshot. |
| Routing App Coverage File | Leave blank for this scope. Source has no Apple Maps directions-provider registration; recording/planning fitness routes alone does not establish that this is an Apple routing-provider app. |

Sources: [Apple Asset Library](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets/),
[custom product pages](https://developer.apple.com/app-store/custom-product-pages/),
[product page optimization](https://developer.apple.com/app-store/product-page-optimization/),
[version fields and URLs](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/).

## Asset actions and remaining work

Live readback found **12** June 22 assets: five iPhone, three iPad and four Watch.
The selected `01-hero.png` is a 1242×2688 brand/headline card with no app UI,
placed in version 1.0 / en-US. Its placement was removed through Media Manager;
Apple's confirmation explicitly says the file remains in Asset Library.

After a fresh page reload, the source-size iPhone sequence shows **4 of 10**:
`04-analytics.png`, `03-training.png`, `05-appearance.png`, `02-readiness.png`.
The scaled sequence also omits the hero. Reopening its exact library identity
`f4c00019-4492-8222-803a-3aa17d69548b` still shows `01-hero.png`, its original
dimensions and the asset preview. No library file was deleted, and no asset or
app was added for review. See Apple's [app-in-use screenshot rule](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata).

The other historical images are **not accepted as current** by this cleanup.
`STORE_ASSET_REFRESH.md` supplies an evidence-backed 6-iPhone / 3–4-Watch capture
storyboard and a conditional iPad plan. Current `app.json` has `supportsTablet:
false`; do not expand platform support or pretend old iPad exports demonstrate
native tablet acceptance. Required device-size slots must be checked against
the accepted binary and current Media Manager.

The full replacement needs genuine native candidate captures with fictional
account data, original dimensions and a recorded build/source. No AI-generated
interface, photo of a monitor or web reconstruction is passed off as a native
screen. Original media and previous files remain preserved until replacements
are captured, reviewed and placed. Purchases, deletion, physical phone/Watch QA,
privacy/regulatory declarations and public release remain separate gates.

## Genuine native capture continuation

The owner explicitly requested replacement images from the actual app.
No reusable EAS Simulator build exists. A fresh live Expo billing readback shows
the existing Starter plan, $4 of $45 build credit used and $41 remaining. One
medium-worker simulator-only Release build was queued using that existing
allowance; no plan/add-on upgrade or remote Simulator session was started.

Build `05c212a2-9c70-4da6-886e-e79b6470ac81` uses isolated source commit
`227da64ee1ba7f28dfce31bb0d3567358c68c763` on `codex/capture106-sim`, based on
native Build 106 source `13feb937c5c94d223635ab9509ab1090ba7f0d2b`. Only the
capture EAS profile and its observability guard membership changed. App screens,
native feature source, dependencies and app configuration match that baseline.
The resolved profile uses Xcode 26.6, simulator=true, Release, medium,
autoIncrement=false, build 106 and client billing=false. The guard accepts valid
synthetic configuration and rejects missing/invalid configuration and forbidden
Sentry bypass flags. No automatic submission was requested.

Clean, separately named iPhone 16 Pro / iOS 18.6 and Watch Series 10 46mm /
watchOS 11.5 simulators were created through Simulator's UI. These do not copy
the owner's account, app container, Health data or history. The fresh live iOS
runtime observation is 18.6; earlier feasibility notes mentioning 18.5 are
superseded. Installation and runtime rendering are not yet accepted.

The native app requires authentication before training screens. Existing saved
review credentials were not reused as an assumed synthetic-data account. A new
ordinary test account was provisioned through the official Auth Admin API on the
existing StrideOS project, with a confirmed reserved fictional email and unique
password. No email was sent and no existing account was changed. An anonymous
client's password login returned that exact new identity, and its own profile
was readable. Credentials remain outside Git in an owner-only local file; the
temporary server-key output was removed after verification. Native login remains
a separate check. The temporary owner account-creation handoff is superseded:
the owner needs to do nothing for that step.

Use native onboarding/manual entries with fictional data, optional
sharing/integrations off, and no imported personal Health history, routes or
media. No replacement images are claimed created or uploaded merely because a
build or server login succeeded.

The capture build subsequently read back **FINISHED**. The downloaded archive
SHA-256 is `65c2db2d8b8a23ed751f003be3573d413e24f397f4141f86c76c865acfd95c8f`.
Phone and Watch executables contain both x86_64 and arm64. Their plists identify
Simulator platforms, version 1.0.0/build 106, with minimum iOS 16.4/watchOS 10.0.
The cloud observability guard passed. These checks establish an artifact, not
successful runtime rendering. The new phone completed first-boot migration but
remained on a startup spinner. Its pending install was interrupted by one normal
shutdown/restart of this newly created capture device; no erase was performed.
The failed install's `ipc/mig server died` response coincided with that shutdown,
and is not evidence of an application runtime crash.

Native sign-in subsequently rendered and exposed a fresh-install ownership
blocker caused by an automatic write of seeded athlete defaults. That is a
separate, concrete app finding. The producer fix, full 1,447-test pass, prepared
build 107 and pending native retest are recorded in
`NATIVE_CAPTURE_BOOTSTRAP_FIX.md`. Replacement assets must follow the corrected
candidate; this continuation does not accept the old draft images.

## Build 107 native capture and upload receipt

Fresh native sign-in, complete onboarding, Calendar, and manual run/hike
save/readback succeeded on iPhone 16 Pro / iOS 18.6 Simulator. This scoped
acceptance is recorded in `NATIVE_CAPTURE_BOOTSTRAP_FIX.md` and is not physical
phone/Watch or billing acceptance. Four original 1206×2622 PNGs and a provenance
manifest are preserved in `docs/assets/screenshots/native-107/`.

Independent agent visual review cleared three actual-app images. Native Chrome
file-chooser uploads were read back in Apple Asset Library, increasing its
inventory from 12 to **15**, with these processed identities:

| Original | Apple asset ID |
| --- | --- |
| `02-calendar-week.png` | `95000019-4492-8222-8007-630a3403887f` |
| `04-activity-history.png` | `aa800019-4492-8222-803c-5c49b717fcea` |
| `06-strength-presets.png` | `59000019-4492-8222-803a-bb53c4f6209a` |

All are recognized as iPhone with Dynamic Island (medium display). The fourth
capture, `03-running-detail.png`, was **not uploaded**: it implies prescription
adherence for an unlinked manual entry. The underlying summary presentation is
being corrected; it must be recaptured from a later native build. Today is also
excluded until its hardcoded greeting is corrected in an installed candidate.

These uploads have now also been placed in draft iOS 1.0 / English (U.S.) /
iPhone with Dynamic Island (medium display), ordered Calendar, Activity history,
Strength presets. A full reload confirmed **3 of 10 screenshots** and the same
three filenames. The four old Face ID (large display) placements were removed
through Apple's explicit placement-only confirmation, which states files remain
in Asset Library. Reopening that size after reload shows the three new images
under **Using Existing Assets**, with zero overriding placements.

This is not Apple review submission, approval or public availability. No Add for
Review was clicked and no library asset was deleted. Existing URLs and free
hosting remain unchanged.
Computer control was intermittent (CDP timeout, native window errors and one
service-startup error); native Chrome fallback completed the three uploads.
Placement and inherited-size readback are now complete for these three iPhone
images. Remaining native captures, Watch/hardware checks and release gates are
open. The old Watch/iPad placements have not been accepted as current or removed
by this iPhone-only update.
