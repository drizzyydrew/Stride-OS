# Movement Lab Camera Rules

These rules govern both generated demonstration assets and user-capture guidance. The exact movement-level requirement is defined in [`movement_lab_design_system.md`](./movement_lab_design_system.md) and encoded in [`movement_asset_manifest.json`](./movement_asset_manifest.json).

## Canonical view vocabulary

Only these labels are valid unless a future specification explicitly adds another:

| Label | Definition | Analysis use |
|---|---|---|
| `direct_front` | Camera optical axis is perpendicular to Dion's frontal plane; both shoulders and both hips appear square and balanced in frame. | Bilateral frontal-plane alignment and symmetry. |
| `direct_left_side` | Camera is exactly perpendicular to Dion's sagittal plane on his left side; left-side landmarks are closest. | Left-side sagittal motion only. |
| `direct_right_side` | Camera is exactly perpendicular to Dion's sagittal plane on his right side; right-side landmarks are closest. | Right-side sagittal motion only. |
| `direct_back` | Camera optical axis is perpendicular to Dion's back; both shoulders and both hips appear square in frame. | Bilateral posterior/frontal-plane alignment and symmetry. |
| `user_selected_direct_view` | User explicitly selects direct front, direct side, or direct back before a custom capture. | Only metrics valid for the selected plane. |

`Direct lateral` means either `direct_left_side` or `direct_right_side`. The canonical identity side reference shows Dion's left side, but a right-side movement asset may be created when the assessment needs the opposite limb closest to camera.

## Non-negotiable orientation rules

- Direct frontal means directly frontal.
- Direct lateral means directly lateral.
- Direct posterior means directly posterior.
- No 45-degree or three-quarter views unless a future asset request explicitly requires one.
- Never label a three-quarter image as frontal, lateral, or posterior.
- Do not rotate Dion's head or torso toward the camera in a lateral or posterior reference.
- Keep the camera level. Do not use Dutch angles, overhead views, low-angle hero views, or wide-angle distortion.

## Plane-specific analysis rules

### Lateral assessments

- Analyze only the limb closest to the camera.
- Never combine the near hip with the far knee or the near knee with the far ankle.
- Never report both limbs' sagittal curves from one lateral capture as though they are equally reliable.
- If the closest limb cannot be determined confidently, require the user or asset brief to identify it.
- For bilateral comparison, create or capture a separate direct-lateral view with each tested limb closest to the camera.

### Frontal and posterior assessments

- Analyze bilateral symmetry and frontal-plane relationships.
- Both shoulders, both hips, both knees, and both ankles must be visible when relevant.
- Use left/right comparisons only when both sides have adequate visibility and confidence.
- Do not treat knee flexion, hip flexion, or other sagittal angles as primary measurements from a frontal or posterior view.

## Camera placement

### Standard full-body strength and control assessments

- Camera height: approximately hip height.
- Camera distance: normally 3–4 m; 3–5 m when the movement travels or uses equipment.
- Lens: neutral perspective equivalent; avoid ultra-wide settings.
- Sensor plane: vertical and parallel to the movement plane.
- Framing: portrait by default for single-position assets; allow landscape video capture only when horizontal travel requires it.

### Running and walking gait

- Camera height: approximately hip height.
- Camera distance: 3–5 m from the travel line, or fixed perpendicular to a treadmill.
- Camera must be perpendicular to the direction of travel at the analysis zone.
- Show the full body across a complete stride without panning-induced tilt.
- Keep the entire contact surface and both shoes visible.
- For generated phase images, keep camera position, crop, subject scale, and background fixed across all phases.

### Knee-to-wall

- Camera height: low, near ankle or lower-shin height.
- Distance: approximately 1–1.5 m.
- Use a true lateral view of the tested limb.
- Clearly show the great-toe region, heel contact, ankle, knee, wall, and wall-contact point.
- Avoid perspective that makes the foot-to-wall distance unreadable.

### Single-leg heel raise

- Camera height: ankle to lower-shin height.
- Distance: approximately 1.5–2 m.
- Use a true lateral view of the tested limb.
- Show the complete tested foot, heel, ankle, and calf; include the knee when the asset is intended to show knee position.
- A light fingertip balance contact is allowed, but the support surface must not obscure the ankle or heel.

## Framing requirements

- Full-body means the top of the head through both shoes is visible with clear margin.
- Never crop a joint required by the assessment.
- Never crop hands or feet in a way that conceals generation defects.
- Keep the subject large enough for joint positions to be legible but not so large that movement leaves the frame.
- Maintain the same scale and crop across a start/end or multi-phase asset set.
- Keep the floor line level and consistent across related assets.
- Equipment and the complete motion path must fit in frame when relevant.

## Occlusion and visibility

- Required joints must not be hidden by equipment, clothing folds, the far limb, furniture, or overlays.
- In lateral assets, minor far-limb overlap is acceptable only when the closest-side hip, knee, ankle, and shoe remain unambiguous.
- In frontal/posterior assets, both limbs must be separable enough for bilateral comparison.
- Hands may not cover the hip or knee landmarks used by the assessment.
- Hair and clothing may not obscure the neck, shoulder line, pelvis line, or joint centers needed for the selected measurements.

## Consistency across an asset set

For all phases of the same movement, lock:

- Camera view, height, distance, focal perspective, crop, and horizon.
- Dion's identity, body proportions, skin tone, hair, beard, clothing, and shoes.
- Room layout, dumbbell rack, plant, wall, floor, lighting direction, exposure, and white balance.
- Equipment model, size, color, and placement.

Only the requested body position and unavoidable equipment motion may change.

## Camera quality rejection criteria

Reject an asset when:

- The requested direct view is actually three-quarter.
- The camera is tilted, too high, too low, or visibly distorted.
- A required joint or shoe is cropped or occluded.
- The closest lateral limb is ambiguous.
- A frontal/posterior view prevents bilateral comparison.
- The subject scale, room, or camera changes between phases.
- Motion blur prevents landmark identification.
- The asset contains permanent analysis overlays, text, or measurement marks.
