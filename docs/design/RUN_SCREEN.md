# Run Screen

Status: official Phase 2 in-run and paused screen reference.

## Scope

This document covers the active in-app run screen and paused map plus stats screen. Adaptive run screens are not part of Phase 2.

## Layout Philosophy

The run screen is a map-first control surface. It should answer three questions immediately:

1. Where am I?
2. How long and how far have I run?
3. What is the next safe action?

The reference keeps the map visible, places metrics in a bottom panel, and uses one large central control.

## Active Run Screen

Structure:

- Full-screen map.
- Top status bar area remains native and unobstructed.
- Right-side floating map controls for location and layers.
- Bottom metric panel with rounded top corners.
- Main metric row: time and distance.
- Secondary metric row: average pace, heart rate, elevation gain.
- Pagination dots.
- Large circular pause or stop control.
- Bottom music row.

## Active Metrics

Order:

1. Time
2. Distance
3. Average pace
4. Heart rate
5. Elevation gain

Rules:

- Time and distance use the largest type.
- Distance may use an accent color in dark mode.
- Secondary metrics are equal-width columns.
- Keep labels directly under values.
- Do not add coaching text over the map during the base active state.

## Active Controls

Primary circular control:

- Diameter: 64-72 pt.
- Icon size: 24-28 pt.
- Centered horizontally below pagination.
- Color: sage in dark mode, clay in light mode.

Floating map controls:

- Diameter: 36-44 pt.
- Stack vertically with 8-10 pt gap.
- Use translucent circular backgrounds.
- Location icon above layers icon.

Music row:

- Height: 44-52 pt.
- Anchored near the bottom inside the panel.
- Text: `Connect Music`.
- Future Apple Music integration may connect here.
- Do not add Spotify in Phase 2.

## Dark Active Screen

- Map should be dark and low contrast.
- Route line should be sage or steel and clearly visible.
- Bottom panel should use `ink` or `inkRaised`.
- Use subtle separators only.
- Primary metrics use off-white.
- Distance accent may use sage.

## Light Active Screen

- Map should use warm sand, pale green, and white roads.
- Bottom panel should use `sand` or a warm white.
- Primary metrics use near-black.
- Distance accent may use sage.
- Primary circular control uses clay.

## Paused Screen

Structure:

- Compact card with map thumbnail on the left.
- Stats on the right.
- State label `PAUSED` above primary metrics when space allows.
- Resume button at lower right.
- Small GPS note below card if needed.

Metric order:

1. Time
2. Distance
3. Average pace
4. Heart rate
5. Elevation gain

Resume button:

- Label: `RESUME RUN`.
- Icon: play.
- Height: 50-56 pt.
- Fill: sage in dark mode or clay in light mode.
- Radius: 20-24 pt.

## Paused Layout Rules

- Map thumbnail and stats should share one card.
- Do not place a card inside another card.
- Keep the resume action in the same visual group as the stats.
- Paused state should feel calm, not like an error.
- GPS tracking note should be small and low emphasis.

## Map Rules

- Route line should be visible but not neon.
- Current position marker should be high contrast.
- Avoid heavy map labels during a run.
- Map controls should never cover primary metrics.
- Map content should not sit under the Dynamic Island or status bar without safe spacing.

## Future Run Types

The reference includes future run type rows:

- Quick Start
- Time Goal
- Distance Goal
- Workout
- Race

These rows define the selection pattern only. They do not authorize adaptive run screens in Phase 2.

