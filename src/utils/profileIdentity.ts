import type { AthleteProfile } from '../types/athlete';

export type ProfileIdentityInput = Pick<Partial<AthleteProfile>,
  'name' | 'firstName' | 'lastName' | 'username' | 'showName' | 'showUsername'>;

export type ProfileIdentityDraft = {
  firstName: string;
  lastName: string;
  username: string;
  showName: boolean;
  showUsername: boolean;
};

export const PROFILE_NAME_MAX_LENGTH = 80;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

function cleanName(value: string | undefined): string {
  return (value ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function cleanProfileUsername(value: string | undefined): string {
  return (value ?? '').trim().replace(/^@/, '');
}

/** Visibility is independent of storage: hidden names never fall back to the
 * legacy full name or onboarding record. No username availability is implied. */
export function getProfileIdentity(profile?: ProfileIdentityInput | null) {
  const hasNameFields = profile?.firstName !== undefined || profile?.lastName !== undefined;
  // Preserve a legacy multi-part name in full, rather than guessing surnames.
  const firstName = cleanName(hasNameFields ? profile?.firstName : profile?.name);
  const lastName = cleanName(hasNameFields ? profile?.lastName : '');
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const username = cleanProfileUsername(profile?.username);
  const showName = profile?.showName !== false;
  const showUsername = profile?.showUsername === true;
  const visibleName = showName ? fullName : '';
  const visibleUsername = showUsername && username ? `@${username}` : '';
  const primaryLabel = visibleName || visibleUsername || 'Athlete';
  const initialsSource = visibleName || (visibleUsername ? username : 'A');
  const initials = Array.from(initialsSource).slice(0, 2).join('').toUpperCase();
  return { firstName, lastName, fullName, username, showName, showUsername,
    visibleName, visibleUsername, primaryLabel, initials };
}

export function profileIdentityLabel(profile?: ProfileIdentityInput | null): string {
  const identity = getProfileIdentity(profile);
  return [identity.visibleName, identity.visibleUsername].filter(Boolean).join(' · ') || 'Athlete';
}

/** Validate before saving so editing never silently truncates identity data. */
export function profileIdentityPatch(draft: ProfileIdentityDraft):
  | { ok: true; patch: Required<ProfileIdentityInput> }
  | { ok: false; error: string } {
  const firstName = cleanName(draft.firstName);
  const lastName = cleanName(draft.lastName);
  const username = cleanProfileUsername(draft.username);
  if ([firstName, lastName].some(value => Array.from(value).length > PROFILE_NAME_MAX_LENGTH)) {
    return { ok: false, error: `Keep each name to ${PROFILE_NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (username && (!/^[\p{L}\p{N}_.-]+$/u.test(username) || Array.from(username).length > PROFILE_USERNAME_MAX_LENGTH)) {
    return { ok: false, error: `Use up to ${PROFILE_USERNAME_MAX_LENGTH} letters, numbers, periods, hyphens or underscores for your username.` };
  }
  return { ok: true, patch: { firstName, lastName, username,
    name: [firstName, lastName].filter(Boolean).join(' '),
    showName: draft.showName, showUsername: draft.showUsername } };
}
