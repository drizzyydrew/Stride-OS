# Movement Lab Measurement Rules

This document defines which measurements belong to each assessment. It is a design and image-generation contract, not a claim that every listed measurement is currently available in application code.

## Measurement classes

| Class | Meaning |
|---|---|
| **Automatic now** | May be estimated from the current 2D landmark pipeline when view, visibility, and confidence requirements pass. |
| **Manual now** | Entered, counted, calibrated, or confirmed by a person; never fabricated by image generation or pose estimation. |
| **Future automatic** | Appropriate to the assessment only after the required landmarks, object tracking, temporal validation, or calibration exist. |
| **Prohibited** | Out of plane, unrelated, unsupported, or misleading for the assessment. Omit rather than estimate. |

Every automatic angle is an **estimated 2D projection**, not an exact clinical measurement. Missing or low-confidence inputs produce no value. Do not interpolate, infer, or hide a missing value.

## Global permission rules

- Direct lateral: analyze only the closest limb for sagittal hip, knee, ankle, and foot relationships.
- Direct frontal/posterior: analyze bilateral symmetry, pelvic obliquity, frontal-plane knee position, and trunk lateral lean.
- Do not report sagittal knee or hip flexion as a primary metric from frontal/posterior images.
- Do not report frontal-plane alignment as a primary metric from a lateral image.
- No 45-degree view supports automatic measurement unless a future specification defines and validates it.
- Head position is a qualitative head-to-trunk relationship unless a validated metric is explicitly defined.
- Lateral hip sagittal motion uses the visible trunk and femur axes to estimate anatomical flexion or extension. Neutral upright standing is approximately 0° flexion; increasing flexion is positive; extension is named directly rather than shown as negative flexion. Always qualify it as an estimated two-dimensional anatomical angle based on visible landmarks and camera view, not isolated clinical goniometry.
- Ankle dorsiflexion, plantarflexion, footstrike, foot progression, toe angle, and heel height require foot/heel/toe landmarks or a manual method. They are not current automatic measurements.
- Joint moments, forces, loading rates, muscle activation, pain, tissue stress, and injury risk cannot be derived from a generated still or ordinary monocular 2D video.
- Manual findings must identify the observer or user-entered source when stored.
- Bilateral differences must show both values and should not be emphasized when they fall within expected measurement noise.

## 1. Bodyweight Squat — Running Readiness Battery

**Required view:** direct lateral. **Allowed supplemental view:** direct frontal.

### Measure

- Head position relative to trunk: qualitative manual observation.
- Trunk inclination relative to vertical: automatic now from lateral view.
- Closest-side anatomical hip flexion or extension pattern: automatic now as an estimated 2D sagittal angle when lateral orientation is established.
- Closest-side knee flexion and depth across repetitions: automatic now.
- Closest-side ankle dorsiflexion: manual now; future automatic only with reliable heel/toe/foot landmarks.
- Heel contact and foot stability: manual qualitative observation.
- Rep duration and depth consistency: automatic now when a valid sequence is available.
- Frontal pelvic level, bilateral knee tracking, and trunk lateral lean: automatic only from a separate direct-frontal capture.

### Do not measure

- Elbow flexion, wrist angle, finger position, or grip.
- Shoulder range unless a future overhead-squat assessment explicitly requires it.
- Far-limb sagittal hip, knee, or ankle angles from one lateral capture.
- Lumbar segment angle as distinct from overall trunk inclination.
- Joint moments, spinal loading, center of pressure, or injury risk.

### Automatic now

- Closest-side knee flexion series and peak depth.
- Closest-side estimated anatomical hip flexion at bottom.
- Trunk inclination at bottom.
- Repetition count, duration, and depth consistency when detection confidence supports them.
- Supplemental frontal pelvic obliquity, frontal knee position, and trunk lateral lean.

### Manual now

- Head/neck alignment, heel lift, foot stability, ankle dorsiflexion, balance loss, and pain/symptom report.

## 2. Single-Leg Squat — Running Readiness Battery

**Required view:** direct frontal, one tested side at a time. **Allowed supplemental view:** direct lateral with the tested leg closest.

### Measure

- Standing-leg frontal-plane knee position/FPPA: automatic now.
- Pelvic obliquity or contralateral pelvic drop: automatic now.
- Trunk lateral lean: automatic now.
- Hip adduction appearance and femur alignment: manual now; future automatic after metric validation.
- Depth control and rep-to-rep consistency: manual from frontal view; automatic from a separate lateral view.
- Lateral-view standing-leg knee flexion, estimated anatomical hip flexion or extension, and trunk inclination: automatic now for the closest leg only.
- Foot stability and balance corrections: manual observation.

### Do not measure

- Sagittal knee flexion or hip flexion as a primary metric from the frontal capture.
- Non-weight-bearing-leg angles as performance metrics.
- Elbow, wrist, or finger angles.
- Ankle dorsiflexion without validated foot landmarks.
- Far-limb sagittal angles from a lateral capture.
- Injury risk or diagnostic labels from knee position alone.

### Automatic now

- Frontal knee position, pelvic obliquity, and trunk lateral lean.
- Supplemental lateral closest-side knee flexion, estimated hip angle, and trunk inclination.

### Manual now

- Balance loss, foot movement, depth target, hip-adduction appearance, rep quality, symptom report, and confirm/unclear/override review.

## 3. Split-Stance Lunge — Running Readiness Battery

**Required view:** direct lateral with the front/tested limb closest. **Allowed supplemental view:** direct frontal.

### Measure

- Front-leg knee flexion at bottom: automatic now.
- Front-leg estimated hip angle: automatic now.
- Trunk inclination: automatic now.
- Rear-knee clearance and split-stance depth: manual now.
- Front heel contact and front knee relationship to foot: manual now.
- Rep duration and depth consistency: automatic now when sequence confidence supports them.
- Supplemental frontal pelvic level, front-knee position, and trunk lateral lean: automatic from a separate direct-frontal capture.

### Do not measure

- Both limbs' sagittal angles from the same lateral clip.
- Rear-leg knee angle when the rear leg is the far limb or occluded.
- Ankle dorsiflexion without foot landmarks.
- Elbow, wrist, finger, or shoulder angles.
- Pelvic rotation from a single 2D lateral image.
- Joint loading, balance force, or injury risk.

### Automatic now

- Closest/front-side knee flexion, estimated hip angle, and trunk inclination.
- Rep segmentation, bottom position, duration, and consistency.
- Supplemental frontal pelvic obliquity, frontal knee position, and trunk lateral lean.

### Manual now

- Rear-knee clearance, stance length, heel contact, balance, foot direction, and symptom report.

## 4. Knee-to-Wall Test — Running Readiness Battery

**Required view:** close direct lateral of the tested limb. **Allowed supplemental view:** none for the primary result; repeat separately for the other side.

### Measure

- Great-toe-to-wall distance in centimeters: manual now and the primary result.
- Tibial inclination relative to vertical: manual now when a calibrated inclinometer or validated image method is used.
- Heel contact, knee-wall contact, and knee tracking over the foot: manual quality checks.
- Left/right distance difference: calculated from two manual values.

### Do not measure

- Automatic ankle dorsiflexion from the current body-pose landmarks.
- Hip flexion, knee flexion, trunk angle, upper-body posture, elbow, wrist, or finger position.
- Foot progression angle from a lateral view.
- Calf flexibility as a direct tissue measurement.
- Diagnosis, injury risk, or a universal pass/fail threshold from one value.

### Automatic now

- None. The current landmark set lacks the foot points and scale calibration required for a defensible automatic result.

### Manual now

- Left and right toe-to-wall distance, optional tibial inclination, heel-down confirmation, wall contact, and symptom report.

### Future automatic

- Calibrated toe-to-wall distance and tibial inclination after foot landmarks, scale, wall plane, and validation are available.

## 5. Single-Leg Heel Raise — Running Readiness Battery

**Required view:** close direct lateral of the tested limb. **Allowed supplemental view:** direct posterior for bilateral heel-path comparison only.

### Measure

- Completed quality repetitions per side: manual now and the primary result.
- Peak heel-rise height: manual now; future automatic with heel/toe landmarks and scale.
- Heel-rise height decline across repetitions: manual now; future automatic.
- Tempo and rep-duration consistency: manual now; future automatic temporal metric.
- Knee position, balance support, and loss of full height: manual quality observations.
- Left/right repetition difference: calculated from two manual counts.

### Do not measure

- Automatic plantarflexion angle or heel height with the current landmark set.
- Hip flexion, trunk inclination, elbow, wrist, finger, or shoulder angles.
- Calf muscle force, Achilles tendon load, fatigue percentage, or injury risk.
- Rep count from a single still image.

### Automatic now

- None for the primary capacity result.

### Manual now

- Left/right quality repetition counts, height decline onset, tempo consistency, knee-bend compensation, balance support, and symptoms.

### Future automatic

- Rep count, heel height, peak-height consistency, decline-onset rep, and tempo after validated foot landmarks and temporal tracking exist.

## 6. Easy Running Gait — Running Readiness Battery

**Required view:** direct lateral. **Allowed supplemental views:** direct frontal and direct posterior in separate captures.

### Measure

- Closest-side knee flexion across the gait cycle: automatic now.
- Closest-side estimated hip angle across the gait cycle: automatic now.
- Trunk inclination: automatic now.
- Estimated cadence and approximate contact timing: automatic only when temporal confidence supports them; label as estimates.
- Foot position relative to body at contact/overstride appearance: manual now.
- Frontal/posterior pelvic obliquity, frontal knee position, trunk lateral lean, crossover appearance, and bilateral symmetry: separate direct-view capture.
- Ankle dorsiflexion, tibial inclination, and footstrike: future only with validated foot landmarks; footstrike is not a current result.

### Do not measure

- Far-limb sagittal angles from one lateral capture.
- Footstrike classification, ankle angle, or foot progression with the current landmarks.
- Exact initial contact or toe-off as a measured event; current events are approximate.
- Ground-contact time, flight time, stride length, or speed without validated frame rate and spatial calibration.
- Joint moments, loading rate, muscle activation, running economy, or injury risk.

### Automatic now

- Closest-side knee flexion, estimated hip angle, trunk inclination, sequence ranges, and approximate contact moments.
- Estimated cadence only when event detection and frame timing pass confidence requirements.
- Supplemental frontal/posterior pelvic obliquity, frontal knee position, and trunk lateral lean.

### Manual now

- Overstride appearance, crossover appearance, arm-swing notes, footstrike not classified, capture surface/speed context, and symptom report.

## 7. Walking Gait — Running Readiness Battery

**Required view:** direct lateral. **Allowed supplemental views:** direct frontal and direct posterior in separate captures.

### Measure

- Closest-side knee flexion through stance and swing: automatic now.
- Closest-side estimated hip angle through the cycle: automatic now.
- Trunk inclination: automatic now.
- Estimated cadence and approximate contact timing: automatic only with adequate temporal confidence.
- Step symmetry and foot placement: manual now or separate frontal/posterior assessment.
- Supplemental pelvic obliquity, frontal knee position, and trunk lateral lean: automatic from direct front/back capture.
- Ankle motion and foot progression: future only with validated foot landmarks.

### Do not measure

- Far-limb sagittal angles from one lateral capture.
- Footstrike, ankle dorsiflexion, toe clearance, or foot progression with the current landmarks.
- Exact double-support time, step length, walking speed, or ground reaction forces without calibration.
- Joint moments, neurologic diagnosis, fall risk, or injury prediction.
- Upper-limb angles unless a future gait-specific arm-swing metric is defined.

### Automatic now

- Closest-side knee flexion, estimated hip angle, trunk inclination, sequence ranges, and approximate contact moments.
- Estimated cadence when confidence supports it.
- Supplemental frontal/posterior pelvic obliquity, frontal knee position, and trunk lateral lean.

### Manual now

- Step symmetry, crossover or wide-base appearance, arm swing, balance events, assistive-device context, and symptoms.

## 8. Running Gait Analysis — Standalone Movement Lab

**Required view:** direct lateral. **Allowed supplemental views:** direct frontal and direct posterior.

### Measure

- Closest-side knee flexion range and key-phase values: automatic now.
- Closest-side estimated hip angle range and extension pattern: automatic now.
- Trunk inclination and variation: automatic now.
- Estimated cadence and approximate contact events: automatic when confidence supports them.
- Foot inclination at contact, tibial inclination, ankle dorsiflexion, and footstrike: future automatic only with validated foot landmarks.
- Overstride appearance and foot-under-body relationship: manual now.
- Frontal/posterior pelvic drop, trunk lean, knee position, crossover gait, and bilateral symmetry: separate direct-view capture.
- Arm-swing quality: manual qualitative note only unless a dedicated metric is later validated.

### Do not measure

- Both legs' sagittal curves from a single lateral view as equally reliable.
- Footstrike or ankle angle with current landmarks.
- Exact contact/flight time, speed, stride length, or vertical oscillation without validated calibration.
- Joint moments, forces, loading rate, tissue stress, metabolic economy, diagnosis, or injury risk.
- Elbow/wrist/finger angles as primary running metrics.

### Automatic now

- Closest-side knee flexion, estimated hip angle, trunk inclination, sequence ranges, and approximate contact moments.
- Estimated cadence when event confidence supports it.
- Separate frontal/posterior pelvic obliquity, frontal knee position, and trunk lateral lean.

### Manual now

- Overstride, crossover, arm swing, visible foot placement, surface, footwear, pace context, and symptom notes.

## 9. Squat Analysis — Standalone Movement Lab

**Required view:** direct lateral. **Allowed supplemental view:** direct frontal.

### Measure

- Head-to-trunk position: manual qualitative observation.
- Trunk inclination: automatic now.
- Closest-side estimated hip angle and hip-depth pattern: automatic now.
- Closest-side knee flexion range and bottom position: automatic now.
- Ankle dorsiflexion, heel lift, and foot stability: manual now; future automatic with foot landmarks.
- Rep count, duration, depth, and consistency: automatic now.
- Supplemental frontal pelvic level, bilateral knee position, and trunk lateral lean: automatic from a direct-frontal capture.

### Do not measure

- Elbow, wrist, finger, grip, or unrelated shoulder angles.
- Far-limb sagittal angles from the lateral view.
- Isolated lumbar flexion, pelvic rotation, center of pressure, bar path, or joint loading.
- Ankle angle without foot landmarks.
- Injury risk or diagnostic classification.

### Automatic now

- Closest-side knee flexion, estimated hip angle, trunk inclination, key frames, rep count, duration, and depth consistency.
- Supplemental frontal pelvic obliquity, frontal knee position, and trunk lateral lean.

### Manual now

- Head position, heel contact, foot stability, stance context, external load context, and symptoms.

## 10. Deadlift Analysis — Standalone Movement Lab

**Required view:** direct lateral with the analyzed side closest. **Allowed supplemental view:** direct frontal for symmetry and bar centering only.

### Measure

- Trunk inclination at setup, lift, and lockout: automatic now.
- Closest-side estimated hip angle through the lift: automatic now.
- Closest-side knee flexion through setup and ascent: automatic now.
- Hip and knee extension timing relationship: automatic sequence comparison when confidence supports it.
- Bar-to-body distance, bar path, grip symmetry, and bar level: manual now; future automatic after validated object tracking.
- Head-to-trunk alignment and visible spinal continuity: manual qualitative observation.
- Supplemental frontal pelvic level, knee position, and trunk lateral lean: automatic from a separate frontal capture.

### Do not measure

- Far-limb sagittal angles from one lateral capture.
- Lumbar flexion as a distinct spinal-segment angle from shoulder/hip landmarks.
- Elbow, wrist, finger, or grip angles as primary automatic metrics.
- Bar speed, force, power, spinal load, joint moments, or weight from an image.
- Injury risk or claims that one visible posture diagnoses tissue stress.

### Automatic now

- Closest-side knee flexion, estimated hip angle, trunk inclination, key positions, rep duration, and consistency.
- Supplemental frontal pelvic obliquity, frontal knee position, and trunk lateral lean.

### Manual now

- Bar path, bar proximity, equipment setup, head position, grip, load, stance, visible spinal continuity, and symptoms.

## 11. Single-Leg Control Analysis — Standalone Movement Lab

**Required view:** direct frontal. **Allowed supplemental view:** direct lateral with the tested limb closest.

### Measure

- Standing-leg frontal knee position/FPPA: automatic now.
- Pelvic obliquity/contralateral drop: automatic now.
- Trunk lateral lean: automatic now.
- Hip adduction appearance, balance corrections, and foot stability: manual now.
- Depth, knee flexion, estimated hip angle, and trunk inclination: automatic only from a separate direct-lateral capture with the tested limb closest.
- Rep-to-rep control and side-to-side comparison: compare equivalent separate trials.

### Do not measure

- Sagittal knee or hip flexion from the frontal view as a primary metric.
- Non-weight-bearing-leg angles as performance outcomes.
- Ankle dorsiflexion without foot landmarks.
- Elbow, wrist, finger, or shoulder angles.
- Injury risk, diagnosis, or causal claims from frontal knee position.

### Automatic now

- Frontal knee position, pelvic obliquity, and trunk lateral lean.
- Supplemental lateral closest-side knee flexion, estimated hip angle, and trunk inclination.

### Manual now

- Balance loss, foot stability, depth target, hip-adduction appearance, task variation, and symptoms.

## 12. Lunge Analysis — Standalone Movement Lab (Future)

**Required view:** direct lateral with the lead/tested limb closest. **Allowed supplemental view:** direct frontal.

### Measure

- Lead-leg knee flexion: automatic now once the future workflow is enabled.
- Lead-side estimated hip angle: automatic now once enabled.
- Trunk inclination: automatic now once enabled.
- Rep count, bottom position, duration, and consistency: automatic sequence metrics once enabled.
- Rear-knee clearance, stance length, heel contact, and foot direction: manual.
- Supplemental frontal pelvic level, lead-knee position, and trunk lateral lean: automatic from a direct-frontal capture.

### Do not measure

- Both limbs' sagittal angles from one lateral clip.
- Rear-limb angles when occluded or farther from camera.
- Ankle dorsiflexion without foot landmarks.
- Elbow, wrist, finger, or unrelated shoulder angles.
- Pelvic rotation, joint loading, or injury risk from one 2D view.

### Automatic when enabled

- Closest/lead-side knee flexion, estimated hip angle, trunk inclination, rep segmentation, and consistency.
- Supplemental frontal pelvic obliquity, frontal knee position, and trunk lateral lean.

### Manual

- Stance length, rear-knee clearance, heel contact, foot direction, balance, equipment context, and symptoms.

## 13. Custom Movement Upload — Standalone Movement Lab

**Required view:** user-selected direct front, direct lateral, or direct back. **Allowed views:** only the explicitly selected direct view.

### Measure

- Only measurements declared in a movement-specific plan before analysis.
- Direct lateral: closest-side knee flexion, estimated hip angle, and trunk inclination when those metrics match the movement.
- Direct frontal/posterior: pelvic obliquity, frontal knee position, trunk lateral lean, and bilateral symmetry when those metrics match the movement.
- Manual notes for equipment, phase, task goal, symptoms, and observations outside the automatic matrix.

### Do not measure

- Any metric solely because landmarks are visible.
- Cross-plane angles from the wrong camera view.
- Elbow, wrist, finger, shoulder, ankle, or foot metrics unless the custom plan explicitly defines a validated method.
- Far-limb sagittal angles from a lateral view.
- Joint moments, forces, loading, diagnosis, injury risk, or unsupported sport-specific claims.
- Any value when the movement, phase, view, or closest side is unknown.

### Automatic now

- Only the view-valid subset explicitly approved in the custom measurement plan.

### Manual now

- Movement name, purpose, start/end phase, selected view, closest side when lateral, equipment, observer notes, and all unsupported-but-relevant qualitative observations.

## 14. Bike Fit — Standalone Movement Lab

**Required view:** direct lateral, camera perpendicular to the rider at approximately hip/crank height. **Allowed supplemental view:** none in the initial workflow.

### Measure

- Closest-side knee flexion near the estimated top pedal phase: automatic now when lateral orientation, phase visibility, and landmark confidence pass.
- Closest-side knee angle near the estimated bottom pedal phase: automatic now under the same conditions.
- Closest-side estimated anatomical hip flexion near the top pedal phase: automatic now.
- Trunk inclination: automatic now.
- Closest-side elbow angle and shoulder position: automatic now only when the arm landmarks remain visible and confident.
- Top and bottom phase selection: estimated automatically from the visible knee cycle, then manually reviewed.
- Rider comfort, bicycle type, trainer setup, resistance, cadence context, and symptoms: manual context.

### Do not measure

- Both sides' sagittal curves or lateral symmetry from one side-view clip.
- Ankle position or angle without validated foot landmarks.
- Saddle fore-aft from knee position without true pedal-spindle/object tracking.
- Cleat position, pelvic rocking, pressure distribution, force, joint loading, or tissue stress.
- Exact bicycle geometry, aerodynamic optimization, diagnosis, or injury prediction.
- A complete professional bike fit from one ordinary two-dimensional phone video.

### Automatic now

- Closest-side knee-flexion series.
- Closest-side estimated hip flexion.
- Trunk inclination.
- Closest-side elbow and shoulder angles when supported.
- Estimated top and bottom pedal-phase key frames.

### Manual now

- Confirmation of the closest side and pedal phases.
- Bicycle/trainer setup, visibility of hands/saddle/feet/crank/pedals, effort context, comfort, and symptom notes.
- Any recommendation to change saddle or handlebar position.

### Required limitations

- Every numeric value is an estimated two-dimensional projection based on the available lateral view.
- Pedal phases require manual confirmation.
- Manual review recommended.
- This does not replace an in-person bike fit.

## Output rules for all assessments

- Label every angle `Estimated`.
- Pair every numeric value with units, view, side, phase, and confidence.
- Pair every finding with plain-language meaning, a conservative training-oriented next step, and limitations.
- Use `Manual review recommended` for missing, ambiguous, occluded, or low-confidence data.
- Pain or symptoms are athlete-reported and never interpreted; advise consultation with a qualified clinician for pain or injury concerns.
- Never turn a generated demonstration image into evidence about an actual athlete.
