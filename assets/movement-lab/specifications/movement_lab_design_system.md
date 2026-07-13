# StrideOS Movement Lab Design System

Version: 1

Status: Canonical specification

Last updated: 2026-07-12

## Purpose

This is the canonical creative and assessment specification for every StrideOS Movement Lab demonstration asset. It standardizes Dion's identity, movement positions, camera geometry, measurement permissions, filenames, outputs, and future AI Coach framing so future image tasks do not need large one-off prompts.

This document does not implement UI or analysis logic. It defines what future assets must depict and which assessment concepts those assets support.

## Required source set

Every future image-generation agent must read this complete source set before generating or modifying an asset:

- [`README.md`](./README.md)
- [`camera_rules.md`](./camera_rules.md)
- [`measurement_rules.md`](./measurement_rules.md)
- [`branding_rules.md`](./branding_rules.md)
- [`movement_asset_manifest.json`](./movement_asset_manifest.json)
- [`../dion/DION_CANONICAL_REFERENCE.md`](../dion/DION_CANONICAL_REFERENCE.md)

At least one canonical Dion PNG must be provided to the image model. Use the closest canonical view and include the canonical front reference whenever Dion's face is visible.

## System-wide rules

- Use canonical Dion, canonical wardrobe, and the canonical Movement Lab room.
- Source images contain no text, logos, joint markers, angle lines, scores, or baked-in overlays.
- Keep identity, anatomy, equipment, camera, lighting, crop, and environment fixed across every phase of a movement set.
- Use only direct front, direct lateral, or direct back views. No 45-degree views unless a later specification explicitly requests one.
- Lateral analysis uses only the limb closest to the camera.
- Frontal/posterior analysis evaluates bilateral symmetry and frontal-plane relationships.
- All 2D angles are estimates. Images and outputs are training aids, not diagnoses or injury predictions.
- Planned filenames use lowercase snake case: `dion_<movement>_<view>_<position>_v<number>.png`.

## Asset-generation workflow

1. Select the assessment entry below and its matching manifest record.
2. Load the required canonical Dion PNG for the requested view.
3. Apply [`branding_rules.md`](./branding_rules.md) without reinterpretation.
4. Apply the exact view and framing from [`camera_rules.md`](./camera_rules.md).
5. Generate one movement phase per file using the required filename.
6. Inspect identity, view, anatomy, joint position, floor contact, equipment, wardrobe, room, lighting, and crop at full resolution.
7. Reject any file that violates a required check. Do not conceal defects.
8. Preserve the clean source file; app-rendered overlays are a separate concern.

---

# Running Readiness Battery

## 1. Bodyweight Squat

**Purpose:** Screen coordinated squat depth and control across the trunk, hips, knees, and ankles during a simple bilateral task.

**Clinical rationale:** A bodyweight squat provides a repeatable view of lower-extremity mobility and movement strategy. Findings may guide mobility or strength emphasis, but one squat screen does not diagnose dysfunction or predict injury.

**Primary joints analyzed:** Head/neck relationship, trunk, pelvis/hips, knees, ankles, and feet.

**Required camera view:** Direct lateral, with the analyzed limb closest to camera.

**Allowed camera view:** Direct frontal as a separate supplemental asset for bilateral knee tracking and pelvic/trunk symmetry.

**Required framing:** Full body from head through both shoes; camera at hip height, 3–5 m away; floor contact and all lower-limb joints visible through the full squat.

**Movement start position:** Upright stance, feet approximately shoulder-width, toes naturally forward or slightly outward, weight balanced through both feet, arms extended forward or relaxed in a fixed repeatable position.

**Movement end position:** Controlled bottom position at the deepest comfortable depth, heels grounded, knees tracking in line with feet, trunk balanced, no forced depth or collapse.

**Key coaching points:** Keep whole foot grounded; sit down and between the hips; allow knees to travel naturally in line with toes; keep the head aligned with the trunk; use a smooth controlled descent and ascent.

**Angles that SHOULD be measured:** Head-to-trunk position qualitatively; trunk inclination; closest-side estimated hip angle; closest-side knee flexion; ankle dorsiflexion when a manual or future validated foot-landmark method exists.

**Angles that SHOULD NOT be measured:** Elbow flexion, wrist angle, finger position, unrelated shoulder angles, far-limb sagittal angles, isolated lumbar angle, or joint moments.

**Automatic measurements:** Closest-side knee flexion, estimated hip angle, trunk inclination, rep count, bottom phase, duration, and depth consistency; optional frontal pelvic obliquity, frontal knee position, and trunk lateral lean from a separate frontal capture.

**Manual measurements:** Head/neck alignment, heel contact, foot stability, ankle dorsiflexion, balance loss, and symptoms.

**Expected output:** Estimated squat depth and trunk/hip/knee strategy, rep consistency, visible ankle/foot limitations, capture confidence, limitations, and a conservative readiness category.

**Future AI Coach summary:** Explain the clearest one or two movement findings, what they may mean for squat or running preparation, and up to three practical mobility or strength actions. Avoid injury prediction and `bad form` language.

**Required filename convention:** `dion_bodyweight_squat_side_<start|bottom>_v<number>.png`. Supplemental: `dion_bodyweight_squat_front_bottom_v<number>.png`.

## 2. Single-Leg Squat

**Purpose:** Screen frontal-plane control, balance, and side-to-side consistency during a unilateral squat.

**Clinical rationale:** Single-leg squat video can describe visible trunk, pelvis, hip, and knee control. These observations are useful for training decisions but are associations, not diagnoses or proof of injury risk.

**Primary joints analyzed:** Trunk, pelvis/hips, standing knee, standing ankle/foot, and non-weight-bearing leg only as task context.

**Required camera view:** Direct frontal, captured separately for each tested side.

**Allowed camera view:** Direct lateral with the tested leg closest for sagittal depth measures.

**Required framing:** Full body including both feet; camera at hip height, 3–4 m away; both shoulders, both hips, both knees, and tested foot visible.

**Movement start position:** Balanced upright stance on one leg, non-weight-bearing leg lifted forward, pelvis level, trunk steady, arms held consistently.

**Movement end position:** Controlled comfortable squat depth on the standing leg, standing knee aligned over the foot, pelvis and trunk controlled, non-weight-bearing foot off the floor.

**Key coaching points:** Keep tripod foot contact; track the standing knee over the middle toes; keep pelvis level; control trunk sway; use the same depth and tempo on each repetition.

**Angles that SHOULD be measured:** Frontal knee position/FPPA, pelvic obliquity, trunk lateral lean; supplemental lateral standing-knee flexion, estimated hip angle, and trunk inclination.

**Angles that SHOULD NOT be measured:** Primary sagittal knee/hip flexion from the frontal view, non-weight-bearing-leg angles as outcomes, ankle dorsiflexion without foot landmarks, upper-limb angles, or injury risk.

**Automatic measurements:** Frontal knee position, pelvic obliquity, trunk lateral lean; lateral closest-side knee flexion, estimated hip angle, and trunk inclination when a separate lateral clip exists.

**Manual measurements:** Balance corrections, foot movement, depth target, hip-adduction appearance, rep quality, symptoms, and confirm/unclear/override review.

**Expected output:** Per-side control findings, left/right comparison, confidence, manual confirmation state, limitations, and a training-oriented readiness category.

**Future AI Coach summary:** Describe side-specific knee, pelvis, and trunk control without calling normal variation defective; suggest one or two unilateral strength, balance, or technique priorities.

**Required filename convention:** `dion_single_leg_squat_front_<start|bottom>_v<number>.png`. Supplemental: `dion_single_leg_squat_side_bottom_v<number>.png`.

## 3. Split-Stance Lunge

**Purpose:** Screen lower-body control and usable range in a split stance relevant to running and unilateral strength work.

**Clinical rationale:** A split-stance lunge reveals front-leg knee/hip strategy, trunk control, balance, and tolerance for staggered loading. It informs training emphasis without diagnosing mobility or stability disorders.

**Primary joints analyzed:** Trunk, pelvis/hips, front knee, rear knee as visible context, front ankle/foot.

**Required camera view:** Direct lateral with the front/tested limb closest.

**Allowed camera view:** Direct frontal as a separate supplemental assessment.

**Required framing:** Full body and entire split stance; camera at hip height, 3–4 m away; both feet and both knees remain visible.

**Movement start position:** Stable split stance with feet on separate front-to-back tracks, torso upright, pelvis square, front heel grounded.

**Movement end position:** Controlled bottom position with front knee tracking over the foot, rear knee lowered toward the floor, trunk balanced, and both feet maintaining contact.

**Key coaching points:** Drop straight down; keep front heel grounded; track front knee with toes; keep pelvis square; maintain a quiet, controlled trunk.

**Angles that SHOULD be measured:** Closest/front-side knee flexion, estimated hip angle, trunk inclination; supplemental frontal knee position, pelvic obliquity, and trunk lateral lean.

**Angles that SHOULD NOT be measured:** Both limbs' sagittal angles from one lateral view, occluded rear-knee angle, ankle angle without foot landmarks, upper-limb angles, pelvic rotation, or joint loading.

**Automatic measurements:** Front-side knee flexion, estimated hip angle, trunk inclination, rep bottom, duration, and consistency; supplemental frontal metrics from a separate view.

**Manual measurements:** Rear-knee clearance, stance length, heel contact, balance, foot direction, and symptoms.

**Expected output:** Front-leg depth/control, trunk strategy, rep consistency, side comparison from equivalent trials, confidence, limitations, and readiness guidance.

**Future AI Coach summary:** Connect the most visible split-stance limitation to a practical mobility, unilateral-strength, or technique action without claiming injury causation.

**Required filename convention:** `dion_split_stance_lunge_side_<start|bottom>_v<number>.png`. Supplemental: `dion_split_stance_lunge_front_bottom_v<number>.png`.

## 4. Knee-to-Wall Test

**Purpose:** Measure weight-bearing ankle dorsiflexion using a standardized toe-to-wall distance and compare sides.

**Clinical rationale:** The weight-bearing lunge/knee-to-wall test is a practical, repeatable ankle range screen. Distance and side-to-side difference may guide mobility work, but results are not a diagnosis or universal injury threshold.

**Primary joints analyzed:** Tested foot/heel, ankle, tibia, and knee only as required for test position.

**Required camera view:** Close direct lateral of the tested limb.

**Allowed camera view:** None for the primary value; repeat the same direct-lateral setup for the other side.

**Required framing:** Great-toe region, full foot, heel, ankle, lower leg, knee, wall, and contact point; camera low at ankle/shin height, 1–1.5 m away.

**Movement start position:** Tested foot flat and aimed toward the wall, toes set a measurable distance away, heel down, knee aligned over the foot.

**Movement end position:** Knee touches the wall at the greatest controlled distance while the entire heel remains grounded and the knee stays aligned with the foot.

**Key coaching points:** Keep heel flat; drive knee forward over the middle toes; avoid foot collapse or rotation; move the foot until the farthest valid wall contact is found.

**Angles that SHOULD be measured:** Optional manually calibrated tibial inclination; the primary measurement is linear toe-to-wall distance, not an automatic joint angle.

**Angles that SHOULD NOT be measured:** Automatic ankle dorsiflexion with current landmarks, hip flexion, knee flexion as an outcome, trunk or upper-limb angles, and foot progression from the lateral image.

**Automatic measurements:** None currently for the primary result.

**Manual measurements:** Left/right toe-to-wall distance in centimeters, optional tibial inclination, heel-down and wall-contact validation, knee tracking, and symptoms.

**Expected output:** Left and right distance, difference between sides, test-quality confirmation, conservative interpretation, and ankle-mobility training guidance.

**Future AI Coach summary:** Explain whether ankle range or asymmetry is worth monitoring and suggest a short ankle-mobility or calf-capacity action without declaring a deficit or predicting injury.

**Required filename convention:** `dion_knee_to_wall_side_<start|end>_v<number>.png`.

## 5. Single-Leg Heel Raise

**Purpose:** Screen calf/plantarflexor endurance and the ability to repeat controlled heel rises on each side.

**Clinical rationale:** Quality heel-raise repetitions provide a practical field measure of calf capacity. Counts and side differences can guide training dosage, but they do not directly measure tendon load or diagnose pathology.

**Primary joints analyzed:** Tested foot, heel, ankle, calf, and knee position as quality context.

**Required camera view:** Close direct lateral of the tested limb.

**Allowed camera view:** Direct posterior as a separate supplemental view for heel path and symmetry.

**Required framing:** Tested foot through calf, including heel and ankle; include knee when demonstrating knee-straight quality; camera at ankle/lower-shin height, 1.5–2 m away.

**Movement start position:** Upright single-leg stance with tested heel on floor, knee held in the specified position, fingertips lightly touching support only for balance.

**Movement end position:** Highest controlled rise onto the ball of the foot without knee bend, foot roll, or body push from the support.

**Key coaching points:** Rise straight up; reach consistent full height; lower under control; keep knee position steady; use support only for balance.

**Angles that SHOULD be measured:** Future validated ankle plantarflexion or tibia-foot relationship; primary current outcomes are rep count and heel height rather than body-pose angles.

**Angles that SHOULD NOT be measured:** Current automatic ankle angle, hip/trunk/upper-limb angles, calf force, tendon load, or fatigue percentage.

**Automatic measurements:** None currently for the primary capacity result.

**Manual measurements:** Quality repetitions per side, height decline onset, tempo consistency, knee-bend compensation, balance support, and symptoms.

**Expected output:** Left/right quality counts, visible consistency and compensation notes, asymmetry context, confidence, and calf-capacity guidance.

**Future AI Coach summary:** Relate lower or asymmetric calf capacity to training tolerance as a possibility, then suggest a progressive calf/soleus capacity action without diagnosing tendon problems.

**Required filename convention:** `dion_single_leg_heel_raise_side_<start|top>_v<number>.png`. Future fatigue example: `dion_single_leg_heel_raise_side_height_decline_v<number>.png`.

## 6. Easy Running Gait

**Purpose:** Provide a short, low-intensity gait screen within the readiness battery.

**Clinical rationale:** Easy running reveals repeatable lower-limb and trunk patterns at a relevant training pace. Plane-specific observations may guide cues or follow-up testing, but they cannot establish injury cause or exact loading.

**Primary joints analyzed:** Trunk, pelvis/hips, closest-side knee, ankle/foot when future landmarks support them, and contralateral limbs as visual context.

**Required camera view:** Direct lateral.

**Allowed camera view:** Separate direct frontal and direct posterior captures.

**Required framing:** Full body and both shoes across a complete stride; camera at hip height, 3–5 m from travel line or perpendicular to a treadmill; fixed crop and level horizon.

**Movement start position:** Easy conversational running before initial contact, with natural arm action and stable speed.

**Movement end position:** Complete stride cycle through initial contact, midstance, toe-off, and swing; required asset phases are initial contact, midstance, and toe-off.

**Key coaching points:** Run naturally at easy pace; do not pose for the camera; maintain consistent direction and speed; keep the full stride inside frame.

**Angles that SHOULD be measured:** Closest-side knee flexion, estimated hip angle, trunk inclination; future tibial inclination, ankle dorsiflexion, and foot inclination after validation; separate frontal pelvic/trunk/knee metrics.

**Angles that SHOULD NOT be measured:** Far-limb sagittal curves, current footstrike or ankle angle, exact contact/flight time without validation, upper-limb angles as primary metrics, joint loading, or injury risk.

**Automatic measurements:** Closest-side knee flexion, estimated hip angle, trunk inclination, sequence ranges, approximate contact events, and estimated cadence when confidence supports it; separate frontal/posterior metrics.

**Manual measurements:** Overstride appearance, crossover, arm swing, footwear/surface/pace context, and symptoms.

**Expected output:** Short readiness summary of sagittal gait pattern, estimated cadence where supported, manual observations, capture quality, limitations, and low-stakes training suggestions.

**Future AI Coach summary:** Prioritize one or two modifiable observations such as cadence or foot placement, frame them as experiments, and recommend a simple cue or drill without claiming a universal ideal gait.

**Required filename convention:** `dion_easy_running_gait_side_<initial_contact|midstance|toe_off>_v<number>.png`. Supplemental: `dion_easy_running_gait_<front|back>_midstance_v<number>.png`.

## 7. Walking Gait

**Purpose:** Provide a comfortable-pace walking screen for walking-focused readiness.

**Clinical rationale:** Walking video can describe cadence, trunk and lower-limb motion, and visible symmetry. Findings support training decisions and follow-up, not neurologic, orthopedic, or fall-risk diagnosis.

**Primary joints analyzed:** Trunk, pelvis/hips, closest-side knee, ankle/foot when supported, and both limbs for separate frontal/posterior symmetry.

**Required camera view:** Direct lateral.

**Allowed camera view:** Separate direct frontal and direct posterior captures.

**Required framing:** Full body through a full step cycle; camera at hip height, 3–5 m away or perpendicular to a treadmill; both shoes and floor contact visible.

**Movement start position:** Natural comfortable walking before initial contact at stable speed.

**Movement end position:** Complete step cycle through initial contact, midstance, toe-off, and swing; required asset phases are initial contact, midstance, and toe-off.

**Key coaching points:** Walk naturally; look ahead; keep pace steady; do not exaggerate stride; keep the full cycle in frame.

**Angles that SHOULD be measured:** Closest-side knee flexion, estimated hip angle, trunk inclination; future ankle/toe-clearance measures with validated foot landmarks; separate frontal pelvic/trunk/knee symmetry metrics.

**Angles that SHOULD NOT be measured:** Far-limb sagittal curves, current footstrike/ankle/toe-clearance angles, exact double-support time or step length without calibration, upper-limb angles as primary metrics, forces, fall risk, or diagnosis.

**Automatic measurements:** Closest-side knee flexion, estimated hip angle, trunk inclination, sequence ranges, approximate contact events, and estimated cadence when confidence supports it; separate frontal/posterior metrics.

**Manual measurements:** Step symmetry, base width/crossover appearance, arm swing, balance events, assistive-device context, and symptoms.

**Expected output:** Walking pattern summary, estimated cadence where supported, symmetry observations, confidence, limitations, and walking-specific training suggestions.

**Future AI Coach summary:** Explain the most visible walking pattern in plain language and suggest a practical walking, mobility, or strength action without diagnosing gait pathology.

**Required filename convention:** `dion_walking_gait_side_<initial_contact|midstance|toe_off>_v<number>.png`. Supplemental: `dion_walking_gait_<front|back>_midstance_v<number>.png`.

---

# Standalone Movement Lab

## 8. Running Gait Analysis

**Purpose:** Provide a deeper standalone review of running mechanics across multiple gait phases and camera planes.

**Clinical rationale:** Standardized 2D running video can support repeatable sagittal and frontal observations when camera placement and metric permissions are controlled. Reliability varies by metric, so outputs must remain plane-specific estimates with limitations.

**Primary joints analyzed:** Trunk, pelvis/hips, closest-side knee, ankle/foot when future validated, plus bilateral frontal/posterior relationships.

**Required camera view:** Direct lateral.

**Allowed camera view:** Separate direct frontal and direct posterior.

**Required framing:** Full body through multiple strides; camera at hip height, 3–5 m away or treadmill-perpendicular; stable pace, horizon, scale, and exposure.

**Movement start position:** Stable running pace approaching initial contact in the analysis zone.

**Movement end position:** Repeated stride cycles; key phase assets are initial contact, midstance, toe-off, and midswing.

**Key coaching points:** Run naturally; hold steady pace; keep full body visible; repeat the same conditions for comparison; capture at least enough strides for a stable pattern.

**Angles that SHOULD be measured:** Closest-side knee flexion, estimated hip angle, trunk inclination; future foot/tibia/ankle angles with validation; separate frontal pelvic obliquity, frontal knee position, and trunk lateral lean.

**Angles that SHOULD NOT be measured:** Both legs equally from one lateral clip, current footstrike/ankle angle, uncalibrated speed or stride length, upper-limb angles as primary metrics, forces, loading, economy, diagnosis, or injury risk.

**Automatic measurements:** Closest-side sagittal series, key frames, approximate contacts, ranges, and estimated cadence when supported; direct front/back metrics from separate captures.

**Manual measurements:** Overstride, crossover, arm swing, visible foot placement, footwear, surface, pace, training context, and symptoms.

**Expected output:** Finding → meaning → recommendation for the most relevant gait observations, with view, side, phase, estimated values, confidence, and limitations.

**Future AI Coach summary:** Synthesize no more than three high-value observations, relate them to the athlete's goal and training phase, and propose small testable cues or drills rather than wholesale gait reconstruction.

**Required filename convention:** `dion_running_gait_side_<initial_contact|midstance|toe_off|midswing>_v<number>.png`. Supplemental: `dion_running_gait_<front|back>_midstance_v<number>.png`.

## 9. Squat Analysis

**Purpose:** Provide detailed standalone analysis of bodyweight or externally loaded squat mechanics.

**Clinical rationale:** Multi-repetition 2D squat video can describe depth, trunk/hip/knee strategy, symmetry, and consistency. It cannot isolate tissue loading or diagnose mobility restrictions from appearance alone.

**Primary joints analyzed:** Head/neck relationship, trunk, pelvis/hips, knees, ankles/feet; equipment only when present.

**Required camera view:** Direct lateral.

**Allowed camera view:** Separate direct frontal.

**Required framing:** Full body and full equipment path; camera at hip height, 3–5 m away; feet, joints, hands, and implement remain in frame.

**Movement start position:** Stable upright setup with chosen stance and any load held in its standardized position.

**Movement end position:** Deepest controlled bottom position with balanced foot contact and movement-specific load position.

**Key coaching points:** Maintain balanced foot pressure; track knees with toes; control descent; keep load path stable; use repeatable depth; avoid forcing a single universal torso angle.

**Angles that SHOULD be measured:** Head-to-trunk position qualitatively, trunk inclination, closest-side estimated hip angle, closest-side knee flexion, future/manual ankle dorsiflexion; separate frontal pelvic/knee/trunk metrics.

**Angles that SHOULD NOT be measured:** Upper-limb angles unless required by a future named squat variant, far-limb sagittal angles, isolated lumbar angle, center of pressure, forces, loading, or injury risk.

**Automatic measurements:** Closest-side knee flexion, estimated hip angle, trunk inclination, rep count, depth, duration, consistency, and key frames; separate frontal metrics.

**Manual measurements:** Head alignment, heel contact, foot stability, stance, load and implement position, bar path when relevant, and symptoms.

**Expected output:** Estimated phase-specific angles, rep consistency, manual movement-quality notes, confidence, limitations, and prioritized coaching actions.

**Future AI Coach summary:** Explain how the athlete's chosen squat strategy fits the task, identify the clearest constraint or inconsistency, and suggest a targeted technique, mobility, or strength action.

**Required filename convention:** `dion_squat_side_<start|bottom>_v<number>.png`. Supplemental: `dion_squat_front_bottom_v<number>.png`.

## 10. Deadlift Analysis

**Purpose:** Review hinge strategy, trunk position, knee/hip coordination, and implement path through a deadlift.

**Clinical rationale:** Direct-lateral video can describe visible hinge and segment relationships through the lift. It cannot calculate spinal load, tissue stress, or injury risk from appearance.

**Primary joints analyzed:** Head/neck relationship, trunk, pelvis/hips, closest-side knee, ankle/foot as context, shoulders/hands only for implement context.

**Required camera view:** Direct lateral with the analyzed side closest.

**Allowed camera view:** Direct frontal as a separate capture for symmetry and bar centering.

**Required framing:** Full body plus full bar/implement path from floor to lockout; camera at hip height, 3–5 m away; plates, hands, feet, hips, and head visible.

**Movement start position:** Implement on floor or specified start height, hips hinged, knees flexed to task-specific setup, trunk in controlled line, bar close to body.

**Movement end position:** Upright lockout with hips and knees extended, trunk stacked, implement controlled, and no exaggerated backward lean.

**Key coaching points:** Brace before lifting; keep implement close; push through the floor; let hips and knees extend together; finish tall without leaning back; lower with control.

**Angles that SHOULD be measured:** Trunk inclination, closest-side estimated hip angle, closest-side knee flexion, and timing relationships across setup, mid-pull, and lockout.

**Angles that SHOULD NOT be measured:** Isolated lumbar flexion, far-limb sagittal angles, elbow/wrist/finger angles as primary metrics, bar speed/force/power without tracking, spinal load, or injury risk.

**Automatic measurements:** Closest-side knee flexion, estimated hip angle, trunk inclination, phase timing, rep duration, key frames, and consistency; separate frontal metrics when captured.

**Manual measurements:** Bar path and proximity, bar level, grip, stance, load, equipment, head alignment, visible spinal continuity, and symptoms.

**Expected output:** Setup, mid-pull, and lockout observations; estimated angle series; implement-path notes; confidence; limitations; and prioritized technique actions.

**Future AI Coach summary:** Identify the clearest hinge, timing, or bar-path pattern and suggest one or two task-specific cues or accessory priorities without presenting a single posture as universally correct.

**Required filename convention:** `dion_deadlift_side_<setup|midpull|lockout>_v<number>.png`. Supplemental: `dion_deadlift_front_setup_v<number>.png`.

## 11. Single-Leg Control Analysis

**Purpose:** Provide a standalone assessment of unilateral pelvis, knee, trunk, foot, and balance control.

**Clinical rationale:** Frontal 2D analysis can describe visible single-leg alignment and control, with supplemental lateral video for depth. It informs training priorities but does not diagnose instability or predict injury.

**Primary joints analyzed:** Trunk, pelvis/hips, standing knee, standing ankle/foot; non-weight-bearing limb as context.

**Required camera view:** Direct frontal.

**Allowed camera view:** Direct lateral with the tested limb closest.

**Required framing:** Full body and both feet; camera at hip height, 3–4 m away; shoulders, pelvis, knees, and tested foot clear.

**Movement start position:** Stable unilateral stance, pelvis level, trunk centered, non-weight-bearing leg positioned consistently for the selected task.

**Movement end position:** Task-specific controlled depth with standing knee tracking over foot, pelvis/trunk controlled, and balance maintained.

**Key coaching points:** Own the standing foot; keep knee aligned with toes; keep pelvis level; control trunk sway; use repeatable depth and tempo.

**Angles that SHOULD be measured:** Frontal knee position, pelvic obliquity, trunk lateral lean; supplemental lateral knee flexion, estimated hip angle, and trunk inclination.

**Angles that SHOULD NOT be measured:** Primary sagittal angles from the frontal view, non-weight-bearing-leg angles as outcomes, ankle angle without foot landmarks, upper-limb angles, diagnosis, or injury risk.

**Automatic measurements:** Frontal knee position, pelvic obliquity, trunk lateral lean; supplemental lateral closest-side sagittal metrics.

**Manual measurements:** Balance loss, foot stability, hip-adduction appearance, depth target, task variation, and symptoms.

**Expected output:** Per-side movement-control profile, equivalent-trial comparison, confidence, limitations, manual confirmation, and training priorities.

**Future AI Coach summary:** Describe the most repeatable unilateral-control pattern and suggest targeted strength, balance, or technique work using conservative language.

**Required filename convention:** `dion_single_leg_control_front_<start|bottom>_v<number>.png`. Supplemental: `dion_single_leg_control_side_bottom_v<number>.png`.

## 12. Lunge Analysis (Future)

**Purpose:** Define the future standalone lunge workflow before UI or asset implementation.

**Clinical rationale:** Lunge analysis can describe front-leg depth, trunk strategy, balance, and frontal control across split-stance variations. The workflow remains future-facing and must not be represented as currently available solely because assets exist.

**Primary joints analyzed:** Trunk, pelvis/hips, lead knee, rear knee as context, lead ankle/foot.

**Required camera view:** Direct lateral with the lead/tested limb closest.

**Allowed camera view:** Separate direct frontal.

**Required framing:** Full body and full stance, camera at hip height, 3–4 m away, both feet and knees visible through the repetition.

**Movement start position:** Standardized split stance for the named lunge variation, pelvis square, trunk controlled, feet stable.

**Movement end position:** Controlled bottom position appropriate to the variation, lead knee tracking with foot, rear knee lowered, balance maintained.

**Key coaching points:** Use a stable stance; descend under control; align lead knee and foot; keep pelvis organized; keep trunk strategy appropriate to the variation.

**Angles that SHOULD be measured:** Lead-side knee flexion, estimated hip angle, trunk inclination; separate frontal pelvic obliquity, lead-knee position, and trunk lateral lean.

**Angles that SHOULD NOT be measured:** Both limbs' sagittal angles from one lateral view, occluded rear-limb angles, ankle angle without foot landmarks, upper-limb angles, pelvic rotation, loading, or injury risk.

**Automatic measurements:** When enabled: lead-side knee flexion, estimated hip angle, trunk inclination, rep phases, duration, and consistency; separate frontal metrics.

**Manual measurements:** Stance length, rear-knee clearance, heel contact, foot direction, balance, equipment/variation context, and symptoms.

**Expected output:** Once enabled, a phase-specific lunge report with estimated values, manual observations, confidence, limitations, and targeted training actions.

**Future AI Coach summary:** Explain the most relevant lead-leg, trunk, or balance finding in the context of the named lunge variation and recommend a specific progression or drill.

**Required filename convention:** `dion_lunge_side_<start|bottom>_v<number>.png`. Supplemental: `dion_lunge_front_bottom_v<number>.png`.

## 13. Custom Movement Upload

**Purpose:** Support user-selected movements without pretending every visible landmark is a valid assessment metric.

**Clinical rationale:** Custom video is useful for qualitative review and movement-specific planning when the task, view, phase, and measurement plan are explicit. Unstructured capture does not justify automatic clinical interpretation.

**Primary joints analyzed:** Only joints named in the custom movement plan and valid for the selected camera plane.

**Required camera view:** User-selected direct front, direct lateral, or direct back.

**Allowed camera view:** Only the explicitly selected direct view; no unknown or 45-degree analysis.

**Required framing:** Default full body from head through shoes; include all equipment and motion path; tighter framing only when the custom plan names the required visible joints.

**Movement start position:** Defined by the custom asset request before generation or capture.

**Movement end position:** Defined by the custom asset request, including the exact phase name and biomechanically plausible joint positions.

**Key coaching points:** Name the movement and goal; select the correct direct view; identify the closest side for lateral work; keep required joints visible; use a stable camera; do not add unsupported analysis.

**Angles that SHOULD be measured:** Only the pre-approved view-valid set: lateral closest-side knee flexion, estimated hip angle, and trunk inclination; or frontal/posterior pelvic obliquity, frontal knee position, trunk lateral lean, and symmetry when relevant.

**Angles that SHOULD NOT be measured:** Any undeclared metric, cross-plane angle, far-limb lateral angle, unsupported upper-limb or foot angle, force, loading, diagnosis, or injury risk.

**Automatic measurements:** Only the view-valid subset explicitly approved in the custom measurement plan.

**Manual measurements:** Movement name, goal, phase, view, closest side, equipment, observer notes, symptoms, and all relevant unsupported qualitative observations.

**Expected output:** A clearly scoped custom review stating what was assessed, what was not assessed, view/side, available estimates, manual notes, confidence, and limitations.

**Future AI Coach summary:** Restate the custom task and evidence limits, discuss only the approved findings, and recommend next steps proportional to the available data.

**Required filename convention:** `dion_custom_movement_<front|side|back>_<start|end|named_phase>_v<number>.png`.

---

## Evidence and claim boundary

This design system follows the repository's [`../../../docs/movement-readiness-evidence.md`](../../../docs/movement-readiness-evidence.md) and [`../../../docs/movement-tracking-research.md`](../../../docs/movement-tracking-research.md).

Key evidence notes:

- Two-dimensional gait measures can be useful, but reliability varies by metric and protocol; camera placement and plane-specific selection are essential.
- Frontal 2D single-leg squat measures can support repeatable movement descriptions, but must not be converted into injury predictions.
- Knee-to-wall distance is a reliable weight-bearing ankle range screen when the procedure is standardized.
- Heel-raise repetition testing is a practical capacity measure; image-only pose landmarks do not measure calf force or tendon loading.

## Version history

| Version | Date | Change |
|---|---|---|
| 1 | 2026-07-12 | Established the complete Movement Lab assessment, image, camera, measurement, output, and AI Coach specification for 13 movements. |
