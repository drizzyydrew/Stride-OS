# Build 37 Product Decisions

Date: 2026-07-16  
Release base preserved: Build 36 (`bc75f40`)  
Inherited checkout state: committed Build 37 work at `0526d81`

## Interaction behavior

- Movement capture opens into a live setup preview. Front camera is the default. Camera facing can change repeatedly during setup, but the flip control is locked during countdown and capture.
- A five-second countdown starts only after the athlete presses the explicit capture action. Movement-specific automatic stop, review, retake, and use-media states follow.
- Camera readiness and capture results are scoped to a native-session generation. A readiness callback or capture promise from an older facing/session cannot enable controls or commit media into the current session.
- Imported videos have no age requirement. iCloud-backed media is downloaded when iOS permits it, staged to stable app storage, validated, and then analyzed.
- Timeline and chart drags temporarily own their gesture. Parent paging and scrolling remain disabled until release or cancellation.
- Adjust Markers is a locked edit state. The frame is paused, only measurement-relevant landmarks are editable, Cancel restores saved points, Reset restores automatic points while staying in edit mode, and Save recalculates the analysis with correction metadata.
- A route action sheet is available from visible route guidance. Remove From Today’s Run detaches guidance and clears effective route progress without deleting or mutating the saved route.
- Route naming is keyboard-safe, focus-stable, and keeps Save reachable. Blank names intentionally resolve to `Custom Route`.
- The Training Run hydration tab and full planner use one persisted input model and one calculation path. The primary result is the fluid, carbohydrate, and sodium plan, followed by execution notes and limitations.
- Hydration and fuel voice reminders are independent, use whole-minute intervals from 5–60 minutes, preserve recommended-versus-overridden state, and combine when due together.
- Strength presets are first-class resumable sessions. Training Block Workout and Preset Workout remain separate choices; starting another active session always requires an explicit conflict decision.
- Morning Readiness Reminder lives only under More → Settings → Notifications. Scheduling supports daily, weekdays, or custom days in local time.

## State transitions

### Camera

`closed → setup → countdown → capturing → review → accepted`

Retake returns to `setup`. Cancel/background/error invalidates the active operation token, stops safe native work, and returns to `closed` or recoverable `setup` without accepting stale media.

### Route attachment

`detached ↔ attached-forward ↔ attached-reverse`

Attachment is separate from the saved route record. Detach clears the effective polyline, markers, next segment, progress, and guidance state only.

### Voice reminders

Each reminder has `enabled`, `recommendedIntervalMin`, `intervalMin`, and `selection: recommended | override`. The scheduler tracks next due time from active elapsed run time, not wall-clock time, so pause/resume and long frame gaps cannot duplicate cues.

### Strength

`idle → active ↔ paused → completed → saved`

The active-session record owns source, current exercise, completed exercises, exercise entries, elapsed time, pause accumulation, and Live Activity ownership. A Training Block session and a Preset definition remain available even while the other source is active.

## Architecture decisions

- Persist durable product intent in stores; keep native refs, pending promises, scrub locks, and transient capture readiness local and generation-scoped.
- Preserve original Movement Lab landmarks and legacy angle data. Store effective display landmarks/measurements separately when a view, closest side, mirror transform, or manual correction changes presentation.
- Centralize measurement permissions by movement and camera view. Screens, overlays, charts, key frames, saved display values, and AI Coach context consume the same contract.
- Centralize the AI Coach prompt budget. Priority sections are assembled and compacted before a final hard 5,000-character enforcement at send time. Safety and the current question cannot be dropped.
- Use existing Expo SDK 56 packages for camera, image picking, speech, and notifications. No new native dependency is required for the approved behavior.
- Preserve stable workout, route, movement, and history IDs. Migrations add optional fields and safe defaults rather than rewriting or deleting historical data.

## Accessibility behavior

- Primary controls and drag handles target at least 44 x 44 points.
- Sheets keep destructive actions visually separated from ordinary actions.
- Camera setup guidance remains readable without blocking the live body-framing area and supports scrolling under larger text sizes.
- Picker sheets expose a title, current value, units, Cancel, Confirm, safe-area spacing, and screen-reader labels.
- Voice reminders always retain a visible cue alternative.
- Marker edit announces the active marker and locks conflicting navigation until Save or Cancel.
- Keyboard flows keep the focused input and primary action visible.

## Measurement convention

- Direct lateral capture uses the closest visible limb only.
- Hip sagittal motion uses a stable internal metric identity and renders either `Hip Flexion: N° Estimated` or `Hip Extension: N° Estimated`.
- Neutral upright standing is approximately 0° hip flexion. Flexion increases positively; extension is named directly. Negative hip-flexion labels are prohibited.
- Anatomical direction requires a confident direct-lateral orientation. If subject facing cannot be established, manual confirmation is required rather than silently guessing.
- Frontal/posterior capture permits bilateral frontal-plane observations but suppresses sagittal flexion claims.
- Automatic values remain estimated two-dimensional observations, not clinical goniometry, diagnosis, symptom guarantees, tissue-force estimates, or injury prediction.

## Migration behavior

- Legacy route `selectedRouteId` becomes an attached forward route without mutating the route.
- Legacy fueling intervals seed the fuel reminder. Hydration reminder preferences receive conservative recommended defaults.
- Existing measured/qualitative hydration inputs are retained and normalized into the expanded planner.
- Existing fixed 5:00 AM readiness users migrate to an enabled daily 5:00 AM schedule; other configurable notification users retain their existing time.
- Existing strength history remains readable. Preset history adds an optional preset ID/source, while an absent active session defaults to idle.
- Existing Movement Lab raw landmarks remain intact. Old hip included-angle values without recoverable geometry are identified as legacy and are not silently relabeled anatomical flexion.

## Device-only risks

- Native camera reinitialization timing and AppState interruption behavior vary by iPhone model.
- Front-camera preview/save mirroring and imported-video orientation require anatomical left/right verification on real media.
- iCloud download latency, offline retry, and temporary-URI lifetime require device testing.
- iOS may suspend the app; spoken reminders cannot be guaranteed while fully suspended. Visual state and duplicate prevention remain authoritative on resume.
- Keyboard, Dynamic Type, safe areas, VoiceOver rotor behavior, nested gesture arbitration, notification permission recovery, and Live Activity updates require physical-device validation.

