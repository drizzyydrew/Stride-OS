# StrideOS Design System

Status: Phase 2 source of truth.

Reference assets:

- `/tmp/codex-remote-attachments/019f2095-bbda-7d40-b94f-58cf60f5f8a1/08DD5685-B54C-48F5-8FFF-46D7ED512013/1-Photo-1.jpg`
- `/tmp/codex-remote-attachments/019f2095-bbda-7d40-b94f-58cf60f5f8a1/08DD5685-B54C-48F5-8FFF-46D7ED512013/2-Photo-2.jpg`

## Purpose

This folder defines the official StrideOS visual language for Phase 2. Future UI work should match these documents before adding new screen-specific styles.

## Product State

- Build 16 is stable and uploaded to TestFlight.
- Live Activities, Dynamic Island, and Lock Screen widgets are working.
- Apple Developer setup and App Groups are complete.
- Apple Music is future scope.
- Voice coaching should use native iOS speech synthesis through `AVSpeechSynthesizer`.
- Spotify is intentionally postponed.
- Adaptive run screens are intentionally out of scope.

## Visual Direction

StrideOS should feel like a premium run operating surface: calm, readable, athletic, and precise. The reference favors large numbers, reduced chrome, rounded cards, muted sage utility controls, warm clay primary actions, and map-first run context.

The UI should look native to iOS without becoming generic. It should use restraint, strong spacing, and a small token set instead of decorative effects.

## Core Principles

- Map context first during runs.
- Metrics must be readable at a glance.
- Controls must be large enough for sweaty, moving, one-handed use.
- Dark mode is the performance mode and should feel dense, calm, and high contrast.
- Light mode is the everyday mode and should feel warm, soft, and low glare.
- Cards are functional surfaces, not decoration.
- Every screen should have one obvious primary action.
- Do not introduce marketing-style layouts inside the app.

## System Shape

Primary app surfaces:

- Live Activity and Lock Screen widget
- Dynamic Island compact state
- In-run active screen
- Paused map and stats screen
- Run type selection
- Run display settings
- Voice settings

Supporting surfaces:

- Music connection row
- Metric visibility controls
- Voice announcement interval picker
- Reminder toggles

## Global Component Hierarchy

1. Session context: map, timer, distance, state label.
2. Main metrics: time and distance.
3. Secondary metrics: pace, heart rate, elevation gain.
4. Primary action: pause, resume, or stop.
5. Utility actions: location, layers, music, settings, interval options.

## Interaction Rules

- Active running state: primary action is pause.
- Paused state: primary action is resume.
- Low battery state: preserve layout, shift action tone to critical.
- Settings state: avoid oversized hero typography; use dense grouped controls.
- Run type selection: use compact rows with an icon, title, short description, and chevron.

## Dark Mode Rules

- Use near-black backgrounds, not pure black on every surface.
- Keep cards visibly raised with subtle borders and soft shadows.
- Use warm off-white text for primary metrics.
- Use sage or clay for controls depending on action meaning.
- Avoid saturated neon colors.
- Avoid large blue, purple, or gradient backgrounds.

## Light Mode Rules

- Use warm sand backgrounds and white card interiors.
- Keep text nearly black for legibility.
- Use clay for primary action fills.
- Use sage for toggles and neutral controls.
- Preserve the same hierarchy and spacing as dark mode.

## Animation Philosophy

- Motion should communicate state changes, not decorate.
- Metric changes should update cleanly without bouncing or scaling.
- Pause/resume transitions should feel immediate.
- Map movement should be smooth and low friction.
- Button feedback should be subtle: opacity, scale under 0.98, or native haptic response.
- Avoid complex animated backgrounds, animated gradients, and attention-seeking transitions during a run.

## Accessibility Rules

- Minimum tap target: 44 x 44 pt.
- Preferred in-run primary control target: 64 x 64 pt or larger.
- Never rely on color alone for run state.
- Keep primary metric contrast high in both modes.
- Dynamic Type should not clip metric labels; labels may wrap or reduce density before clipping.
- Live Activity text must remain readable from arm's length.

## Documentation Map

- `COLORS.md`: palette, roles, state colors, mode rules.
- `TYPOGRAPHY.md`: type scale, weights, number treatment.
- `SPACING.md`: spacing scale, screen padding, card geometry.
- `COMPONENTS.md`: shared cards, buttons, toggles, rows, icons.
- `LIVE_ACTIVITY.md`: Lock Screen, Dynamic Island, state variants.
- `RUN_SCREEN.md`: active run and paused run screens.
- `SETTINGS.md`: run display and voice settings layout.
- `VOICE_UI.md`: native voice coaching UI and future behavior.

