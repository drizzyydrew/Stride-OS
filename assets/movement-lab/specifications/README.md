# Movement Lab Specifications

This folder is the source of truth for every future StrideOS Movement Lab assessment-image generation task. It defines the movement, camera, measurement, branding, asset naming, and validation contracts that keep all Dion assets consistent.

## Required reading order

Before generating, editing, approving, or replacing any Movement Lab assessment asset, every AI agent must read:

1. [`movement_lab_design_system.md`](./movement_lab_design_system.md)
2. [`camera_rules.md`](./camera_rules.md)
3. [`measurement_rules.md`](./measurement_rules.md)
4. [`branding_rules.md`](./branding_rules.md)
5. [`movement_asset_manifest.json`](./movement_asset_manifest.json)
6. [`../dion/DION_CANONICAL_REFERENCE.md`](../dion/DION_CANONICAL_REFERENCE.md)

At least one canonical Dion PNG from [`../dion/`](../dion/) must be supplied as an image reference for every generation. A text description alone is not sufficient.

## Scope

These files specify assets; they do not implement application UI, pose detection, scoring, or coaching logic. Source images must remain clean and free of baked-in joint markers, angle lines, labels, scores, or diagnoses. Those analytical elements normally belong to the app.

## Naming

Use lowercase snake case:

`dion_<movement>_<view>_<position>_v<number>.png`

Examples:

- `dion_bodyweight_squat_side_bottom_v1.png`
- `dion_single_leg_squat_front_bottom_v1.png`
- `dion_running_gait_side_midstance_v1.png`

Never overwrite an approved asset casually. Increment the version and preserve the prior reviewed file until the replacement is explicitly approved.
