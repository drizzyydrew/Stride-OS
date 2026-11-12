import { getProfileIdentity, profileIdentityPatch, type ProfileIdentityDraft, type ProfileIdentityInput } from './profileIdentity';

export type OnboardingIdentityData = Partial<ProfileIdentityDraft> & { name?: string; identityConfigured?: boolean };

/** Legacy names stay whole; no surname/alias is inferred. Explicit false choices
 * survive old snapshots, reset flows and completion without visiting this step. */
export function onboardingIdentityDraft(data: OnboardingIdentityData): ProfileIdentityDraft {
  const identity = getProfileIdentity(data);
  return { firstName: identity.firstName, lastName: identity.lastName, username: identity.username,
    showName: identity.showName, showUsername: identity.showUsername };
}

export function onboardingIdentityForCompletion(data: OnboardingIdentityData, existing?: ProfileIdentityInput) {
  return profileIdentityPatch(onboardingIdentityDraft(data.identityConfigured ? data : existing ?? data));
}
