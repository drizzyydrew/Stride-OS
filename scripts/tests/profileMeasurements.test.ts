import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { ageFromDateOfBirth, birthDatePickerValue, heightFromParts, heightParts, profileAge, weightDigits, weightFromDigits } from '../../src/utils/profileMeasurements';
import { saveProfileMeasurement, type MeasurementSaveAdapter } from '../../src/lib/profileMeasurementEditing';
import { createDefaultProfile, runCalibration, estimateHRMax, buildHRMaxSourceLabel, calibrationForCurrentAge } from '../../src/utils/calibrationEngine';

const NOW = new Date(2026, 10, 15, 12);
function fixture(id = 'athlete_default') {
  let profile = { ...createDefaultProfile({ athleteId: id, name: 'Athlete', vo2Estimate: 40 }), age: 31, heightCm: 177.8,
    weightKg: 81.6466266, weightProvenance: { source: 'user_entered' as const, weightKg: 81.6466266, savedAt: 1000 } };
  const target = { ...profile }; const writes: unknown[] = []; const mirrors: unknown[] = [];
  let current = true; let persist = true; let mirror = true;
  const adapter: MeasurementSaveAdapter = {
    ownerIsCurrent: () => current, activeProfile: () => profile,
    writeProfile: async (_id, patch) => { writes.push(patch); profile = { ...profile, ...patch }; },
    confirmProfile: async () => persist,
    writeLegacy: patch => { mirrors.push(patch); }, confirmLegacy: async () => mirror,
  };
  return { adapter, target, writes, mirrors, profile: () => profile, revoke: () => { current = false; },
    switchAthlete: () => { profile = { ...profile, athleteId: 'other' }; },
    recreate: () => { profile = { ...profile, createdAt: profile.createdAt + 1 }; },
    storageFailure: () => { persist = false; }, mirrorFailure: () => { mirror = false; } };
}

test('DOB uses exact local birthday, leap-day convention, invalid/future rejection and untouched legacy fallback', () => {
  assert.equal(ageFromDateOfBirth('2000-11-15', NOW), 26);
  assert.equal(ageFromDateOfBirth('2000-11-16', NOW), 25);
  assert.equal(ageFromDateOfBirth('2000-02-29', new Date(2025, 1, 28, 23, 59)), 24);
  assert.equal(ageFromDateOfBirth('2000-02-29', new Date(2025, 2, 1, 0, 0)), 25);
  for (const value of ['2001-02-29', '2026-11-16', '2025-04-31', '2000-1-01', '1900-01-01', '2000-11-15T00:00:00Z']) assert.equal(ageFromDateOfBirth(value, NOW), null, value);
  assert.equal(profileAge({ age: 47 }, NOW), 47);
  assert.equal(profileAge({ age: 47, dateOfBirth: null }, NOW), 47);
  assert.equal(profileAge({ age: 47, dateOfBirth: 'invalid' }, NOW), 47);
  const cursor = birthDatePickerValue('2000-02-29');
  assert.deepEqual([cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), cursor.getHours()], [2000, 1, 29, 12]);
});

test('DOB survives negative/positive timezone offsets and local near-midnight birthdays', () => {
  const script = `import {ageFromDateOfBirth,birthDatePickerValue} from './src/utils/profileMeasurements.ts';
    console.log(JSON.stringify([ageFromDateOfBirth('2000-11-15',new Date(2026,10,15,0,1)),ageFromDateOfBirth('2000-11-15',new Date(2026,10,14,23,59)),birthDatePickerValue('2000-11-15').getDate()]));`;
  for (const TZ of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Honolulu']) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, TZ } });
    assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), [26, 25, 15], TZ);
  }
});

test('wheel conversion handles inch carry, metric centimeters and separate weight place values', () => {
  assert.deepEqual(heightParts(182.88, true), [6, 0]);
  assert.deepEqual(heightParts(199.7, false), [2, 0]);
  assert.equal(heightFromParts(5, 11, true), 180.34);
  assert.equal(heightFromParts(1, 79, false), 179);
  assert.deepEqual(weightDigits(81.6466266, true), [1, 8, 0]);
  assert.ok(Math.abs(weightFromDigits([1, 8, 0], true) - 81.6466266) < 0.000001);
  assert.equal(weightFromDigits([1, 0, 2], false), 102);
});

test('opening, canceling, unit switching and unchanged Save cannot round or promote stored measurements', async () => {
  const h = fixture(); const before = JSON.stringify(h.profile());
  for (const field of ['heightCm', 'weightKg', 'dateOfBirth'] as const) {
    const result = await saveProfileMeasurement({ field, value: field === 'dateOfBirth' ? '2000-01-01' : 70, changed: false }, h.target, h.adapter, NOW);
    assert.equal(result.status, 'unchanged');
  }
  assert.deepEqual(h.writes, []); assert.deepEqual(h.mirrors, []); assert.equal(JSON.stringify(h.profile()), before);
});

test('DOB save preserves exact measurements/provenance and secondary saves never mirror default', async () => {
  for (const id of ['athlete_default', 'secondary']) {
    const h = fixture(id); const original = h.profile();
    const result = await saveProfileMeasurement({ field: 'dateOfBirth', value: '2000-11-15', changed: true }, h.target, h.adapter, NOW);
    assert.equal(result.status, 'saved'); assert.equal(h.profile().age, 26); assert.equal(h.profile().dateOfBirth, '2000-11-15');
    assert.equal(h.profile().heightCm, original.heightCm); assert.equal(h.profile().weightKg, original.weightKg);
    assert.deepEqual(h.profile().weightProvenance, original.weightProvenance);
    assert.equal(h.mirrors.length, id === 'athlete_default' ? 1 : 0);
  }
});

test('only an explicit weight selection records provenance, keeping fractional kilograms', async () => {
  const h = fixture(); const value = weightFromDigits([1, 8, 1], true);
  const result = await saveProfileMeasurement({ field: 'weightKg', value, changed: true }, h.target, h.adapter, NOW);
  assert.equal(result.status, 'saved'); assert.equal(h.profile().weightKg, value);
  assert.equal(h.profile().weightProvenance?.weightKg, value); assert.equal(h.profile().weightProvenance?.source, 'user_entered');
});

test('removing DOB preserves current derived age after birthdays rather than reverting to an old snapshot', async () => {
  const h = fixture();
  h.adapter.activeProfile = () => ({ ...h.profile(), age: 20, dateOfBirth: '1980-01-01' });
  const target = { ...h.target, dateOfBirth: '1980-01-01' };
  const result = await saveProfileMeasurement({ field: 'dateOfBirth', value: null, changed: true }, target, h.adapter, NOW);
  assert.equal(result.status, 'saved'); assert.equal(h.profile().age, 46); assert.equal(h.profile().dateOfBirth, null);
});

test('removing DOB after a birthday cannot expose the old age-only cache or mirror cache state into setup', async () => {
  const before = new Date(2026, 10, 14, 23, 59);
  for (const athleteId of ['athlete_default', 'secondary']) {
    const h = fixture(athleteId);
    const old = { ...h.profile(), age: 20, dateOfBirth: '1980-11-15' };
    old.calibration = runCalibration({ profile: old, weeklyMileage: 20, recentWorkoutCount: 3, lastWorkoutDaysAgo: 1, currentRecoveryScore: 70 }, before);
    h.adapter.activeProfile = () => old;
    const result = await saveProfileMeasurement({ field: 'dateOfBirth', value: null, changed: true }, old, h.adapter, NOW);
    assert.equal(result.status, 'saved'); assert.equal(h.profile().dateOfBirth, null); assert.equal(h.profile().age, 46);
    assert.equal(h.profile().calibration, null); assert.equal(calibrationForCurrentAge(h.profile(), NOW), null);
    for (const mirror of h.mirrors) assert.equal(Object.hasOwn(mirror as object, 'calibration'), false);
    for (const anchor of [{ hrMaxManual: true, hrMax: 188 }, { hrThreshold: 165 }]) {
      const anchored = { ...old, ...anchor }; h.adapter.activeProfile = () => anchored;
      h.writes.length = 0;
      await saveProfileMeasurement({ field: 'dateOfBirth', value: null, changed: true }, anchored, h.adapter, NOW);
      assert.equal(Object.hasOwn(h.writes[0] as object, 'calibration'), false);
    }
  }
});

test('stale owner, selected athlete or recreated profile cannot save an open picker', async () => {
  for (const mutate of ['revoke', 'switchAthlete', 'recreate'] as const) {
    const h = fixture(); h[mutate]();
    assert.equal((await saveProfileMeasurement({ field: 'heightCm', value: 180, changed: true }, h.target, h.adapter, NOW)).status, 'account-changed');
    assert.deepEqual(h.writes, []); assert.deepEqual(h.mirrors, []);
  }
  const h = fixture(); h.adapter.confirmProfile = async () => { h.revoke(); return true; };
  assert.equal((await saveProfileMeasurement({ field: 'heightCm', value: 180, changed: true }, h.target, h.adapter, NOW)).status, 'account-changed');
  assert.deepEqual(h.mirrors, []);
});

test('readback/storage/mirror failure preserves retry and cannot acknowledge a successful save', async () => {
  for (const failure of ['storageFailure', 'mirrorFailure'] as const) {
    const h = fixture(); h[failure]();
    assert.equal((await saveProfileMeasurement({ field: 'weightKg', value: 90.25, changed: true }, h.target, h.adapter, NOW)).status, 'storage-failed');
  }
  const h = fixture(); h.adapter.writeProfile = async () => { throw new Error('disk full'); };
  assert.equal((await saveProfileMeasurement({ field: 'heightCm', value: 180, changed: true }, h.target, h.adapter, NOW)).status, 'storage-failed');
  assert.deepEqual(h.mirrors, []);
});

test('DOB validation and concurrent value changes do not overwrite current values', async () => {
  const h = fixture();
  assert.equal((await saveProfileMeasurement({ field: 'dateOfBirth', value: '2001-02-29', changed: true }, h.target, h.adapter, NOW)).status, 'invalid');
  h.adapter.activeProfile = () => ({ ...h.profile(), heightCm: 190 });
  assert.equal((await saveProfileMeasurement({ field: 'heightCm', value: 180, changed: true }, h.target, h.adapter, NOW)).status, 'conflict');
  assert.deepEqual(h.writes, []);
});

test('calibration uses DOB age at its entry without changing formulas, manual HRmax, or saved legacy age', () => {
  const profile = { ...createDefaultProfile({ athleteId: 'a', name: 'A', vo2Estimate: 40 }), age: 17, dateOfBirth: '1980-01-01' };
  const input = { profile, weeklyMileage: 20, recentWorkoutCount: 3, lastWorkoutDaysAgo: 1, currentRecoveryScore: 70 };
  const result = runCalibration(input);
  assert.equal(result.estimatedHRMax, estimateHRMax(profileAge(profile)));
  assert.match(buildHRMaxSourceLabel(profile), new RegExp(String(profileAge(profile))));
  assert.equal(profile.age, 17);
  assert.equal(runCalibration({ ...input, profile: { ...profile, hrMaxManual: true, hrMax: 180 } }).estimatedHRMax, null);
});

test('real cloud serializer omits exact DOB while preserving the local draft and existing payload fields', () => {
  const source = ts.createSourceFile('syncService.ts', readFileSync('src/lib/syncService.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'serializeOnboardingForCloud')!;
  const compiled = ts.transpileModule(`${fn.getText(source).replace('export ', '')}\nglobalThis.serialize = serializeOnboardingForCloud;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context: any = {}; vm.runInNewContext(compiled, context);
  const local = { age: 26, dateOfBirth: '2000-11-15', heightCm: 177.8, weightKg: 81.6466266, showName: false };
  const payload = context.serialize(local);
  assert.equal(Object.hasOwn(payload, 'dateOfBirth'), false); assert.equal(payload.weightKg, local.weightKg);
  assert.equal(payload.age, 26); assert.equal(payload.showName, false); assert.equal(local.dateOfBirth, '2000-11-15');
  assert.match(readFileSync('src/lib/syncService.ts', 'utf8'), /onboarding_data:\s+serializeOnboardingForCloud\(onboardingData\)/);
});

test('birthday selectors withhold stale age-only zones for either athlete until refreshed, preserving measured anchors and history', () => {
  const before = new Date(2026, 10, 14, 23, 59); const after = new Date(2026, 10, 15, 0, 1);
  for (const athleteId of ['athlete_default', 'secondary']) {
    const profile = { ...createDefaultProfile({ athleteId, name: 'Athlete', vo2Estimate: 40 }), age: 20, dateOfBirth: '1980-11-15' };
    const input = { profile, weeklyMileage: 20, recentWorkoutCount: 3, lastWorkoutDaysAgo: 1, currentRecoveryScore: 70 };
    const previous = runCalibration(input, before); profile.calibration = previous;
    const source = JSON.stringify(profile);
    assert.equal(calibrationForCurrentAge(profile, before), previous);
    assert.equal(calibrationForCurrentAge(profile, after), null);
    const refreshed = runCalibration(input, after); profile.calibration = refreshed;
    assert.equal(calibrationForCurrentAge(profile, after), refreshed);
    assert.equal(refreshed.estimatedHRMax, estimateHRMax(46));
    assert.equal(profile.age, 20); assert.equal(JSON.parse(source).calibration.hrMaxSource, previous.hrMaxSource);
    const manual = { ...profile, hrMaxManual: true, hrMax: 188, calibration: previous };
    assert.equal(calibrationForCurrentAge(manual, after), previous);
    assert.equal(calibrationForCurrentAge({ ...profile, hrMaxManual: false, hrThreshold: 168, activeZoneMethod: 'threshold', calibration: previous }, after), previous);
    const testOnly = { ...profile, hrMaxManual: false, hrThreshold: null, thresholdTest: { id: 'test', date: '2026-11-01', avgHRLastTwentyMin: 165, avgPaceSecPerMiLastTwenty: 480 } };
    testOnly.calibration = runCalibration({ ...input, profile: testOnly }, before);
    assert.equal(calibrationForCurrentAge(testOnly, after), null, 'a test record alone does not override the actual age-derived HRmax path');
    assert.equal(calibrationForCurrentAge({ ...profile, dateOfBirth: undefined, calibration: previous }, after), previous);
  }
});

test('actual profile/calibration selectors share the birthday cache boundary without mutating persisted profiles', () => {
  const source = ts.createSourceFile('profileStore.ts', readFileSync('src/store/profileStore.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const declarations = ['useActiveProfile', 'useCalibration'].map(name => source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!.getText(source).replace('export ', ''));
  let now = new Date(2026, 10, 14, 23, 59);
  const profile = { ...createDefaultProfile({ athleteId: 'secondary', name: 'Athlete', vo2Estimate: 40 }), age: 20, dateOfBirth: '1980-11-15' };
  profile.calibration = runCalibration({ profile, weeklyMileage: 20, recentWorkoutCount: 3, lastWorkoutDaysAgo: 1, currentRecoveryScore: 70 }, now);
  const before = JSON.stringify(profile);
  const context: any = {
    useProfileStore: (select: any) => select({ profiles: { secondary: profile }, activeAthleteId: 'secondary' }),
    useLocalCalendarDay: () => `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
    useMemo: (factory: () => unknown) => factory(), profileAge: (value: any) => profileAge(value, now),
    calibrationForCurrentAge: (value: any) => calibrationForCurrentAge(value, now),
  };
  vm.runInNewContext(ts.transpileModule(`${declarations.join('\n')}\nglobalThis.readProfile=useActiveProfile;globalThis.readCalibration=useCalibration;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  assert.equal(context.readProfile().age, 45); assert.equal(context.readCalibration(), profile.calibration);
  now = new Date(2026, 10, 15, 0, 1);
  assert.equal(context.readProfile().age, 46); assert.equal(context.readProfile().calibration, null); assert.equal(context.readCalibration(), null);
  assert.equal(JSON.stringify(profile), before);
});

test('actual calendar-day hook schedules local midnight and refreshes foreground without a new minute poll', () => {
  let now = new Date(2026, 10, 14, 23, 59, 50); let day: unknown; let foreground!: (state: string) => void;
  const timers: { callback: () => void; delay: number }[] = [];
  class Clock extends Date { constructor(...args: any[]) { super(args.length ? new Date(...args as [number, number, number]).getTime() : now.getTime()); } }
  const context: any = {
    Date: Clock, todayDateOnly: () => `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
    useState: (initial: any) => { day = initial(); return [day, (next: unknown) => { day = next; }]; },
    useEffect: (effect: () => void) => { effect(); },
    AppState: { addEventListener: (_event: string, callback: typeof foreground) => { foreground = callback; return { remove() {} }; } },
    clearTimeout() {}, setTimeout: (callback: () => void, delay: number) => { timers.push({ callback, delay }); return 1; },
  };
  const source = ts.createSourceFile('day.ts', readFileSync('src/hooks/useLocalCalendarDay.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node))!.getText(source).replace('export ', '');
  vm.runInNewContext(ts.transpileModule(`${fn}\nuseLocalCalendarDay();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  assert.ok(timers[0].delay >= 10_000 && timers[0].delay < 11_000);
  now = new Date(2026, 10, 15, 0, 0, 1); timers[0].callback();
  assert.equal(day, '2026-10-15'); assert.ok(timers[1].delay > 23 * 60 * 60 * 1000);
  now = new Date(2026, 10, 16, 12); foreground('active');
  assert.equal(day, '2026-10-16'); assert.ok(timers[2].delay > 11 * 60 * 60 * 1000);
});
