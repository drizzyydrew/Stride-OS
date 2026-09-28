# StrideOS handoff for Codex: Builds 87–90 and badge redesign

Written 2026-09-27 at the end of a long Claude Code session. Read this top to bottom before you touch anything. Section 11 has the rules that must not be broken.

---

## 1. Where things stand

- **Repo:** `~/Developer/StrideOS_App_clean_build19_v3_foundation_local`
- **Branch:** `build-19-v3-foundation`
- **Last commit:** `3e71cb4 Prepare StrideOS build 90`
- **Working tree:** clean apart from this handoff folder, `docs/handoff/`, which is not committed yet.
- **Latest TestFlight build is 1.0.0 (90).** The user tested it on device and reported: **"Everything works perfectly!"**
- **Protected git tags:**
  - `watch-working-build89`: the first build where phone ↔ Apple Watch sync worked.
  - `watch-working-build90`: **the current verified baseline.** It includes iPhone auto-launch of the watch app, confirmed on device.
- **Next build number is 91** (`app.json` → `expo.ios.buildNumber`).
- **In progress: the achievement badge redesign.** It has not been implemented in the app. Only preview samples exist, in `docs/handoff/badge-samples/`. See section 8.

### Do not use the old folder
The earlier working folder, `~/Documents/StrideOS_App_clean_build19_v3_foundation`, is iCloud-offloaded and "dataless". Its uncommitted Build 78–86 work was copied into this clone and committed as `b7a2a25 Build 86 snapshot from iCloud worktree`. Don't work in the old folder. Reading dataless files there triggers iCloud downloads.

---

## 2. The product and the user

**StrideOS** is an Expo SDK 56 / React Native training app. It has an iPhone app, a native SwiftUI watchOS app, and a Live Activity. Features include:
- GPS runs and outdoor activities
- structured and custom workouts, a route builder (Mapbox), offline maps
- streaks and achievements with badges
- forecast/analytics charts, share cards, HealthKit

**Bundle IDs:**
- iPhone: `com.mooremovement.strideos`
- Watch: `com.mooremovement.strideos.watch`
- Live Activity: `com.mooremovement.strideos.liveactivity`

**The user:**
- Verifies everything on **real devices through TestFlight**: an iPhone and an **Apple Watch Series 8**.
- Their Mac is older and runs **Xcode 16.4 only**, so they cannot build or run the app locally and cannot open Xcode Organizer crash logs.
- Is direct and cares about visual quality.

**Brand direction:**
- A dark, athletic, premium "training OS" feel.
- Graphite/black backgrounds, cream text, steel blue accents, sage for positive/start, clay for stop.
- Badges are **gold**, following the approved reference sheet.
- Avoid fuzzy blobs, dotted or beaded route lines, stick figures, and anything that looks generic.

**How the user wants to work:**
- Every TestFlight build should be worth it, because each one costs them real time to verify.
- Don't claim something is fixed based on tests alone. Keep these separate: local tests, native compile, EAS build, submission, Apple processing, and **verified on device**.
- Preserve unrelated work, avoid broad refactors, and ask before submitting a build. In the last round they gave full autonomy for one "one-shot" build (Build 90).

---

## 3. Build and verification workflow

### What works on this Mac
- `npm test`: Node test runner via tsx. **693/693 passing** at Build 90.
- `npm run typecheck`
- `npm run expo:check`
- `git diff --check`
- Swift type-check of the watch target:
  `xcrun --sdk watchos swiftc -typecheck -target arm64_32-apple-watchos10.0 -swift-version 5 targets/StrideOSWatch/*.swift`
  Also run it for `arm64-apple-watchos10.0` and the simulator target.
- Phone-side WatchConnectivity coordinator: type-check the part of `StrideWatchConnectivityModule.swift` above `public final class StrideWatchConnectivityModule`, with `import ExpoModulesCore` removed, against `iphoneos` / `arm64-apple-ios16.4`.
- Live Activity widget: type-check at **iOS 18.0**, its real deployment target, with the Core `ContentState` files inlined.
- A standalone watchOS simulator build of just the watch sources. This was used for crash reproduction and layout screenshots.
  - The 42mm simulator hung on this Mac; the 46mm one worked.
  - For HealthKit in the simulator, embed the entitlements with `-Xlinker -sectcreate __TEXT __entitlements`, including `application-identifier`. Set `WKWatchOnly` and do **not** also set `WKRunsIndependentlyOfCompanionApp`.

### What does not work here
- A full `xcodebuild` of the app. Expo SDK 56's `ExpoModulesJSI` pod needs Swift 6.2 (Xcode 26); this Mac has Swift 6.1.
- **The only full native compile is EAS**, which uses Xcode 26.x.

### Native project and build numbers
- `ios/` is gitignored and excluded from the EAS upload by `.easignore`. EAS always runs a clean prebuild.
- The Watch and Live Activity `CURRENT_PROJECT_VERSION` values are synced from `app.json`'s `buildNumber` by `plugins/withIosWorkoutBackgroundModes.js`.
- Verify locally with `CI=1 npx expo prebuild --platform ios --clean --no-install`.
  - A **non-clean prebuild fails** in `@bacons/apple-targets` with `removeFromProject` undefined. Always use `--clean`.
- `scripts/tests/watchWorkoutSync.test.ts` reads `ios/…/project.pbxproj`. It needs a prebuilt `ios/` with matching build numbers, so run prebuild before `npm test`.

### Build and submit, only with explicit user approval
```
npx eas-cli build --platform ios --profile production --auto-submit --non-interactive --no-wait
```
- This `eas-cli` (24.7) has **no `submission:view`**. Get submission status from the EAS GraphQL API (`https://api.expo.dev/graphql`, `submissions.byId`) using the session secret in `~/.expo/state.json` (`expo-session` header).
- Use **Node** `fetch`. The local Python has no CA certificates.
- App Store Connect / TestFlight processing can't be queried from here; the user confirms it.
- The EAS production environment has `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, present and starting with `pk.`. Never print it.

---

## 4. The watch saga: what was tried, what failed, why, and the fix

### Symptoms (Builds 67–88)
- The watch app crashed on launch, crashed when a workout started, or crash-looped every 1–2 s after reopening.
- Uninstalling and reinstalling the watch app temporarily fixed it.

### Root causes and fixes, in order

**1. Watch events never reached the phone (fixed in Build 87)**
- `modules/stride-watch-connectivity/src/index.ts` subscribed with `new NativeEventEmitter(NativeModules['StrideWatchConnectivity'])`.
- Expo modules are **not** in `NativeModules` under SDK 56 / the New Architecture, so every listener was silently null.
- Fix: subscribe with `requireNativeModule(...).addListener(...)`. The `stride-pose` module already used this pattern.
- Note: `modules/stride-live-activity/src/index.ts` still has the same broken pattern. It hasn't been fixed because it is out of scope.

**2. Duplicate watch-state handlers (fixed in Build 87)**
- Both `app/(tabs)/training/index.tsx` and `src/components/watch/WatchWorkoutBridge.tsx` applied watch pause/resume/end.
- Now **only `WatchWorkoutBridge`**, mounted once in `app/_layout.tsx`, controls the run. The run screen only mirrors state for display.
- A run ended from the watch now goes through `requestCompletion()` → the training screen's `stop()`, which saves the run. The previous `finishRun()` call reset the run without saving it.

**3. Watch threading and idempotency (Build 87)**
- All HealthKit and WatchConnectivity callbacks now hop to the main thread.
- `endWorkout()` is guarded against a double end (the "Unable to perform 'end' from current state" error).
- Commands are deduplicated against a set of recent keys.
- The watch sends `commandAck` messages, with reasons such as `already_active`, `already_starting`, `no_active_workout`, `id_mismatch` and `queued_start_ignored`.

**4. Council-requested hardening (Build 87)**
- Ignore watch pause/resume events that are queued or more than 5 s old; this prevents a phone run getting stuck paused.
- On the watch, fall back to `transferUserInfo` when `sendMessage` fails, for state, acks and errors, but not heart rate.
- Ignore HealthKit callbacks from a session that isn't the current one.

**5. Crash evidence and stopping the crash loop (Build 88)**
- Added `StrideWatchStartTrail`: an atomic file write before each start step, with a "Crashed at: X" card shown on the next launch.
- The watch now rejects start commands that arrive queued (`userInfo` or `applicationContext`) while the app was closed. Only a live `sendMessage` start runs.

**6. The actual crash (fixed in Build 89)**
- **The Series 8 runs the `arm64_32` slice, where `Int` is 32-bit.**
- `handlePhoneCommand` built its dedupe key with `Int(sentAt.rounded())`. `sentAt` is the phone's millisecond timestamp (~1.8e12, which is greater than `Int32.max`). That traps: *"Double value cannot be converted to Int32 because the result would be greater than Int32.max"*.
- It happened on **every** phone command. That explains the instant crash on start and the crash 1.5 s after relaunch, when WatchConnectivity delivered any queued command.
- The same bug existed in the watch-generated workout ID, `Int(Date()*1000)`.
- Fix: use `Int64`. A regression test now forbids `Int(` on `sentAt` or `timeIntervalSince1970` in the watch target.
- **Why the diagnosis took so long:** 64-bit simulators never reproduce it; only real Series 4–8/SE hardware does. The crash began in Builds 68–71, when those conversions were added. Build 67's crash had no code change.

**7. Auto-launch (Build 90)**
- **Phone:** when the watch is paired and installed but unreachable, call `HKHealthStore().startWatchApp(with:)` and hold the start message for 90 s. Resend it live when `sessionReachabilityDidChange` fires.
  - Any end command clears the held start.
  - A pause or resume sent in the meantime is re-sent with a fresh `sentAt` so the watch's dedupe doesn't drop it.
- **Watch:** `@WKApplicationDelegateAdaptor` → `handle(_ workoutConfiguration:)` → `startProvisionalWorkoutFromLaunch`. This starts a HealthKit session under a provisional ID `launch_<Int64 ms>`, which is Apple's contract and what makes the app reachable. The phone's live start then **adopts** its `workoutInstanceId` through `adoptPhoneStartIfProvisional`.
  - If no phone start arrives within 60 s, the session is ended and **discarded**, not saved to Health.
- **Why this design:** the first auto-launch design only activated WatchConnectivity and waited. The council found that per Apple's `isReachable` docs, a background-launched watch app without a workout session is not reachable, so the phone and watch would each wait for the other. Only about 10–15% success was expected.
- **Council-found defects that were fixed before shipping:**
  - A provisional session sent "running"/"ended" with its launch ID. The strength handler in the bridge would have ended an unrelated phone strength workout. Fix: suppress all state messages while provisional or discarding.
  - The discard marker was a bare `Bool` that could outlive its session and **discard the user's next real workout** from Health. Fix: `private weak var discardSession: HKWorkoutSession?`, compared by identity.
  - The timeout could fire before the session existed. Fix: `discardWhenRunning`.
  - A real phone start could be adopted into a session that was being discarded. Fix: `startWorkout()` clears provisional state, and adoption is guarded with `!isEnding`, `discardSession == nil` and `!discardWhenRunning`.
- **Result:** the user verified on device that auto-launch works.

### What didn't work, and why
- **Delaying WatchConnectivity activation by 1.5 s** was a red herring from an earlier theory. It is harmless and still there on the normal path; the launch path uses delay 0.
- **Reinstalling the watch app** only cleared the queued commands. The Int overflow brought the crash back on the next command.
- **Looking for crash logs** failed:
  - Xcode Organizer isn't usable on this Mac.
  - iPhone Analytics Data showed nothing, probably because "Share iPhone & Watch Analytics" is off.
  - No logs had synced to the Mac.
  - The on-screen start trail from Build 88 never recorded a step, because the crash happened before the first marker. That absence was itself the clue.
- **Simulator repro** didn't reproduce the crash, because the simulator is 64-bit. Its HealthKit also needs special entitlements.

---

## 5. Other Build 87–90 changes (all verified on device in Build 90)

### Route line and maps (Build 87)
- `src/components/maps/MapComponents.native.tsx` draws the solid line as shadow → white casing → colored line.
- No `layerIndex` or `slot`: slots only exist in the Mapbox Standard style, and the app uses `outdoors-v11`. The source ID is stable, so there's no remount on edits. Markers are a crisp 18px ring with a 6px white core.
- The dashed style is used **only** when snapping failed. It shows with a labeled banner: "Couldn't snap to roads or paths…". Planned and saved routes on the run screen are solid.

### Offline recording (Build 90)
- `distanceInterval: 0` in `src/lib/gpsTracking.ts` and `src/lib/activityGpsTracking.ts`, so auto-pause gets samples while you stand still.
- Fixes that haven't moved 2.5 m are not stored, so the track doesn't grow and get re-persisted every second.
- The 65 m accuracy filter is kept. On purpose: accepting worse fixes would add phantom distance.
- `lastGoodFixAt` was added to both workout stores. A "Weak GPS · still recording" chip appears after 20 s without a good fix (`src/utils/gpsSignal.ts`, `src/components/activity/GpsSignalChip.tsx`).
- Auto-pause (`src/utils/autoPause.ts`) never pauses on a poor-accuracy fix, but Doppler speed can resume an auto-paused workout, so it can't get stuck paused. The requirement of pause and resume after 2 s was already met.
- The Live Activity timer ticks natively: an optional `updatedAt` field in `ContentState` plus `Text(date, style: .timer)`.
- Outdoor activities start GPS **before** the Apple Maps route-guidance request, which previously delayed recording when offline.

### Workout builder (Build 90)
- **Critical bug fixed:** `"10 min"` was parsed as **10 miles**, because the check for `" mi"` matched inside "min". The parser now lives in `src/utils/workoutSegmentCoaching.ts`.
- Segments carry exact numeric targets (`targetSeconds`, `targetMiles`, `targetPaceSecPerMile`) and keep their exact order; previously a segment could be dropped or run twice. Labels are precise: "1.25 mi", "30 sec", "400 m".
- Live "Speed up / Ease off. Target 7:30 per mile" cues:
  - 30 s grace period and 60 s cooldown
  - tolerance of 2.5% of target pace, minimum 5 s
- End-of-segment feedback, e.g. "…12 seconds slower than target. Too slow." Tolerance: 1%, minimum 3 s.
- "Customize every segment" expands any preset into the full segment editor: time or distance, m/km/mi, and a minutes-plus-seconds pace picker.
- The button is now "Save & Go to Start Run". The Active tab opens in Workout mode when a custom run is selected.
- "Build Custom Workout Instead" appears on scheduled days. The legacy "GPS Run" button now goes to the Active tab.
- Saved custom workouts could already be deleted.

### Streaks (`src/utils/achievements.ts`)
- The streak continues only if the next workout **starts** within 24 h of the previous one **ending**.
- Measured in wall-clock time, so DST days (23 or 25 hours long) don't break it.
- Only logged workouts of 5+ minutes count.

### Indoor ride (`app/(tabs)/activity/indoor-ride.tsx`)
- Uses live Apple Watch or BLE heart rate first, with HealthKit as the fallback.
- Power comes from a BLE sensor when connected; otherwise it's typed in by hand. There are no fake values and no cadence UI.

### Forecast charts (`src/components/performance/ForecastChartDetailModal.tsx`, `src/utils/trainingOutlook.ts`)
- Minimalist design: a large headline percentage with a one-line explanation, a thin line, the key date ("Projected peak", "Race day", "As of"), and a real Close button.
- Training Load is now a percentage of the 4-week baseline, uncapped up to 300%.

### Route guidance (`src/lib/routeGuidance.ts`, `src/lib/routing.ts`)
- Turn detection uses a window of about 25 m on each side of a corner and keeps the strongest turn within 30 m. Tests confirm left and right.
- Steps advance by distance along the route, so cutting a corner doesn't stall them.
- Wrong-way detection: heading more than 120° off the route for 3 samples.
- Off-route and wrong-way alerts are spoken once, then at most every 60 s. Before, they repeated on every GPS fix.
- The turn math itself was already correct; turn cues had previously been disabled.

### Watch polish (Build 90)
- Phone setting **Settings → Apple Watch → Show Watch Sync Details**, off by default.
- The harmless "no_active_workout" message after an end is shown as "already ended".
- On the watch: the non-functional "Workout type" list was removed, and the diagnostics are folded behind "Sync details".
- The watch layout uses the system `scenePadding`, with the StrideOS logo in the top bar next to the clock. The workout screen doesn't scroll.

### Tests
- New file: `scripts/tests/build90Features.test.ts`. It pins the watch invariants and every feature above.
- Two tests that were already failing (`build46Corrections`, `build47Corrections`) were updated to the current spec: dates are now wanted in the forecast, and load is a percentage.

---

## 6. The council process (user requirement)

The user requires that **any change that could affect the watch app, its startup, or the phone↔watch connection** go through a council review and reach **≥95% confidence of no regression**. Below that, **ask the user first**.

**Protected files:**
- `targets/StrideOSWatch/*`
- `modules/stride-watch-connectivity/*`
- `src/components/watch/WatchWorkoutBridge.tsx`

Diff them against the `watch-working-build90` tag.

**Skills** (originally Codex skills, copied to `~/.claude/skills/`):
- `council-review`: at minimum a Contrarian and a First Principles/platform agent, with a cross-examination round and a Chair who decides.
- `strideos-design-council`: for visual and badge work.
- `strideos-badge-builder`

The original skill files are in `~/.codex/skills/`.

**What worked:**
- Keep new behavior behind markers that are false on the normal, verified path.
- Pin those invariants in tests.
- Run the council twice: once on the design, once on the actual implementation. The second pass caught real defects.

**Build 90 scores:**
- UI-only watch changes: 97%.
- Auto-launch: initially 90%, which is below the bar. The user explicitly chose "Include the working version now". After the defect fixes it was 96% on the open-app path.

---

## 7. Questions asked and the user's answers

| Question | Answer |
|---|---|
| Auto-launch: defer to its own build, include it, or drop it? (first ask) | **Include in this build** |
| Which council should review? | **Install the council skill** (paths provided) |
| Auto-launch failed the 95% bar: pull it, include the working version, or drop it? | **Include the working version now** |
| Earlier: approval to take the snapshot → Builds 87, 88, 89, 90 | Approved each time; one-shot autonomy granted for Build 90 |
| Watch layout (top and bottom looked cut off) | Asked to fix it using proper watchOS sizing; done in Build 88 |
| Badges: able to edit? Show a sample only, don't ship | Samples v1 → v5 made (see section 8) |

Setup facts confirmed by the user:
- The watch is a **Series 8**.
- Their Mac runs **Xcode 16** only.

---

## 8. In progress: achievement badge redesign

### What the user asked for
Redraw the achievement badges to match their approved reference art. It applies to **every family except the mountain/elevation badges**.

**The Firsts reference sheet** is `docs/handoff/badge-samples/firsts-reference-sheet.png`. It shows 15 badges:
- Each is a hexagon with a **thin single warm-gold outline**, pointy top and bottom with vertical sides.
- A large gold line icon sits in the upper half.
- The title is in light-weight gold/cream capitals, with a smaller letter-spaced "STRIDEOS" below it and a double chevron at the bottom.
- The interior is near-black.

**Hard rule: never stick figures.** Human figures are **outlined silhouettes**, where the limbs and torso have real width and are drawn as a hollow gold outline of their combined shape. Specifics from the user:
- No neck: the head floats just above high shoulders.
- The torso is wider and a bit stout, not a tube.
- Legs start thick at the hip and taper to the ankle.
- **Solid, filled shoes** that flow seamlessly out of the leg.
- The back foot angles down and forward, in line with the shin.
- The waist-to-hip line has to be continuous.

### Where it stands
- **First Run v5** has addressed every note so far. The user's last feedback was on v4; those fixes are applied in v5, and they **haven't approved v5 yet**.
- One open detail: the back-arm armpit has a sharp inner corner. I offered to soften it.
- Samples: `docs/handoff/badge-samples/compare-first-run-v5.png` and `zoom-v5.png`.

### How the samples were made (not yet in the app)
- The current renderer is `src/achievements/firsts/firstsArtwork.ts`; its output is visually wrong.
  - Pinkish champagne `#DCC0A7` instead of gold.
  - A thick 2.25 gradient border plus an inner bevel ring.
  - Small stick-figure glyphs and a small cream title.
- `docs/handoff/badge-samples/proposedArtwork.ts` is a **modified copy** of that renderer (its import paths are absolute and must be fixed to relative before use):
  - Gold palette: primary `#E3BC7E`, secondary `#C1A276`, highlight `#F4DCA9`, shadow `#A8844F`, text `#E9C78C`. These were sampled from the reference: median `#E8C082`, darker `#C1A276`.
  - A single 1.35 outline, with the inner bevel ring removed.
  - The hexagon narrowed to 0.92 of its width.
  - Glyphs scaled 1.22 and raised; the redrawn runner has its own layout.
  - Title: weight 500, 7.0 size, highlight color. Wordmark: 3.7 size, weight 600, letter spacing 0.9. Chevrons: 0.95 stroke, pulled up.
  - Helpers `outlinedFigure()` (the v3 tube version) and `outlinedShapes()` (v5).
- **The v5 technique:** body parts are tapered polygons built from joint points with widths. Inside an SVG `<mask>`, draw the shapes white, filled and stroked at 2 × the line width, then the same shapes black on top. What's left is one clean outline around the combined shape. The shoes are drawn white **inside the same mask** so they're seamless with the outline. The head is a separate outlined circle.
- `docs/handoff/badge-samples/figure4.py` builds the runner. It has a `tapered()` polygon generator with miter-corrected widths, the joint coordinates, and the shoe segments, and it injects the `case 'run'` into `proposedArtwork.ts`.
- `render.ts` renders every Firsts badge with both the current and the proposed renderer. It needs the env vars `S` (output directory) and `R` (repo root).
  - Gotcha: **env vars must be exported.** One render silently used stale files because they weren't set. Also quote heredocs, or the shell expands `${…}`.

### A rendering pitfall
- The asset generator `scripts/generate-firsts-assets.ts` rasterizes with **`sips`, which renders SVG masks at low resolution and pixelated**.
- Quick Look (`qlmanage -t -s 1024 -o <dir> file.svg`) renders them correctly using WebKit, but with a white background: replace pixels above 240 with the background colour for previews.
- **Before implementing, check** whether the app draws badges from the SVG (react-native-svg supports masks) or from the generated PNGs. Look at `src/components/achievements/AchievementBadge.tsx` and the Firsts components. If it uses PNGs, either switch the generator to a WebKit/qlmanage render or build the outline without a mask. For opaque variants you could stroke gold and then knock out with the fill colour; the transparent share variant still needs the mask for real transparency.
- `validate-firsts-assets.ts` and `render-firsts-qa-board.ts` exist; update and run them.

### Badge plan once the user approves the runner
1. Lock the outlined-figure style. Apply it to the other human glyphs: Walk, Run/Walk (two figures and a dashed arc), Mobility (lunge with an arc), and **Movement Lab**. The reference shows a dotted skeleton inside corner brackets for Movement Lab, which is acceptable because it isn't a stick figure. Confirm with the user.
2. Fit **each of the 15 icons individually.** A single global scale pushed the sunrise, calendar and Movement Lab icons into the border.
3. Two-line titles like "FIRST STRUCTURED WORKOUT" need a smaller size; they were too wide and collided with the icon.
4. The 5K, 10K, 13.1 and 26.2 shields should use the **sans-serif** font from the reference, not the Didot serif they use now.
5. Keep one canonical definition for every state: unlocked, locked (the same geometry in neutral gray at lower opacity; no padlock, X or red), share-transparent (true alpha), and share-opaque. This is the badge-builder skill's rule.
6. Run the `strideos-design-council` with visual QA at 48, 64, 96, 128 and 256 px before signing off.
7. The user also said **many other badge families** in `assets/achievements/` (streaks, distance, strength, recovery and so on) "don't look anything close" to what they want.
   - Only elevation has written references (`docs/achievements/elevation/*/references.md`), and elevation badges are **excluded** from this change.
   - **Ask the user for reference images for the other families.** Not asked yet in a way that got an answer.

### Share cards for achievements: requested, not yet built
File: `src/components/share/ShareStudio.tsx`, via the achievement detail screen.
- **Square format** (current problem: the badge overlaps the stats): show **only** "ACHIEVEMENT UNLOCKED", the achievement name, a single line of context (e.g. "1.2 mi run · July 21"), and the **badge centered and sized to fit**. Drop the distance, time and pace block.
- **Story format:** keep the content, but move the badge down so the gap above it (pace line → badge) **equals** the gap below it (badge → StrideOS wordmark).
- Plan: mock both layouts for the user's approval, then implement.

---

## 9. Other open items and backlog

### Before a public (non-TestFlight) release
- Remove the watch's "Crashed at / Last start" card and the `StrideWatchStartTrail` UI, and the "Sync details" line. They were only there to find the crash.
- Drop the unused workout-kind selection code on the watch.

### Known minor edges (accepted)
- A first-time user with no watch Health permission: auto-launch can't show the permission prompt in the background, so the start times out after 12 s. They have to start one workout the manual way first.
- A phone pause in the second before a provisional watch session is running may be dropped. The next resume or stop fixes it.
- `modules/stride-live-activity/src/index.ts` has the same `NativeEventEmitter` bug as the watch module had.

### Backlog (user interested; not started)
- Auto-rerouting when off route. Today it warns but doesn't recalculate.
- Mapbox Directions for more reliable route-builder snapping. Today it uses public OSRM (`routing.openstreetmap.de` and `router.project-osrm.org`), which is rate-limited; a failure shows the thin dashed line.
- Offline map pack downloads for trails. Some Mapbox offline code exists in `src/lib/mapboxOffline.ts`.
- Optional: a "Share iPhone & Watch Analytics" setting so future crash logs are reachable.

---

## 10. Commits and builds

| Build | EAS build ID | Submission | Contents |
|---|---|---|---|
| 87 | 7fbd7505-2635-4724-a749-857b8908af2b | 464caa09-… | Event channel fix, single handler, threading, diagnostics, route line |
| 88 | 31dabf9b-f39a-4277-924d-5d272666591a | 9a77d830-… | Start trail, queued starts ignored, watch layout |
| 89 | 8de31d71-2e75-4ed2-8add-438431eaf95f | bd3bd10d-… | **Int64 fix: watch finally works** |
| 90 | e145dbdf-187e-4c64-ad05-935469fc1265 | faacd2c3-8c06-4df1-9576-95118b67ca75 | All features + auto-launch; **verified: "everything works perfectly"** |

**Key commits:**
- `b7a2a25` snapshot
- `d4e2c24` / `73eefac`: Build 87
- `ef91708` / `4ffcf0b`: Build 88
- `35c01f9` / `cdfc175`: Build 89
- `84e44eb` / `f999c83` / `3e71cb4`: Build 90

---

## 11. Rules for the next agent

1. **Protect the watch path.** Council review at ≥95% or ask the user. Diff against `watch-working-build90`.
2. **No TestFlight or EAS builds without explicit user approval.** The next build number is 91.
3. **No stick figures in badges, ever.** Match the reference art exactly. Mountain/elevation badges are excluded from the redesign.
4. Watch Swift must be **32-bit safe**: never use `Int(...)` on epoch or millisecond values. Use `Int64` or keep them as `Double`.
5. Always use `expo prebuild --clean`, and run it before `npm test`.
6. Report results honestly, separating local tests, compile, EAS build, submission, Apple processing and **device-verified**.
7. Read `AGENTS.md`. It requires reading the Expo SDK 56 docs before Expo/EAS code changes, and reading `assets/movement-lab/dion/DION_CANONICAL_REFERENCE.md` before any Dion or Movement Lab images.

## 12. Immediate next step
Get the user's verdict on **First Run v5** (`docs/handoff/badge-samples/compare-first-run-v5.png`).
- If approved, do the badge plan in section 8.
- If not, keep iterating the runner in `figure4.py` / `proposedArtwork.ts`.

Then mock the Square and Story achievement share layouts, and ask the user for reference images for the other badge families.
