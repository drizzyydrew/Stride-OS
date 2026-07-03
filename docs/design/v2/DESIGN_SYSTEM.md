# StrideOS V2 Design System

Status: official V2 source of truth.

This document consolidates the current Phase 2 design decisions into the canonical StrideOS V2 design system. It preserves the existing design direction from `docs/design/DESIGN_SYSTEM.md` and the supporting design docs in `docs/design/`.

## Design Philosophy

StrideOS should feel like a premium run operating surface: calm, readable, athletic, and precise. The system favors large numeric metrics, reduced chrome, rounded functional surfaces, muted sage utility controls, warm clay primary actions, and map-first run context.

The app should look native to iOS without becoming generic. Use restraint, strong spacing, clear hierarchy, and a small token set instead of decorative effects.

Core principles:

- Map context comes first during runs.
- Metrics must be readable at a glance.
- Controls must be large enough for sweaty, moving, one-handed use.
- Dark mode is the performance mode: dense, calm, high contrast.
- Light mode is the everyday mode: warm, soft, low glare.
- Cards are functional surfaces, not decoration.
- Every screen should have one obvious primary action.
- Do not introduce marketing-style layouts inside the app.

## Color Tokens

Reference palette:

| Token | Hex | Use |
| --- | --- | --- |
| `sage` | `#8B927C` | Dark-mode primary control, toggles, calm active state |
| `clay` | `#DCC0A7` | Light-mode primary control, brand warmth, secondary highlight |
| `steel` | `#708489` | Map route contrast, cool neutral accents |
| `brown` | `#4D433E` | Low battery, deep warm neutral, destructive-muted action |
| `sand` | `#EFE7DA` | Light-mode app background and card wash |
| `white` | `#FFFFFF` | Light card fill, high-contrast text on dark |
| `ink` | `#101010` | Dark-mode app background |
| `inkRaised` | `#181818` | Dark cards, panels, sheets |
| `inkBorder` | `#30302C` | Dark borders and separators |
| `charcoal` | `#24211F` | Deep warm surface or low battery tone |
| `textPrimaryDark` | `#F4EEE7` | Primary text on dark |
| `textSecondaryDark` | `#CFC7BB` | Labels and supporting text on dark |
| `textMutedDark` | `#8F8A80` | Disabled and tertiary text on dark |
| `paper` | `#F8F5EF` | Light page surface |
| `cardLight` | `#FFFFFF` | Light cards and rows |
| `textPrimaryLight` | `#111111` | Primary text on light |
| `textSecondaryLight` | `#4D4A45` | Labels and supporting text on light |
| `textMutedLight` | `#8B877F` | Disabled and tertiary text on light |
| `routeSage` | `#6F7F6D` | Route line and active metric accent |
| `success` | `#6F8A63` | Resume state and positive toggles |
| `warning` | `#C79B57` | Caution and paused state label |
| `critical` | `#8A332D` | Critical errors and confirmed destructive actions |

State colors:

- Running: `sage`.
- Paused: `clay` or `success`, based on contrast.
- Low battery: `critical` or `brown`.
- Connected or available: `sage`.
- Disabled: mode-appropriate muted text.

Do not use bright neon green, heavy blue, purple gradients, pure red except for explicit critical errors, or one-color monochrome screens.

## Light Mode

- Screen background: `sand` or `paper`.
- Card background: `cardLight`.
- Primary metrics: `textPrimaryLight`.
- Metric labels: `textSecondaryLight`.
- Muted labels: `textMutedLight`.
- Hairlines and separators: warm light border, currently `#E7DED4`.
- Primary action: `clay`.
- Utility controls and toggles: `sage`.
- Maps use warm sand, pale green blocks, white roads, muted sage route lines, and high-contrast current-position markers.

## Dark Mode

- Screen background: `ink`.
- Card background: `inkRaised`.
- Primary metrics: `textPrimaryDark`.
- Metric labels: `textSecondaryDark`.
- Muted labels: `textMutedDark`.
- Hairlines and separators: `inkBorder`.
- Primary action: `sage` or `clay`, whichever has stronger contrast in context.
- Warm accent: `clay`.
- Maps use near-black bases, low-contrast roads, sage or steel route lines, and off-white current-position markers.

## Typography

Use the native iOS system stack for app UI. Do not introduce decorative display fonts for V2 run surfaces. Numeric metrics should use tabular numbers when available.

| Role | Size | Weight | Line Height | Notes |
| --- | ---: | ---: | ---: | --- |
| Hero metric | 56-64 | 700-800 | 1.0 | Live Activity time and distance |
| In-run primary metric | 30-36 | 700-800 | 1.05 | Time and distance |
| Widget secondary metric | 20-24 | 700 | 1.05 | Pace, heart rate, elevation |
| Card title | 15-17 | 700 | 1.2 | Row and widget title |
| Settings row label | 14-16 | 500-600 | 1.25 | Toggle and picker rows |
| Metric label | 10-12 | 600-700 | 1.1 | Uppercase preferred in widgets |
| Helper text | 11-13 | 400-500 | 1.35 | Settings explanations |
| Button label | 15-18 | 700-800 | 1.1 | Uppercase only for primary run actions |

Rules:

- Use tabular numbers for timers, distance, pace, BPM, and elevation.
- Keep unit labels smaller than metric values.
- Use `/mi`, `bpm`, `ft`, and `mi` exactly where those units apply.
- Do not scale font size with viewport width.
- Do not use negative letter spacing.
- Avoid multiline primary metrics.
- If labels crowd, reduce secondary metric density before shrinking primary metrics.

## Spacing

Use a 4 pt base grid.

| Token | Value | Use |
| --- | ---: | --- |
| `space1` | 4 | Tight icon-label gaps, pagination dots |
| `space2` | 8 | Metric label gaps, compact row padding |
| `space3` | 12 | Card inner gaps, row spacing |
| `space4` | 16 | Standard screen and card padding |
| `space5` | 20 | Large card padding, section gaps |
| `space6` | 24 | Major vertical spacing |
| `space8` | 32 | Screen group separation |

Screen rules:

- In-run horizontal safe padding: 20-24 pt.
- In-run bottom action area: at least 24 pt above the home indicator.
- Floating map buttons: 12-16 pt from the right safe edge.
- Settings horizontal padding: 20 pt.
- Settings section gap: 16-20 pt.
- Live Activity outer padding: 16-20 pt.

## Radius

| Surface | Radius |
| --- | ---: |
| Phone screen cards and panels | 22-28 |
| Live Activity card | 22-26 |
| Primary pill button | 18-24 |
| Settings grouped card | 12-16 |
| Run type row | 10-12 |
| Icon button circle | Fully round |
| Pagination dot | Fully round |

Cards should be rounded but not playful. Avoid excessive pill shapes except for primary run controls, state chips, and compact action buttons.

## Elevation And Shadows

Dark mode:

- Use subtle black shadows and visible borders.
- Keep shadow opacity low so cards feel native rather than floating.

Light mode:

- Use soft shadows with warm gray color.
- Keep blur moderate.
- Avoid heavy drop shadows under every row.

Elevation should clarify layering. It should not become decoration.

## Motion

- Motion communicates state changes, not decoration.
- Metric changes update cleanly without bounce or scale.
- Pause and resume transitions should feel immediate.
- Map movement should be smooth and low friction.
- Button feedback should be subtle: opacity, scale below 0.98, or native haptics.
- Avoid animated backgrounds, animated gradients, and attention-seeking transitions during a run.

## Icons

- Use native symbols or the existing app icon primitive where available.
- Icon buttons must have at least a 44 x 44 pt hit target.
- Visual icon size is usually 18-22 pt; active run primary icons are 22-28 pt.
- Use icons inside tool buttons for location, map layers, music, play, pause, resume, stop, settings, and chevrons.
- Do not use unfamiliar custom icons without an accessible label.

## Components

Shared component guidance:

- Button: primary, secondary, tertiary, and danger variants should map to semantic tokens.
- Card: functional surface with optional border or elevation.
- List row: grouped controls, settings, run type rows, and navigation rows.
- Input: native-feeling field with tokenized border, background, text, and placeholder.
- Dialog and bottom sheet: reserved for interruptive decisions or focused choices.
- Skeleton: use tokenized base and highlight colors.
- Empty and error states: concise, not decorative.
- Progress ring and charts: show real state and use restrained colors.
- Icon: prefer existing app icon wrapper over ad hoc symbols.

Avoid nested cards. Page sections should not be styled as floating cards unless they are actual repeated or framed items.

## Buttons

Primary run buttons:

- Pause: circular in active full-screen mode.
- Resume: pill in paused cards.
- Start: pill when idle.
- Stop or finish: critical only when confirming or presenting a destructive end state.
- Low battery: brown or critical tone while preserving the same layout.

Sizing:

- Active circular pause or stop: 64-72 pt diameter.
- Icon: 22-28 pt.
- Live Activity primary button: 48-56 pt high.
- Paused resume button: 50-56 pt high, radius 20-24 pt.
- Settings controls: minimum 44 pt target.

Labels:

- Use all caps only for single primary run actions such as `PAUSE`, `RESUME RUN`, or `START RUN`.
- Use sentence case for settings and general app actions.

## Cards

Cards are functional surfaces.

- Run cards prioritize time and distance.
- Metric cards preserve the order: time, distance, average pace, heart rate, elevation gain.
- Paused run cards combine map thumbnail and stats in one card.
- Settings cards group related rows.
- Do not place cards inside cards.
- Use borders sparingly and shadows only to clarify elevation.

## Inputs

Inputs should feel native and predictable.

- Background: card or raised card token.
- Border: mode-appropriate separator.
- Text: primary text token.
- Placeholder: muted text token.
- Radius: 10-12 pt for compact fields, 12-16 pt for grouped fields.
- Labels use sentence case and should not crowd controls.

## Navigation

- Bottom navigation must remain readable and uncropped.
- Active navigation state should use the mode-appropriate primary token.
- Inactive navigation state should use muted text.
- Avoid oversized headers inside operational screens.
- Use layered pages for advanced tools instead of overcrowding the first screen.

## Charts

- Charts should clarify training state and trends.
- Use semantic chart roles: primary series, secondary series, grid, axis, warning, critical, success.
- Avoid saturated blues, purples, neon greens, and decorative gradients.
- Labels must remain readable in both modes.
- Use muted grid lines and avoid boxed table-like layouts.

## Metrics

Metric order is consistent across run surfaces:

1. Time
2. Distance
3. Average pace
4. Heart rate
5. Elevation gain

Rules:

- Time and distance dominate.
- Secondary metrics use equal-width columns when possible.
- Labels sit directly under values.
- Units are smaller than values.
- Use tabular numbers.
- Reserve enough width for likely maximum values to prevent layout shifts.

## Accessibility

- Minimum tap target: 44 x 44 pt.
- Preferred in-run primary control: 64 x 64 pt or larger.
- Never rely on color alone for run state.
- Keep metric contrast high in both modes.
- Dynamic Type should not clip metric labels; labels may wrap or density may reduce before clipping.
- Live Activity text must remain readable from arm's length.
- Map controls should not cover primary metrics.
- The home indicator and Dynamic Island must not overlap controls or core metrics.

## Active Run Screen Guidelines

The active run screen is a map-first control surface. It should answer:

1. Where am I?
2. How long and how far have I run?
3. What is the next safe action?

Structure:

- Full-screen or dominant map.
- Native status area unobstructed.
- Right-side floating location and layer controls.
- Bottom metric panel with rounded top corners.
- Main metric row: time and distance.
- Secondary metric row: average pace, heart rate, elevation gain.
- Compact pagination dots.
- Large centered circular pause or stop control.
- Bottom music row with `Connect Music`.

Rules:

- Do not add continuous coaching text over the map in the base active state.
- Keep map labels low contrast.
- Route line should be visible but not neon.
- Primary circular control uses sage in dark mode and clay in light mode unless contrast requires the alternate token.
- Map controls use translucent circular backgrounds.
- Music row is future Apple Music surface; do not add Spotify in V2.

## Paused Run Screen Guidelines

Structure:

- Compact card with map thumbnail on the left.
- Stats on the right.
- State label `PAUSED` above metrics when space allows.
- Resume button in the same visual group as stats.
- Small GPS note below the card only when needed.

Rules:

- Map thumbnail and stats share one card.
- Do not place a card inside another card.
- Paused state feels calm, not like an error.
- Resume button label is `RESUME RUN` with play icon.
- Resume button height: 50-56 pt.
- Resume fill: sage in dark mode or clay in light mode, based on contrast.
- Finish and discard actions must remain visually secondary unless a confirmation state is shown.

## Live Activity Guidelines

Lock Screen structure:

- Rounded rectangular card.
- Header row with StrideOS mark, `StrideOS Run`, and optional right-aligned zone chip such as `Z2`.
- Left metric column: elapsed time and distance.
- Right metric column: average pace, heart rate, elevation gain.
- One vertical divider between columns.
- Full-width action button along the bottom.

Sizing:

- Card radius: 22-26 pt.
- Outer padding: 16-20 pt.
- Button height: 48-56 pt.
- Header height: 28-34 pt.

State variants:

- Running button: `PAUSE`, pause icon.
- Paused button: `RESUME`, play icon.
- Low battery: preserve layout, keep button usable, shift tone to brown or critical.

Do not add Apple Music, Spotify, or adaptive run variants to Live Activity in V2.

## Dynamic Island Guidelines

Priority:

1. Active run state.
2. Elapsed time.
3. Distance.
4. State indicator.

Rules:

- Keep compact content minimal.
- Use only the most important metric in tight spaces.
- Use the brand mark or small run glyph only if it does not reduce readability.
- Avoid long labels.
- Do not require opening the app to pause or resume when native controls are reliable.

## AI Coach Guidelines

AI Coach should feel like a practical training assistant, not a marketing page.

- Use tokenized cards, rows, inputs, and buttons.
- Keep messages readable in both modes.
- Error states must not crash the app and should be useful.
- Avoid saturated blue or purple assistant surfaces.
- Use concise empty states and health/configuration notices.
- Do not expose secrets or backend details in UI copy.
- Do not add clinical or guaranteed performance language.

## Dashboard Guidelines

Dashboard is the daily operating surface.

- First screen should be useful immediately.
- Prioritize readiness, today action, training status, and key next step.
- Use cards for individual repeated or framed items only.
- Avoid decorative hero layouts.
- Keep dense information scannable with restrained section labels.
- Use semantic state tones for readiness, warning, critical, and positive progress.

## Training Guidelines

Training surfaces should prioritize the next workout, current run state, and route readiness.

- Active run screen follows the active run guidelines.
- Plan views use compact cards and clear metric hierarchy.
- Run type selection uses compact rows with icon, title, description, and chevron.
- Hydration and route tools should remain layered pages, not crowded into the main run surface.
- Do not change workout calculations or adaptive run behavior through visual system work.

## Settings Guidelines

Settings should feel compact, native, and predictable.

- Use grouped cards with 12-16 pt radius.
- Row height: at least 44 pt.
- Row horizontal padding: 14-16 pt.
- Row vertical padding: 10-14 pt.
- Use native toggles and sage enabled state.
- Keep labels sentence case.
- Avoid oversized headings, explanatory paragraphs, nested cards, or custom toggles unless native controls cannot meet the need.

Run display settings should preserve metric order:

1. Time
2. Distance
3. Avg Pace
4. Heart Rate
5. Elevation Gain

Voice settings should keep Voice and Announcement Interval above detailed toggles.

## Future Screen Conventions

- Build actual usable screens first, not landing pages.
- Use existing primitives before creating new components.
- Keep operational tools dense but readable.
- Use rows for choices, toggles for booleans, sliders or steppers for numeric values, tabs for mode switching, and icon buttons for utilities.
- Avoid decorative cards, gradients, animated backgrounds, and one-note color palettes.
- Use future run type rows for Quick Start, Time Goal, Distance Goal, Workout, and Race, but do not introduce adaptive run screens in V2.
- Prefer source-of-truth tokens over screen-specific hard-coded colors.

## Red And Destructive Action Rules

Red and critical tones are reserved.

Use `critical` for:

- Confirmed destructive actions.
- Critical errors.
- Low battery when it changes action urgency.
- Out-of-range states that require attention.

Do not use red for:

- Normal paused state.
- Generic primary action.
- Incomplete setup unless the user is blocked.
- Decorative emphasis.

Finish, discard, delete, reset, and sign-out actions must be visually secondary until the user is in a confirmation state. In confirmation state, use critical tone with clear labels and enough spacing to prevent accidental taps.

## Source Docs

This V2 document is consolidated from:

- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/COLORS.md`
- `docs/design/TYPOGRAPHY.md`
- `docs/design/SPACING.md`
- `docs/design/COMPONENTS.md`
- `docs/design/RUN_SCREEN.md`
- `docs/design/LIVE_ACTIVITY.md`
- `docs/design/SETTINGS.md`
- `docs/design/VOICE_UI.md`
