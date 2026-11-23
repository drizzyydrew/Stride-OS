import type { MobilityCategory, MobilityWorkout } from '../types/mobility';

type Profile = 'hiking' | 'downhill_skiing' | 'snowboarding' | 'cross_country_skiing' | 'mountaineering';
const profiles: { id: Profile; label: string; focus: string; warmup: string[]; cooldown: string[] }[] = [
  { id: 'hiking', label: 'Hiking', focus: 'ankle movement and controlled hip/knee range for walking uphill and downhill', warmup: ['ankle_rocks', 'lunge_with_rotation', 'adductor_rockbacks'], cooldown: ['calf_stretch_gastroc', 'soleus_stretch', 'hip_flexor_stretch_kneeling'] },
  { id: 'downhill_skiing', label: 'Downhill Skiing', focus: 'comfortable ankle, hip and lateral movement before on-snow practice', warmup: ['ankle_rocks', 'ninety_ninety_hip_switches', 'adductor_rockbacks'], cooldown: ['soleus_stretch', 'figure_four_glute_stretch', 'standing_quad_stretch'] },
  { id: 'snowboarding', label: 'Snowboarding', focus: 'comfortable hip rotation, ankle range and trunk rotation for riding preparation', warmup: ['ankle_rocks', 'ninety_ninety_hip_switches', 'thoracic_open_books'], cooldown: ['soleus_stretch', 'figure_four_glute_stretch', 'childs_pose_breathing'] },
  { id: 'cross_country_skiing', label: 'Cross-Country Skiing', focus: 'hip movement, shoulder range and trunk preparation for whole-body skiing', warmup: ['ankle_rocks', 'lunge_with_rotation', 'shoulder_wall_slides'], cooldown: ['hip_flexor_stretch_kneeling', 'calf_stretch_gastroc', 'thoracic_open_books'] },
  { id: 'mountaineering', label: 'Mountaineering', focus: 'ankle and hip movement plus comfortable shoulder range for ascent and equipment carrying', warmup: ['ankle_rocks', 'lunge_with_rotation', 'shoulder_wall_slides'], cooldown: ['soleus_stretch', 'hip_flexor_stretch_kneeling', 'childs_pose_breathing'] },
];

/** Selected comfortable movement options, not required corrective treatment.
 * Easy task-specific movement and rehearsal sets complete the warm-up. */
export const ACTIVITY_MOBILITY_PRESETS: MobilityWorkout[] = profiles.flatMap(profile => {
  const category: MobilityCategory = profile.id;
  return [{
    id: `mob_${profile.id}_prepare`, title: `${profile.label} — Prepare`,
    purpose: `Practise ${profile.focus}.`, category, categories: [category, 'lower_body'],
    targetAreas: profile.id === 'cross_country_skiing' || profile.id === 'mountaineering' ? ['Ankles', 'Hips', 'Shoulders'] : ['Ankles', 'Hips'],
    recommendedFrequency: 'Before the relevant session when useful', durationMin: 8,
    evidenceRationale: 'These are optional comfortable range and movement-practice choices. Add gradual sport-specific movement and lighter rehearsal sets; mobility alone does not establish readiness or prevent injury.',
    cautionNote: 'Reduce the range or omit an uncomfortable movement. Do not add this on top if your plan already supplies the same preparation.',
    exercises: profile.warmup.map(exerciseId => ({ exerciseId, dose: { sets: 1, reps: 6, perSide: true }, cues: ['Move through a comfortable controlled range; do not force the end position.'] })),
  }, {
    id: `mob_${profile.id}_unwind`, title: `${profile.label} — Unwind`,
    purpose: 'Optional comfortable movement and breathing after your session.', category, categories: [category, 'lower_body'],
    targetAreas: ['Calves', 'Hips'], recommendedFrequency: 'After training when useful', durationMin: 8,
    evidenceRationale: 'Comfortable cooldown choices can help a transition out of training; they are not a promise to prevent soreness, injury or accelerate recovery.',
    cautionNote: 'No forced stretching. Skip any task that increases symptoms.',
    exercises: profile.cooldown.map(exerciseId => ({ exerciseId,
      dose: exerciseId === 'childs_pose_breathing' ? { sets: 1, timeSec: 45 } : exerciseId === 'thoracic_open_books' ? { sets: 1, reps: 6, perSide: true } : { sets: 1, holdSec: 20, perSide: true },
      cues: ['Breathe comfortably and use a mild range.'] })),
  }];
});
