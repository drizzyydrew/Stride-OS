import assert from 'node:assert/strict';
import test from 'node:test';
import { getProfileIdentity, profileIdentityLabel, profileIdentityPatch } from '../profileIdentity';

test('legacy multi-part names survive without guessing a surname or generating a username', () => {
  const profile = { name: '  María del Carmen van der Meer  ' };
  const identity = getProfileIdentity(profile);
  assert.equal(identity.firstName, 'María del Carmen van der Meer');
  assert.equal(identity.lastName, '');
  assert.equal(identity.username, '');
  assert.equal(profileIdentityLabel(profile), 'María del Carmen van der Meer');
  assert.deepEqual(profile, { name: '  María del Carmen van der Meer  ' });
});

for (const [showName, showUsername, label, initials] of [
  [true, true, 'Drew Moore · @stride.drew', 'DR'],
  [true, false, 'Drew Moore', 'DR'],
  [false, true, '@stride.drew', 'ST'],
  [false, false, 'Athlete', 'A'],
] as const) {
  test(`independent visibility: name=${showName}, username=${showUsername}`, () => {
    const profile = { name: 'Hidden Legacy Name', firstName: 'Drew', lastName: 'Moore', username: 'stride.drew', showName, showUsername };
    const identity = getProfileIdentity(profile);
    assert.equal(profileIdentityLabel(profile), label);
    assert.equal(identity.initials, initials);
    assert.equal(identity.visibleName, showName ? 'Drew Moore' : '');
    assert.equal(identity.visibleUsername, showUsername ? '@stride.drew' : '');
    assert.ok(!profileIdentityLabel(profile).includes('Legacy'));
  });
}

test('hiding an unmigrated legacy name does not expose it through labels or initials', () => {
  const identity = getProfileIdentity({ name: 'Private Person', showName: false });
  assert.equal(identity.primaryLabel, 'Athlete');
  assert.equal(identity.initials, 'A');
  assert.equal(profileIdentityLabel({ name: 'Private Person', showName: false }), 'Athlete');
});

test('explicitly clearing names never resurrects the stale compatibility name', () => {
  assert.equal(profileIdentityLabel({ name: 'Old Private Name', firstName: '', lastName: '', showName: true }), 'Athlete');
  const saved = profileIdentityPatch({ firstName: '', lastName: '', username: '', showName: false, showUsername: false });
  assert.equal(saved.ok, true);
  if (saved.ok) assert.equal(saved.patch.name, '');
});

test('saving normalizes Unicode names and optional @ prefix while preserving display case', () => {
  const result = profileIdentityPatch({ firstName: '  Zoë\nAnn ', lastName: " O’Connor-Sá ", username: ' @Rün_42 ', showName: false, showUsername: true });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.patch.name, 'Zoë Ann O’Connor-Sá');
  assert.equal(result.patch.username, 'Rün_42');
  assert.equal(profileIdentityLabel(result.patch), '@Rün_42');
  // The persisted representation retains choices without publishing the name.
  assert.equal(profileIdentityLabel(JSON.parse(JSON.stringify(result.patch))), '@Rün_42');
});

test('invalid usernames and oversized input are rejected before updating stored identity', () => {
  const draft = { firstName: 'Drew', lastName: 'Moore', username: 'stride', showName: true, showUsername: true };
  for (const username of ['two words', 'person@example.com', 'double@@name', 'x'.repeat(31), 'line\nbreak']) {
    assert.equal(profileIdentityPatch({ ...draft, username }).ok, false, username);
  }
  assert.equal(profileIdentityPatch({ ...draft, firstName: 'x'.repeat(81) }).ok, false);
  assert.equal(profileIdentityPatch({ ...draft, username: 'x'.repeat(30), firstName: 'x'.repeat(80) }).ok, true);
});

test('missing profile uses the generic label rather than an unrelated onboarding name', () => {
  assert.equal(profileIdentityLabel(undefined), 'Athlete');
  assert.equal(profileIdentityLabel(null), 'Athlete');
});
