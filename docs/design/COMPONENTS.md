# Components

Status: official Phase 2 shared component guidance.

## Metric Card

Used by Live Activity, paused state, and compact run summaries.

Anatomy:

- Header: brand mark or icon, title, optional state chip.
- Primary metrics: time and distance.
- Secondary metrics: pace, heart rate, elevation.
- Divider: one vertical divider between metric groups when space allows.
- Primary action: full-width button at the bottom.

Rules:

- Time and distance always dominate.
- Secondary metrics use icons only when they help scanning.
- Do not add extra explanatory text inside run cards.
- Preserve the same metric order across all surfaces.

## Primary Run Button

Variants:

- Pause: clay in light Live Activity, sage in dark run screen if contrast is better.
- Resume: sage or clay depending on mode and surrounding contrast.
- Stop: clay circular button in light mode, sage circular button in dark mode, or critical only when confirming an end state.
- Low battery: brown or critical background.

Rules:

- Minimum height: 48 pt.
- Circular in active full-screen run mode.
- Pill-shaped in widgets and paused cards.
- Include an icon for pause, play, resume, or stop.
- Label only when the button is pill-shaped.

## Icon Buttons

Used for location, map layers, and utility actions.

Rules:

- Circular hit target: at least 44 x 44 pt.
- Visual icon size: 18-22 pt.
- Dark mode background: translucent black or `inkRaised`.
- Light mode background: translucent white.
- Use native symbols where available.

## Music Row

Reference text: `Connect Music`.

Rules:

- Fixed at the bottom of the in-run panel.
- Height: 44-52 pt.
- Left icon: music note, 18-20 pt.
- Right chevron: 14-16 pt.
- Background should be slightly raised from the panel.
- Apple Music implementation is future scope.
- Spotify is postponed and should not appear as a primary CTA.

## Pagination Dots

Used under active run metrics.

Rules:

- Diameter: 5-7 pt.
- Gap: 5-7 pt.
- Active dot uses mode-appropriate accent.
- Inactive dots use muted text color.
- Keep the dots compact and centered.

## Settings Row

Anatomy:

- Optional leading icon.
- Label.
- Optional value.
- Toggle, chevron, or picker affordance.

Rules:

- Minimum height: 44 pt.
- Use grouped cards with 12-16 pt radius.
- Avoid nested cards.
- Use native toggle sizing and behavior.
- Keep row labels sentence case.

## Run Type Row

Anatomy:

- Leading icon.
- Title.
- Short description.
- Chevron.

Rules:

- Height: 64-76 pt.
- Icon container: 36-44 pt.
- Description may wrap to two lines.
- Rows should be separated by 8-10 pt.
- Use this pattern for future run types, but do not build adaptive run screens.

## Chips

Used for short state labels such as `Z2`.

Rules:

- Height: 28-32 pt.
- Horizontal padding: 10-12 pt.
- Radius: fully round.
- Text: 12-14 pt, 700 weight.
- Background: sage or muted dark surface depending on mode.

## Dividers

Rules:

- Use hairlines sparingly.
- Dark divider: `inkBorder`.
- Light divider: `#E7DED4`.
- Avoid boxed grids. The reference uses simple separations, not table-like layouts.

