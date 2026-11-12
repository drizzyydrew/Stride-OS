import { profileIdentityPatch, type ProfileIdentityDraft, type ProfileIdentityInput } from '../utils/profileIdentity';

type ProfileTarget = { athleteId: string; createdAt: number };
type SaveAdapter = {
  ownerIsCurrent: () => boolean;
  activeProfile: () => ProfileTarget | undefined;
  writeProfile: (id: string, patch: Required<ProfileIdentityInput>) => void | Promise<void>;
  writeLegacyNames: readonly ((name: string) => void | Promise<void>)[];
};
export type IdentitySaveResult =
  | { status: 'saved'; patch: Required<ProfileIdentityInput>; message: string }
  | { status: 'invalid' | 'account-changed' | 'storage-failed' | 'mirror-failed'; message: string };

/** This is the editor's real save path. A render update is not a successful
 * persistence receipt. Revalidate the captured identity after every await. */
export async function saveProfileIdentity(draft: ProfileIdentityDraft, target: ProfileTarget, adapter: SaveAdapter): Promise<IdentitySaveResult> {
  const current = () => {
    const active = adapter.activeProfile();
    return adapter.ownerIsCurrent() && active?.athleteId === target.athleteId && active.createdAt === target.createdAt;
  };
  const changed = (): IdentitySaveResult => ({ status: 'account-changed',
    message: 'Your account or active profile changed. Reopen your profile before saving.' });
  if (!current()) return changed();
  const result = profileIdentityPatch(draft);
  if (!result.ok) return { status: 'invalid', message: result.error };
  try { await adapter.writeProfile(target.athleteId, result.patch); }
  catch { return { status: 'storage-failed', message: 'Your profile changes could not be saved. Keep this screen open and retry before closing the app; the changes may not survive a restart.' }; }
  if (!current()) return changed();
  // These mirrors belong only to the original athlete. They are never used as
  // a display fallback and cannot override the visibility choices above.
  if (target.athleteId === 'athlete_default') {
    try {
      for (const write of adapter.writeLegacyNames) {
        if (!current()) return changed();
        await write(result.patch.name);
        if (!current()) return changed();
      }
    } catch {
      return { status: 'mirror-failed', message: 'Your visibility choices were saved, but the remaining profile update failed. Keep this screen open and retry.' };
    }
  }
  return { status: 'saved', patch: result.patch, message: 'Profile details saved on this device.' };
}

/** Initial setup may seed the original athlete, but a secondary athlete must
 * already exist. Never switch to or mirror the original athlete during reset. */
type OnboardingIdentitySaveResult = Exclude<IdentitySaveResult, { status: 'saved' }>
  | (Extract<IdentitySaveResult, { status: 'saved' }> & { target: ProfileTarget });
export async function saveOnboardingIdentity(draft: ProfileIdentityDraft, initialAthleteId: string,
  adapter: SaveAdapter & { activeAthleteId: () => string; seedDefault: () => void }): Promise<OnboardingIdentitySaveResult> {
  const current = () => adapter.ownerIsCurrent() && adapter.activeAthleteId() === initialAthleteId;
  if (!current()) return { status: 'account-changed', message: 'Your account or active profile changed. Reopen setup before continuing.' };
  const validation = profileIdentityPatch(draft);
  if (!validation.ok) return { status: 'invalid', message: validation.error };
  if (initialAthleteId === 'athlete_default' && !adapter.activeProfile()) adapter.seedDefault();
  const target = adapter.activeProfile();
  if (!target || target.athleteId !== initialAthleteId || !current()) {
    return { status: 'account-changed', message: 'Your athlete profile is unavailable. Reopen setup before continuing.' };
  }
  const result = await saveProfileIdentity(draft, target, { ...adapter, ownerIsCurrent: current });
  return result.status === 'saved' ? { ...result, target } : result;
}
