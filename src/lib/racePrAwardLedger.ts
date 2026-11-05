import type { OwnerLease } from './localDataOwner';
import { ownerLeaseIsCurrent } from './localDataOwner';
import { getAppStorage } from '../store/persistStorage';
import { useAchievementStore, type AwardedAchievement } from '../store/achievementStore';
import { useProfileStore } from '../store/profileStore';
import type { RacePR } from '../types/athlete';
import { decodeRacePrLedger, nextRacePrLedger, RACE_PR_BADGE_IDS } from '../utils/racePrAwards';

let queue: Promise<unknown> = Promise.resolve();
const sessionStartedAt = Date.now();
export const racePrLedgerKey = (ownerUserId: string) => `race-pr-awards:${ownerUserId}:athlete_default`;

/** Called only after race calibration settles its complete owner-scoped inputs.
 * A durable consumed ledger precedes transient celebration publication. If the
 * generic badge-store write fails, later retries recover ownership quietly from
 * the ledger; a restart never replays previously consumed celebrations.
 */
export function reconcileRacePrAwards(lease: OwnerLease, records: readonly RacePR[], now = Date.now()): Promise<void> {
  const task = queue.then(async () => {
    const signature = JSON.stringify(records);
    const current = () => ownerLeaseIsCurrent(lease)
      && useProfileStore.getState().activeAthleteId === 'athlete_default'
      && JSON.stringify(useProfileStore.getState().profiles.athlete_default?.racePRs) === signature;
    if (!current()) return;
    if (!useAchievementStore.persist.hasHydrated()) throw new Error('Achievement history is still loading.');
    const storage = getAppStorage();
    const key = racePrLedgerKey(lease.ownerUserId);
    const raw = await storage.getItem(key);
    if (!current()) return;
    const previous = decodeRacePrLedger(raw, lease.ownerUserId);
    const next = nextRacePrLedger(previous, records, lease.ownerUserId, now, sessionStartedAt);
    const encoded = JSON.stringify(next.ledger);
    if (raw !== encoded) {
      await storage.setItem(key, encoded);
      if (!current()) return;
      // Read the persisted record rather than relying on the reactive store.
      const saved = await storage.getItemOnce(key);
      if (!current()) return;
      if (saved !== encoded) throw new Error('PR achievement history could not be verified. No celebration was published.');
    }
    if (!current()) return;
    const owned: AwardedAchievement[] = next.ledger.earnedDistances.map(distanceKey => ({
      id: RACE_PR_BADGE_IDS[distanceKey], awardedAt: now,
    }));
    const notifications: AwardedAchievement[] = next.notifications.map(racePR => ({
      id: RACE_PR_BADGE_IDS[racePR.distanceKey], awardedAt: now, racePR,
      ...(racePR.sourcePerformanceId.startsWith('activity-result:')
        ? { supportingActivityIds: [racePR.sourcePerformanceId.slice('activity-result:'.length)] } : {}),
    }));
    const existing = useAchievementStore.getState().awarded;
    const ids = new Set(existing.map(award => award.id));
    const pendingOwnership = owned.some(award => !ids.has(award.id));
    // Publish silently on every snapshot only if ownership is missing; force
    // persistence after a prior error by the retry marker below.
    if (pendingOwnership || notifications.length || retryOwnership.has(key)) {
      retryOwnership.add(key);
      await useAchievementStore.getState().publishRacePrAwards(owned, notifications, current);
      if (current()) retryOwnership.delete(key);
    }
  });
  queue = task.catch(() => undefined);
  return task;
}

// Transient only. A process restart compares ownership to the durable ledger.
const retryOwnership = new Set<string>();
