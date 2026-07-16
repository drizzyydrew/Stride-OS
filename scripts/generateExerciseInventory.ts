import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { presetExerciseId, STRENGTH_PRESET_WORKOUTS } from '../src/constants/strengthBank';
import { MOBILITY_EXERCISES, MOBILITY_WORKOUTS } from '../src/constants/mobilityBank';
import { STRENGTH_EXERCISES } from '../src/utils/strengthEngine';

type ImageRequirement = 'Start + End' | 'Single Reference' | 'No Image Initially';
type DionStatus = 'assessment_reference_only' | 'none';

type InventoryEntry = {
  canonicalId: string;
  canonicalName: string;
  ids: string[];
  aliases: string[];
  category: string[];
  equipment: string[];
  laterality: 'bilateral' | 'unilateral' | 'variable' | 'not_applicable';
  movementType: 'static' | 'dynamic' | 'mixed';
  prescriptionConvention: string[];
  whereUsed: string[];
  existingDionAssetStatus: DionStatus;
  recommendedImageRequirement: ImageRequirement;
  recommendedCameraView: string;
  priorityTier: 1 | 2 | 3;
};

type Draft = {
  names: Set<string>;
  ids: Set<string>;
  categories: Set<string>;
  equipment: Set<string>;
  conventions: Set<string>;
  where: Set<string>;
  unilateral?: boolean;
  movementType?: InventoryEntry['movementType'];
};

const ROOT = resolve(import.meta.dirname, '..');

function titleFromSlug(value: string): string {
  return value
    .replace(/^b_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

const CANONICAL_ALIASES: Record<string, string> = {
  'single leg romanian deadlift': 'single leg rdl',
  'single-leg romanian deadlift': 'single leg rdl',
  'single-leg rdl': 'single leg rdl',
  'farmers carry': 'farmer carry',
  "farmer's carry": 'farmer carry',
  'dumbbell farmer carry': 'farmer carry',
  'barbell back squat': 'back squat',
  'barbell squat': 'back squat',
  'bodyweight squat': 'squat',
  'single-leg squat': 'single leg squat',
  'single leg calf raise': 'single leg calf raise',
  'single-leg calf raise': 'single leg calf raise',
  'half-kneeling hip flexor stretch': 'hip flexor stretch',
  'kneeling hip flexor stretch': 'hip flexor stretch',
  'calf stretch (straight-knee)': 'straight knee calf stretch',
  'calf stretch (bent/straight)': 'calf stretch',
  'soleus stretch (bent-knee)': 'bent knee calf stretch',
  'knee-to-wall ankle mobilization': 'knee to wall',
  'knee-to-wall': 'knee to wall',
  'split-stance lunge': 'split stance lunge',
  'easy running gait': 'running gait',
  'walking gait': 'walking gait',
};

function normalizeName(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return CANONICAL_ALIASES[name.toLowerCase()] ?? CANONICAL_ALIASES[normalized] ?? normalized;
}

const drafts = new Map<string, Draft>();

function add(input: {
  name: string;
  id?: string;
  category?: string | string[];
  equipment?: string[];
  convention?: string;
  where: string;
  unilateral?: boolean;
  movementType?: Draft['movementType'];
}) {
  const key = normalizeName(input.name);
  const draft = drafts.get(key) ?? {
    names: new Set<string>(), ids: new Set<string>(), categories: new Set<string>(),
    equipment: new Set<string>(), conventions: new Set<string>(), where: new Set<string>(),
  };
  draft.names.add(input.name);
  if (input.id) draft.ids.add(input.id);
  for (const category of Array.isArray(input.category) ? input.category : input.category ? [input.category] : []) draft.categories.add(category);
  for (const equipment of input.equipment ?? []) draft.equipment.add(equipment);
  if (input.convention) draft.conventions.add(input.convention);
  draft.where.add(input.where);
  if (input.unilateral !== undefined) draft.unilateral = draft.unilateral === undefined ? input.unilateral : draft.unilateral || input.unilateral;
  if (input.movementType) draft.movementType = draft.movementType && draft.movementType !== input.movementType ? 'mixed' : input.movementType;
  drafts.set(key, draft);
}

for (const exercise of Object.values(STRENGTH_EXERCISES)) {
  add({
    name: exercise.name,
    id: exercise.id,
    category: ['strength_engine', exercise.pattern],
    equipment: exercise.equipment,
    convention: 'planned sets, reps or hold with RPE/load progression',
    where: 'Training Block Workouts',
    unilateral: exercise.unilateral,
    movementType: exercise.pattern === 'trunk' && /plank|hold/i.test(exercise.name) ? 'static' : 'dynamic',
  });
}

for (const workout of STRENGTH_PRESET_WORKOUTS) {
  for (const exercise of workout.exercises) {
    add({
      name: exercise.name,
      id: presetExerciseId(workout.id, exercise.name),
      category: ['strength_preset', ...workout.categories],
      equipment: exercise.equipment,
      convention: `${exercise.sets} sets · ${exercise.reps}`,
      where: `Preset Workout — ${workout.title}`,
      unilateral: /single|split|lunge|step|unilateral|side/i.test(exercise.name),
      movementType: /hold|plank|wall sit/i.test(exercise.name) ? 'static' : 'dynamic',
    });
  }
}

const mobilityWorkoutByExercise = new Map<string, string[]>();
for (const workout of MOBILITY_WORKOUTS) {
  for (const { exerciseId: id } of workout.exercises) {
    mobilityWorkoutByExercise.set(id, [...(mobilityWorkoutByExercise.get(id) ?? []), workout.title]);
  }
}
for (const exercise of MOBILITY_EXERCISES) {
  const dose = exercise.dose.holdSec
    ? `${exercise.dose.sets ?? 1} sets · ${exercise.dose.holdSec}s hold${exercise.dose.perSide ? ' / side' : ''}`
    : `${exercise.dose.sets ?? 1} sets · ${exercise.dose.reps ?? 0} reps${exercise.dose.perSide ? ' / side' : ''}`;
  const workouts = mobilityWorkoutByExercise.get(exercise.id) ?? [];
  add({
    name: exercise.name,
    id: exercise.id,
    category: ['mobility', exercise.targetArea],
    equipment: [],
    convention: dose,
    where: workouts.length ? `Mobility — ${workouts.join('; ')}` : 'Mobility exercise bank',
    unilateral: Boolean(exercise.dose.perSide),
    movementType: exercise.dose.holdSec ? 'static' : 'dynamic',
  });
}

const storeSource = readFileSync(resolve(ROOT, 'src/store/exerciseStore.ts'), 'utf8');
for (const match of storeSource.matchAll(/\{ id: '([^']+)',\s+name: '([^']+)',\s+category: '([^']+)',\s+movementPattern: '([^']+)'/g)) {
  add({
    id: match[1], name: match[2], category: ['exercise_library', match[3], match[4]],
    where: 'Exercise Library', unilateral: /single_leg/.test(match[4]),
    movementType: /isometric|stretch/.test(match[4]) ? 'static' : 'dynamic',
    convention: /isometric|stretch/.test(match[4]) ? 'hold-based or user-entered' : 'sets/reps or user-entered',
  });
}

const guideSource = readFileSync(resolve(ROOT, 'src/constants/exerciseGuides.ts'), 'utf8');
const guideBlock = guideSource.match(/const GUIDES:[\s\S]*?= \{([\s\S]*?)\n\};\n\n\/\/ Alias map/)?.[1] ?? '';
for (const match of guideBlock.matchAll(/^\s{2}([a-z0-9_]+): \{/gm)) {
  add({ name: titleFromSlug(match[1]), id: `guide:${match[1]}`, category: 'exercise_guide', where: 'Exercise Guides', convention: 'instruction reference' });
}
for (const match of guideSource.matchAll(/^\s{2}([a-z0-9_]+): '([a-z0-9_]+)',/gm)) {
  add({ name: titleFromSlug(match[2]), id: match[1], category: 'exercise_guide_alias', where: 'Exercise Guide aliases', convention: 'instruction reference' });
}

const readinessEntries = [
  ['Bodyweight Squat', 'readiness_squat', 'direct lateral'],
  ['Single-Leg Squat', 'readiness_single_leg_squat', 'direct frontal'],
  ['Split-Stance Lunge', 'readiness_split_stance_lunge', 'direct lateral'],
  ['Knee-to-Wall', 'readiness_knee_to_wall', 'close direct lateral'],
  ['Single-Leg Heel Raise', 'readiness_heel_raise', 'direct lateral'],
  ['Easy Running Gait', 'readiness_running_gait', 'direct lateral'],
  ['Walking Gait', 'readiness_walking_gait', 'direct lateral'],
] as const;
for (const [name, id, view] of readinessEntries) add({ name, id, category: 'movement_readiness', where: `Movement Readiness · ${view}`, convention: 'assessment-specific reps, time, or manual count', unilateral: /single|heel/i.test(name), movementType: 'dynamic' });

for (const [name, id, view] of [
  ['Running Gait', 'movement_running_gait', 'direct lateral'],
  ['Squat', 'movement_squat', 'direct lateral or direct frontal'],
  ['Deadlift', 'movement_deadlift', 'direct lateral'],
  ['Single-Leg Control', 'movement_single_leg_control', 'direct frontal'],
  ['Lunge', 'movement_lunge', 'direct lateral or direct frontal'],
] as const) add({ name, id, category: 'movement_lab_assessment', where: `Movement Lab · ${view}`, convention: 'movement-specific timed capture', unilateral: /single|lunge/i.test(name), movementType: 'dynamic' });

for (const item of [
  ['Brisk Walk', 'run_warmup_walk'], ['Easy Jog', 'run_warmup_easy_jog'], ['Running Strides', 'run_warmup_strides'],
  ['Leg Swings', 'run_warmup_leg_swings'], ['Hip Circles', 'run_warmup_hip_circles'], ['Diaphragmatic Breathing', 'run_cooldown_breathing'],
] as const) add({ name: item[0], id: item[1], category: 'running_protocol', where: 'Running warm-up/cool-down protocols', convention: 'time or repetitions by workout type', movementType: /breathing/.test(item[1]) ? 'static' : 'dynamic' });

const dionAssessmentNames = new Set(['squat', 'single leg squat', 'split stance lunge', 'knee to wall', 'single leg heel raise', 'running gait', 'walking gait', 'deadlift', 'lunge']);

function classify(key: string, draft: Draft): Pick<InventoryEntry, 'existingDionAssetStatus' | 'recommendedImageRequirement' | 'recommendedCameraView' | 'priorityTier'> {
  const text = `${key} ${[...draft.categories].join(' ')}`;
  const staticMove = draft.movementType === 'static' || /stretch|hold|breathing/.test(text);
  const complex = draft.unilateral || /squat|deadlift|lunge|press|row|swing|jump|bound|carry|mobility|band|plank|step|rdl|thrust|curl|raise/.test(text);
  const view = /running gait|walking gait|deadlift|rdl|hinge|squat|lunge|heel raise|calf|hip flexor/.test(text)
    ? 'Direct lateral; add direct frontal only when frontal-plane alignment is the purpose'
    : /row|press|pull|carry|plank|push up/.test(text)
      ? 'Direct lateral or direct frontal based on technique objective'
      : 'Direct view that keeps all required joints visible; no 45-degree reference';
  return {
    existingDionAssetStatus: dionAssessmentNames.has(key) ? 'assessment_reference_only' : 'none',
    recommendedImageRequirement: staticMove ? 'Single Reference' : complex ? 'Start + End' : 'No Image Initially',
    recommendedCameraView: view,
    priorityTier: staticMove ? 2 : complex ? 1 : 3,
  };
}

const inventory: InventoryEntry[] = [...drafts.entries()].map(([key, draft]) => {
  const names = [...draft.names].sort((a, b) => a.localeCompare(b));
  const canonicalName = names.sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? titleFromSlug(key);
  const classified = classify(key, draft);
  const laterality: InventoryEntry['laterality'] = draft.unilateral === undefined
    ? 'not_applicable'
    : draft.unilateral ? 'unilateral' : 'bilateral';
  return {
    canonicalId: `exercise_${key.replace(/ /g, '_')}`,
    canonicalName,
    ids: [...draft.ids].sort(),
    aliases: names.filter(name => name !== canonicalName),
    category: [...draft.categories].sort(),
    equipment: [...draft.equipment].sort(),
    laterality,
    movementType: draft.movementType ?? 'mixed',
    prescriptionConvention: [...draft.conventions].sort(),
    whereUsed: [...draft.where].sort(),
    ...classified,
  };
}).sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));

const jsonPath = resolve(ROOT, 'docs/exercise-library-inventory.json');
writeFileSync(jsonPath, `${JSON.stringify({ generatedAt: '2026-07-16', count: inventory.length, entries: inventory }, null, 2)}\n`);

const sourceCounts = new Map<string, number>();
for (const entry of inventory) for (const category of entry.category) sourceCounts.set(category, (sourceCounts.get(category) ?? 0) + 1);
const rows = inventory.map(entry => `| ${entry.canonicalName.replace(/\|/g, '\\|')} | ${entry.ids.join(', ') || '—'} | ${entry.category.join(', ')} | ${entry.whereUsed.join('; ').replace(/\|/g, '\\|')} | ${entry.existingDionAssetStatus} | ${entry.recommendedImageRequirement} | ${entry.priorityTier} |`);
const markdown = `# Exercise Library Inventory\n\nGenerated: 2026-07-16  \nCanonical entries: **${inventory.length}**\n\nThis inventory normalizes display names without changing stored IDs. Aliases and all discovered source IDs remain in the JSON artifact. Movement Lab Dion images are marked \`assessment_reference_only\`; that status does not approve them as general strength or mobility exercise imagery.\n\n## Sources audited\n\n- Training Block strength engine\n- Strength Preset bank\n- Exercise Library built-ins\n- Mobility exercises and all Mobility workouts\n- Exercise Guide canonicals and aliases\n- Running warm-up and cool-down protocols\n- Movement Readiness battery\n- Movement Lab assessment bank\n\n## Image-priority rules\n\n- Tier 1: compound, unilateral, complex setup, band work, mobility positions, or meaningfully different start/end positions.\n- Tier 2: static holds, common stretches, and positions where one reference image is sufficient.\n- Tier 3: familiar movements that can initially be supported by clear text.\n- Every recommended view is direct. No 45-degree reference is approved.\n\n## Inventory\n\n| Canonical name | Preserved IDs | Categories | Where used | Dion status | Image need | Tier |\n|---|---|---|---|---|---|---:|\n${rows.join('\n')}\n`;
writeFileSync(resolve(ROOT, 'docs/exercise-library-inventory.md'), markdown);

console.log(`Generated ${inventory.length} canonical exercise entries.`);
