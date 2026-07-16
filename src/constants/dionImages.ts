// ─── Dion Image Registry ────────────────────────────────────────────────────
//
// Every capture screen (Movement Lab analysis + Running/Walking Readiness)
// pulls its "how to film this" illustration from this registry — no screen
// hardcodes an image path. Build 36: 32 approved Dion production PNGs exist
// under assets/movement-lab/assets/<assessmentId>/, one folder per assessment,
// indexed by the central manifest at
// assets/movement-lab/assets/movement_image_manifest.json. Every entry below
// is wired with a static require() (React Native only bundles statically
// resolvable require() calls — no dynamic paths). Do not modify the PNGs or
// the manifest from this file.
//
// `symptom_review` is the one assessment in the readiness battery with no
// approved image (readiness step 7 is a reflection screen, not a capture) —
// its `primary.image` is null and DionInstructionCard / CaptureGuidanceCard
// must render their placeholder for it; the card copy carries the step.

import type { MovementAnalysisKind, MovementViewAngle } from '../types/movement';

// ─── Types (pinned contract — see docs/build36-sequential-execution-plan.md §4.1) ──

export type DionAssessmentId =
  | 'readiness_bodyweight_squat'
  | 'readiness_single_leg_squat'
  | 'readiness_split_stance_lunge'
  | 'readiness_knee_to_wall'
  | 'readiness_single_leg_heel_raise'
  | 'readiness_easy_running_gait'
  | 'readiness_walking_gait'
  | 'standalone_running_gait_analysis'
  | 'standalone_bike_fit'
  | 'standalone_squat_analysis'
  | 'standalone_deadlift_analysis'
  | 'standalone_single_leg_control'
  | 'standalone_custom_movement_upload'
  | 'standalone_lunge_analysis'
  | 'symptom_review';

export type DionViewLabel =
  | 'Direct lateral'
  | 'Direct frontal'
  | 'Direct posterior'
  | 'Close lateral framing'
  | 'User-selected view';

/**
 * `image` is `number | null` rather than the strictly-required `number` in the
 * original contract sketch: `symptom_review` has no approved asset (see file
 * header), and this is the only null-safe way to carry it through the same
 * registry shape instead of special-casing it outside the type. Documented
 * per §6 shared-contract deviation rules.
 */
export type DionPhaseImage = {
  assetId:  string;
  image:    number | null;
  position: string;
  alt:      string;
};

export type DionAssessmentImages = {
  assessmentId:       DionAssessmentId;
  viewLabel:          DionViewLabel;
  mustBeVisible:      string[];
  recommendedDistance: string;
  primary:            DionPhaseImage;   // instructional hero (start/setup phase)
  phases:              DionPhaseImage[]; // all approved phases for this assessment
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function humanizeJoint(joint: string): string {
  const spaced = joint.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function phase(assetId: string, image: number, position: string, alt: string): DionPhaseImage {
  return { assetId, image, position, alt };
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const DION_ASSESSMENT_IMAGES: Record<DionAssessmentId, DionAssessmentImages> = {
  readiness_bodyweight_squat: {
    assessmentId: 'readiness_bodyweight_squat',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Knees', 'Ankles', 'Feet'],
    recommendedDistance: '3–5 m away, camera at hip height',
    primary: phase(
      'dion_bodyweight_squat_side_start_v1',
      require('../../assets/movement-lab/assets/readiness_bodyweight_squat/dion_bodyweight_squat_side_start_v1.png'),
      'start',
      'Dion standing upright at the start of a bodyweight squat, viewed from directly the side, feet shoulder-width, weight balanced through both feet, whole body visible from head through both shoes.',
    ),
    phases: [
      phase(
        'dion_bodyweight_squat_side_start_v1',
        require('../../assets/movement-lab/assets/readiness_bodyweight_squat/dion_bodyweight_squat_side_start_v1.png'),
        'start',
        'Dion standing upright at the start of a bodyweight squat, viewed from directly the side, feet shoulder-width, weight balanced through both feet, whole body visible from head through both shoes.',
      ),
      phase(
        'dion_bodyweight_squat_side_bottom_v1',
        require('../../assets/movement-lab/assets/readiness_bodyweight_squat/dion_bodyweight_squat_side_bottom_v1.png'),
        'bottom',
        'Dion at the controlled bottom of a bodyweight squat, viewed from directly the side, heels grounded, knees tracking in line with the feet, trunk balanced, whole body visible from head through both shoes.',
      ),
    ],
  },

  readiness_single_leg_squat: {
    assessmentId: 'readiness_single_leg_squat',
    viewLabel: 'Direct frontal',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Both knees', 'Both ankles', 'Both feet'],
    recommendedDistance: '3–4 m away, camera at hip height',
    primary: phase(
      'dion_single_leg_squat_front_start_v1',
      require('../../assets/movement-lab/assets/readiness_single_leg_squat/dion_single_leg_squat_front_start_v1.png'),
      'start',
      'Dion in a balanced single-leg standing start viewed from directly in front, standing-leg knee aligned over the foot, pelvis level, the non-weight-bearing leg lifted forward, both feet visible.',
    ),
    phases: [
      phase(
        'dion_single_leg_squat_front_start_v1',
        require('../../assets/movement-lab/assets/readiness_single_leg_squat/dion_single_leg_squat_front_start_v1.png'),
        'start',
        'Dion in a balanced single-leg standing start viewed from directly in front, standing-leg knee aligned over the foot, pelvis level, the non-weight-bearing leg lifted forward, both feet visible.',
      ),
      phase(
        'dion_single_leg_squat_front_bottom_v1',
        require('../../assets/movement-lab/assets/readiness_single_leg_squat/dion_single_leg_squat_front_bottom_v1.png'),
        'bottom',
        'Dion at the controlled bottom of a single-leg squat viewed from directly in front, standing knee tracking over the foot, pelvis and trunk controlled, the non-weight-bearing foot off the floor.',
      ),
    ],
  },

  readiness_split_stance_lunge: {
    assessmentId: 'readiness_split_stance_lunge',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Hips', 'Lead knee', 'Trail knee', 'Both ankles', 'Both feet'],
    recommendedDistance: '3–4 m away, camera at hip height',
    primary: phase(
      'dion_split_stance_lunge_side_start_v1',
      require('../../assets/movement-lab/assets/readiness_split_stance_lunge/dion_split_stance_lunge_side_start_v1.png'),
      'start',
      'Dion in a stable split stance viewed from directly the side, front (lead) leg closest to camera, torso upright, front heel grounded, pelvis square, both feet in contact with the floor.',
    ),
    phases: [
      phase(
        'dion_split_stance_lunge_side_start_v1',
        require('../../assets/movement-lab/assets/readiness_split_stance_lunge/dion_split_stance_lunge_side_start_v1.png'),
        'start',
        'Dion in a stable split stance viewed from directly the side, front (lead) leg closest to camera, torso upright, front heel grounded, pelvis square, both feet in contact with the floor.',
      ),
      phase(
        'dion_split_stance_lunge_side_bottom_v1',
        require('../../assets/movement-lab/assets/readiness_split_stance_lunge/dion_split_stance_lunge_side_bottom_v1.png'),
        'bottom',
        'Dion at the controlled bottom of a split-stance lunge viewed from directly the side, front knee tracking over the front foot, rear knee lowered toward the floor, trunk balanced.',
      ),
    ],
  },

  readiness_knee_to_wall: {
    assessmentId: 'readiness_knee_to_wall',
    viewLabel: 'Close lateral framing',
    mustBeVisible: ['Tested foot', 'Tested heel', 'Tested ankle', 'Tested knee', 'Wall contact area'],
    recommendedDistance: '1–1.5 m away, camera low near floor/shin height',
    primary: phase(
      'dion_knee_to_wall_side_start_v1',
      require('../../assets/movement-lab/assets/readiness_knee_to_wall/dion_knee_to_wall_side_start_v1.png'),
      'start',
      'Close direct-lateral view of Dion in a half-kneeling knee-to-wall start position, tested foot flat with heel down, tibia short of the wall, knee not yet touching, toe-to-wall gap visible for manual measurement.',
    ),
    phases: [
      phase(
        'dion_knee_to_wall_side_start_v1',
        require('../../assets/movement-lab/assets/readiness_knee_to_wall/dion_knee_to_wall_side_start_v1.png'),
        'start',
        'Close direct-lateral view of Dion in a half-kneeling knee-to-wall start position, tested foot flat with heel down, tibia short of the wall, knee not yet touching, toe-to-wall gap visible for manual measurement.',
      ),
      phase(
        'dion_knee_to_wall_side_end_v1',
        require('../../assets/movement-lab/assets/readiness_knee_to_wall/dion_knee_to_wall_side_end_v1.png'),
        'end',
        'Close direct-lateral view of Dion with the tested knee touching the wall, heel still flat on the floor, ankle/tibia/knee/wall contact point all visible for the manual toe-to-wall distance reading.',
      ),
    ],
  },

  readiness_single_leg_heel_raise: {
    assessmentId: 'readiness_single_leg_heel_raise',
    viewLabel: 'Close lateral framing',
    mustBeVisible: ['Tested knee', 'Tested calf', 'Tested ankle', 'Tested heel', 'Tested foot', 'Non-stance foot'],
    recommendedDistance: '1.5–2 m away, camera at ankle/shin height',
    primary: phase(
      'dion_single_leg_heel_raise_side_start_v1',
      require('../../assets/movement-lab/assets/readiness_single_leg_heel_raise/dion_single_leg_heel_raise_side_start_v1.png'),
      'start',
      'Close direct-lateral view of Dion in a single-leg heel-raise start position, tested heel down on the floor, light fingertip support on a wall for balance, non-stance foot lifted clear of the floor.',
    ),
    phases: [
      phase(
        'dion_single_leg_heel_raise_side_start_v1',
        require('../../assets/movement-lab/assets/readiness_single_leg_heel_raise/dion_single_leg_heel_raise_side_start_v1.png'),
        'start',
        'Close direct-lateral view of Dion in a single-leg heel-raise start position, tested heel down on the floor, light fingertip support on a wall for balance, non-stance foot lifted clear of the floor.',
      ),
      phase(
        'dion_single_leg_heel_raise_side_top_v1',
        require('../../assets/movement-lab/assets/readiness_single_leg_heel_raise/dion_single_leg_heel_raise_side_top_v1.png'),
        'top',
        'Close direct-lateral view of Dion at the top of a single-leg heel raise, forefoot planted and heel clearly elevated, knee held steady, non-stance foot still lifted.',
      ),
    ],
  },

  readiness_easy_running_gait: {
    assessmentId: 'readiness_easy_running_gait',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Both knees', 'Both ankles', 'Both feet'],
    recommendedDistance: '3–5 m away, camera at hip height (or treadmill-side)',
    primary: phase(
      'dion_easy_running_gait_side_initial_contact_v1',
      require('../../assets/movement-lab/assets/readiness_easy_running_gait/dion_easy_running_gait_side_initial_contact_v1.png'),
      'initial_contact',
      'Dion running at an easy pace viewed from directly the side at first ground contact, lead foot just touching down, whole body and both shoes visible through the stride.',
    ),
    phases: [
      phase(
        'dion_easy_running_gait_side_initial_contact_v1',
        require('../../assets/movement-lab/assets/readiness_easy_running_gait/dion_easy_running_gait_side_initial_contact_v1.png'),
        'initial_contact',
        'Dion running at an easy pace viewed from directly the side at first ground contact, lead foot just touching down, whole body and both shoes visible through the stride.',
      ),
      phase(
        'dion_easy_running_gait_side_midstance_v1',
        require('../../assets/movement-lab/assets/readiness_easy_running_gait/dion_easy_running_gait_side_midstance_v1.png'),
        'midstance',
        'Dion running at an easy pace viewed from directly the side at single-limb midstance, whole body and both shoes visible through the stride.',
      ),
      phase(
        'dion_easy_running_gait_side_toe_off_v1',
        require('../../assets/movement-lab/assets/readiness_easy_running_gait/dion_easy_running_gait_side_toe_off_v1.png'),
        'toe_off',
        'Dion running at an easy pace viewed from directly the side at trailing-forefoot toe-off, whole body and both shoes visible through the stride.',
      ),
    ],
  },

  readiness_walking_gait: {
    assessmentId: 'readiness_walking_gait',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Both knees', 'Both ankles', 'Both feet'],
    recommendedDistance: '3–5 m away, camera at hip height (or treadmill-side)',
    primary: phase(
      'dion_walking_gait_side_initial_contact_v1',
      require('../../assets/movement-lab/assets/readiness_walking_gait/dion_walking_gait_side_initial_contact_v1.png'),
      'initial_contact',
      'Dion walking at a comfortable pace viewed from directly the side at lead-heel initial contact with walking double support, whole body and both shoes visible.',
    ),
    phases: [
      phase(
        'dion_walking_gait_side_initial_contact_v1',
        require('../../assets/movement-lab/assets/readiness_walking_gait/dion_walking_gait_side_initial_contact_v1.png'),
        'initial_contact',
        'Dion walking at a comfortable pace viewed from directly the side at lead-heel initial contact with walking double support, whole body and both shoes visible.',
      ),
      phase(
        'dion_walking_gait_side_midstance_v1',
        require('../../assets/movement-lab/assets/readiness_walking_gait/dion_walking_gait_side_midstance_v1.png'),
        'midstance',
        'Dion walking at a comfortable pace viewed from directly the side at one-foot midstance, whole body and both shoes visible.',
      ),
      phase(
        'dion_walking_gait_side_toe_off_v1',
        require('../../assets/movement-lab/assets/readiness_walking_gait/dion_walking_gait_side_toe_off_v1.png'),
        'toe_off',
        'Dion walking at a comfortable pace viewed from directly the side at trailing-forefoot toe-off with lead-foot support, whole body and both shoes visible.',
      ),
    ],
  },

  standalone_running_gait_analysis: {
    assessmentId: 'standalone_running_gait_analysis',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Both knees', 'Both ankles', 'Both feet'],
    recommendedDistance: '3–5 m away, camera at hip height (or treadmill-side)',
    primary: phase(
      'dion_running_gait_side_initial_contact_v1',
      require('../../assets/movement-lab/assets/standalone_running_gait_analysis/dion_running_gait_side_initial_contact_v1.png'),
      'initial_contact',
      'Dion running viewed from directly the side at lead-foot initial contact, rightward travel, whole body and both shoes visible through the stride.',
    ),
    phases: [
      phase(
        'dion_running_gait_side_initial_contact_v1',
        require('../../assets/movement-lab/assets/standalone_running_gait_analysis/dion_running_gait_side_initial_contact_v1.png'),
        'initial_contact',
        'Dion running viewed from directly the side at lead-foot initial contact, rightward travel, whole body and both shoes visible through the stride.',
      ),
      phase(
        'dion_running_gait_side_midstance_v1',
        require('../../assets/movement-lab/assets/standalone_running_gait_analysis/dion_running_gait_side_midstance_v1.png'),
        'midstance',
        'Dion running viewed from directly the side at single-limb midstance, whole body and both shoes visible through the stride.',
      ),
      phase(
        'dion_running_gait_side_toe_off_v1',
        require('../../assets/movement-lab/assets/standalone_running_gait_analysis/dion_running_gait_side_toe_off_v1.png'),
        'toe_off',
        'Dion running viewed from directly the side at trailing-forefoot toe-off, whole body and both shoes visible through the stride.',
      ),
      phase(
        'dion_running_gait_side_midswing_v1',
        require('../../assets/movement-lab/assets/standalone_running_gait_analysis/dion_running_gait_side_midswing_v1.png'),
        'midswing',
        'Dion running viewed from directly the side airborne at midswing, whole body and both shoes visible through the stride.',
      ),
    ],
  },

  // Build 38 direct-lateral Bike Fit reference pair. These generated production
  // assets were reviewed for Dion identity, full-bike framing, direct camera
  // plane, visible contact points, and representative top/bottom pedal phases.
  standalone_bike_fit: {
    assessmentId: 'standalone_bike_fit',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Shoulders', 'Elbows', 'Hands', 'Hips', 'Knees', 'Ankles', 'Feet', 'Full bicycle', 'Crank', 'Pedals'],
    recommendedDistance: 'Camera perpendicular at approximately hip/crank height; full rider and bicycle visible',
    primary: phase(
      'dion_bike_fit_side_bottom_dead_center_v1',
      require('../../assets/movement-lab/assets/standalone_bike_fit/dion_bike_fit_side_bottom_dead_center_v1.png'),
      'bottom_dead_center',
      'Dion riding a stationary road bicycle in direct lateral view near bottom dead center, with the full rider, bicycle, crank, pedals, hands, feet, and contact points visible.',
    ),
    phases: [
      phase(
        'dion_bike_fit_side_bottom_dead_center_v1',
        require('../../assets/movement-lab/assets/standalone_bike_fit/dion_bike_fit_side_bottom_dead_center_v1.png'),
        'bottom_dead_center',
        'Dion riding in direct lateral view with the closest leg near the bottom pedal phase and a small natural knee bend.',
      ),
      phase(
        'dion_bike_fit_side_top_dead_center_v1',
        require('../../assets/movement-lab/assets/standalone_bike_fit/dion_bike_fit_side_top_dead_center_v1.png'),
        'top_dead_center',
        'Dion riding in direct lateral view with the closest leg near the top pedal phase and visible hip and knee flexion.',
      ),
    ],
  },

  standalone_squat_analysis: {
    assessmentId: 'standalone_squat_analysis',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Knees', 'Ankles', 'Feet'],
    recommendedDistance: '3–5 m away, camera at hip height',
    primary: phase(
      'dion_squat_side_start_v1',
      require('../../assets/movement-lab/assets/standalone_squat_analysis/dion_squat_side_start_v1.png'),
      'start',
      'Dion at the upright start of an unloaded squat viewed from directly the side, hands together at chest, whole body visible from head through both shoes.',
    ),
    phases: [
      phase(
        'dion_squat_side_start_v1',
        require('../../assets/movement-lab/assets/standalone_squat_analysis/dion_squat_side_start_v1.png'),
        'start',
        'Dion at the upright start of an unloaded squat viewed from directly the side, hands together at chest, whole body visible from head through both shoes.',
      ),
      phase(
        'dion_squat_side_bottom_v1',
        require('../../assets/movement-lab/assets/standalone_squat_analysis/dion_squat_side_bottom_v1.png'),
        'bottom',
        'Dion at the controlled bottom of an unloaded squat viewed from directly the side, hands together at chest, whole body visible from head through both shoes.',
      ),
    ],
  },

  standalone_deadlift_analysis: {
    assessmentId: 'standalone_deadlift_analysis',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Knees', 'Ankles', 'Hands', 'Barbell'],
    recommendedDistance: '3–5 m away, camera at hip height',
    primary: phase(
      'dion_deadlift_side_setup_v1',
      require('../../assets/movement-lab/assets/standalone_deadlift_analysis/dion_deadlift_side_setup_v1.png'),
      'setup',
      'Dion at conventional barbell deadlift setup viewed from directly the side, hips hinged, bar close to the shins, whole body plus the full barbell visible.',
    ),
    phases: [
      phase(
        'dion_deadlift_side_setup_v1',
        require('../../assets/movement-lab/assets/standalone_deadlift_analysis/dion_deadlift_side_setup_v1.png'),
        'setup',
        'Dion at conventional barbell deadlift setup viewed from directly the side, hips hinged, bar close to the shins, whole body plus the full barbell visible.',
      ),
      phase(
        'dion_deadlift_side_midpull_v1',
        require('../../assets/movement-lab/assets/standalone_deadlift_analysis/dion_deadlift_side_midpull_v1.png'),
        'midpull',
        'Dion mid-pull on a barbell deadlift viewed from directly the side, bar at knee level, whole body plus the full barbell visible.',
      ),
      phase(
        'dion_deadlift_side_lockout_v1',
        require('../../assets/movement-lab/assets/standalone_deadlift_analysis/dion_deadlift_side_lockout_v1.png'),
        'lockout',
        'Dion at upright deadlift lockout viewed from directly the side, bar at the thighs, hips and knees extended, whole body plus the full barbell visible.',
      ),
    ],
  },

  standalone_single_leg_control: {
    assessmentId: 'standalone_single_leg_control',
    viewLabel: 'Direct frontal',
    mustBeVisible: ['Head', 'Shoulders', 'Pelvis', 'Hips', 'Knees', 'Ankles', 'Feet'],
    recommendedDistance: '3–4 m away, camera at hip height',
    primary: phase(
      'dion_single_leg_control_front_start_v1',
      require('../../assets/movement-lab/assets/standalone_single_leg_control/dion_single_leg_control_front_start_v1.png'),
      'start',
      'Dion in a stable unilateral standing start viewed from directly in front, standing leg square under the hip, non-stance leg lifted forward, both feet visible.',
    ),
    phases: [
      phase(
        'dion_single_leg_control_front_start_v1',
        require('../../assets/movement-lab/assets/standalone_single_leg_control/dion_single_leg_control_front_start_v1.png'),
        'start',
        'Dion in a stable unilateral standing start viewed from directly in front, standing leg square under the hip, non-stance leg lifted forward, both feet visible.',
      ),
      phase(
        'dion_single_leg_control_front_bottom_v1',
        require('../../assets/movement-lab/assets/standalone_single_leg_control/dion_single_leg_control_front_bottom_v1.png'),
        'bottom',
        'Dion at a controlled moderate-depth single-leg squat bottom viewed from directly in front, standing knee tracking over the foot, non-stance leg lifted forward.',
      ),
    ],
  },

  standalone_custom_movement_upload: {
    assessmentId: 'standalone_custom_movement_upload',
    viewLabel: 'User-selected view',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Knees', 'Ankles', 'Feet'],
    recommendedDistance: '3–5 m away, camera at hip height',
    primary: phase(
      'dion_custom_movement_front_start_v1',
      require('../../assets/movement-lab/assets/standalone_custom_movement_upload/dion_custom_movement_front_start_v1.png'),
      'start',
      'Dion in a neutral anatomical standing start viewed from directly in front, whole body visible from head through both shoes — a framing guide for a user-selected movement.',
    ),
    phases: [
      phase(
        'dion_custom_movement_front_start_v1',
        require('../../assets/movement-lab/assets/standalone_custom_movement_upload/dion_custom_movement_front_start_v1.png'),
        'start',
        'Dion in a neutral anatomical standing start viewed from directly in front, whole body visible from head through both shoes — a framing guide for a user-selected movement.',
      ),
      phase(
        'dion_custom_movement_side_start_v1',
        require('../../assets/movement-lab/assets/standalone_custom_movement_upload/dion_custom_movement_side_start_v1.png'),
        'start',
        'Dion in a neutral anatomical standing start viewed from directly the side, whole body visible from head through both shoes — a framing guide for a user-selected movement.',
      ),
      phase(
        'dion_custom_movement_back_start_v1',
        require('../../assets/movement-lab/assets/standalone_custom_movement_upload/dion_custom_movement_back_start_v1.png'),
        'start',
        'Dion in a neutral anatomical standing start viewed from directly behind, whole body visible from head through both shoes — a framing guide for a user-selected movement.',
      ),
    ],
  },

  standalone_lunge_analysis: {
    assessmentId: 'standalone_lunge_analysis',
    viewLabel: 'Direct lateral',
    mustBeVisible: ['Head', 'Shoulders', 'Hips', 'Lead knee', 'Rear knee', 'Lead ankle', 'Rear ankle', 'Feet'],
    recommendedDistance: '3–4 m away, camera at hip height',
    primary: phase(
      'dion_lunge_side_start_v1',
      require('../../assets/movement-lab/assets/standalone_lunge_analysis/dion_lunge_side_start_v1.png'),
      'start',
      'Dion in a standardized split-stance lunge start viewed from directly the side, lead leg closest to camera, both feet and both knees visible.',
    ),
    phases: [
      phase(
        'dion_lunge_side_start_v1',
        require('../../assets/movement-lab/assets/standalone_lunge_analysis/dion_lunge_side_start_v1.png'),
        'start',
        'Dion in a standardized split-stance lunge start viewed from directly the side, lead leg closest to camera, both feet and both knees visible.',
      ),
      phase(
        'dion_lunge_side_bottom_v1',
        require('../../assets/movement-lab/assets/standalone_lunge_analysis/dion_lunge_side_bottom_v1.png'),
        'bottom',
        'Dion at the controlled bottom of a split-stance lunge viewed from directly the side, lead knee tracking with the foot, rear knee lowered, both feet and both knees visible.',
      ),
    ],
  },

  symptom_review: {
    assessmentId: 'symptom_review',
    viewLabel: 'User-selected view',
    mustBeVisible: [],
    recommendedDistance: 'Not applicable — no camera capture for this step',
    primary: {
      assetId: 'symptom_review_placeholder',
      image: null,
      position: 'n/a',
      alt: 'A simple, calm review screen — no camera capture is needed for this step. It represents pausing to reflect on whether any pain or symptoms came up during the tests just completed.',
    },
    phases: [],
  },
};

// ─── Lookup functions (pinned contract) ─────────────────────────────────────

function canonicalOf(view: MovementViewAngle | undefined): 'lateral' | 'frontal' | 'posterior' | 'unknown' {
  switch (view) {
    case 'side':  return 'lateral';
    case 'front': return 'frontal';
    case 'rear':  return 'posterior';
    default:      return 'unknown';
  }
}

/** Looks up the Dion registry entry for a Movement Lab standalone analysis kind + camera view. */
export function dionImagesForKind(
  kind: MovementAnalysisKind,
  view?: MovementViewAngle,
): DionAssessmentImages {
  const canonical = canonicalOf(view);

  switch (kind) {
    case 'running_gait':
      return DION_ASSESSMENT_IMAGES.standalone_running_gait_analysis;
    case 'bike_fit':
      return DION_ASSESSMENT_IMAGES.standalone_bike_fit;
    case 'squat':
      return DION_ASSESSMENT_IMAGES.standalone_squat_analysis;
    case 'deadlift':
      return DION_ASSESSMENT_IMAGES.standalone_deadlift_analysis;
    case 'single_leg_control':
      return DION_ASSESSMENT_IMAGES.standalone_single_leg_control;
    case 'lunge':
      return DION_ASSESSMENT_IMAGES.standalone_lunge_analysis;
    // Deprecated legacy Build 32/34/35 kind — still resolvable so old records never crash.
    case 'lunge_single_leg':
      return canonical === 'frontal'
        ? DION_ASSESSMENT_IMAGES.standalone_single_leg_control
        : DION_ASSESSMENT_IMAGES.standalone_lunge_analysis;
    case 'general':
    default: {
      const custom = DION_ASSESSMENT_IMAGES.standalone_custom_movement_upload;
      const wantedPosition = canonical === 'lateral' ? 'side' : canonical === 'posterior' ? 'back' : 'front';
      const matched = custom.phases.find(p => p.assetId.includes(`_${wantedPosition}_`)) ?? custom.primary;
      return { ...custom, primary: matched };
    }
  }
}

/** Looks up the Dion registry entry for a readiness-battery video step. */
export function dionImagesForReadinessStep(
  stepKey: 'squat_side' | 'single_leg_squat' | 'split_stance_lunge' | 'knee_to_wall' | 'heel_raise' | 'gait_side_view',
  focus: 'running' | 'walking',
): DionAssessmentImages {
  switch (stepKey) {
    case 'squat_side':
      return DION_ASSESSMENT_IMAGES.readiness_bodyweight_squat;
    case 'single_leg_squat':
      return DION_ASSESSMENT_IMAGES.readiness_single_leg_squat;
    case 'split_stance_lunge':
      return DION_ASSESSMENT_IMAGES.readiness_split_stance_lunge;
    case 'knee_to_wall':
      return DION_ASSESSMENT_IMAGES.readiness_knee_to_wall;
    case 'heel_raise':
      return DION_ASSESSMENT_IMAGES.readiness_single_leg_heel_raise;
    case 'gait_side_view':
      return focus === 'walking'
        ? DION_ASSESSMENT_IMAGES.readiness_walking_gait
        : DION_ASSESSMENT_IMAGES.readiness_easy_running_gait;
    default:
      return DION_ASSESSMENT_IMAGES.standalone_custom_movement_upload;
  }
}

// humanizeJoint is exported for callers (e.g. CaptureGuidanceCard consumers)
// that need to humanize manifest requiredVisibleJoints outside this file.
export { humanizeJoint };
