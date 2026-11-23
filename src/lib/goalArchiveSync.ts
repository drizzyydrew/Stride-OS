import type { GoalArchive } from '../types/goalArchive';
import { ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';
import { getSupabaseAvailability } from './supabase';
import { isValidDateOnly } from '../utils/dateOnly';

export function requireGoalArchiveLease(lease: OwnerLease, cloud = false): void {
  if (!ownerLeaseIsCurrent(lease, cloud)) throw new Error('Goal archive owner changed or is unavailable');
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function count(value: unknown): boolean {
  return nonnegative(value) && Number.isInteger(value);
}

function metric(value: unknown): boolean {
  return value === null || nonnegative(value);
}

function validSummary(value: unknown): boolean {
  return object(value) && ['completedActivities', 'partialActivities', 'activeDays'].every(key => count(value[key]))
    && ['distanceMeters', 'durationSeconds', 'elevationGainMeters', 'trainingLoad'].every(key => metric(value[key]))
    && Array.isArray(value.activityIds) && value.activityIds.every(id => typeof id === 'string')
    && object(value.coverage) && count(value.coverage.distanceActivities) && count(value.coverage.durationActivities)
    && Array.isArray(value.weeks) && value.weeks.every(week => object(week) && typeof week.startDate === 'string'
      && count(week.activityCount) && metric(week.distanceMeters) && metric(week.durationSeconds));
}

export function validateGoalArchiveResult(value: unknown): asserts value is GoalArchive['result'] {
  if (!object(value) || typeof value.status !== 'string'
    || !['unrecorded', 'finished', 'did_not_finish', 'did_not_start'].includes(value.status)
    || (value.updatedAt !== undefined && !nonnegative(value.updatedAt))
    || (value.source !== undefined && value.source !== 'race_record' && value.source !== 'user' && value.source !== 'activity_link')
    || (value.source === 'activity_link' && (value.status !== 'unrecorded' || value.timeSeconds !== undefined
      || typeof value.linkedActivityId !== 'string' || !value.linkedActivityId.trim()))
    || (value.source !== 'activity_link' && value.linkedActivityId !== undefined)
    || (value.timeSeconds !== undefined && (!nonnegative(value.timeSeconds) || value.timeSeconds <= 0 || value.status !== 'finished'))) {
    throw new Error('Invalid goal archive result; saved history was retained');
  }
}

/** Preserve the deployed RPC's original source allowlist. Older clients see an
 * unrecorded result; newer clients recover the reference without copied time. */
export function encodeGoalArchiveForCloud(archive: GoalArchive): GoalArchive {
  validateGoalArchiveResult(archive.result);
  return archive.result.source === 'activity_link'
    ? { ...archive, result: { ...archive.result, source: 'race_record' } } : archive;
}
export function decodeGoalArchiveResult(value: unknown): GoalArchive['result'] {
  const result = object(value) && value.source === 'race_record' && value.linkedActivityId !== undefined
    ? { ...value, source: 'activity_link' } : value;
  validateGoalArchiveResult(result);
  return result;
}

/** Reject the entire payload rather than silently dropping unreadable history. */
export function decodeGoalArchives(value: unknown, ownerUserId: string): GoalArchive[] {
  if (!Array.isArray(value)) throw new Error('Unreadable goal archives; saved history was retained');
  const ids = new Set<string>();
  const decoded: GoalArchive[] = [];
  for (const archive of value) {
    if (!object(archive) || archive.schemaVersion !== 1 || archive.ownerUserId !== ownerUserId
      || typeof archive.id !== 'string' || !archive.id || ids.has(archive.id)
      || typeof archive.sourceKey !== 'string' || !archive.sourceKey
      || typeof archive.athleteId !== 'string' || !archive.athleteId
      || typeof archive.title !== 'string' || typeof archive.kind !== 'string' || !['race', 'goal', 'beginner'].includes(archive.kind)
      || typeof archive.goalType !== 'string' || !['general_running', 'get_faster', 'general_strength', 'race_prep', 'hybrid'].includes(archive.goalType)
      || typeof archive.startDate !== 'string' || !isValidDateOnly(archive.startDate)
      || typeof archive.endDate !== 'string' || !isValidDateOnly(archive.endDate) || archive.startDate > archive.endDate
      || (archive.closureReason !== undefined && archive.closureReason !== 'replaced' && archive.closureReason !== 'open_training')
      || (archive.macroPlan !== undefined && (!object(archive.macroPlan) || !Array.isArray(archive.macroPlan.weeks)))
      || (archive.beginnerPlan !== undefined && (!object(archive.beginnerPlan) || !Array.isArray(archive.beginnerPlan.weeks)))
      || !nonnegative(archive.archivedAt) || !validSummary(archive.summary)) {
      throw new Error('Unreadable or foreign goal archives; saved history was retained');
    }
    if (archive.deletedAt !== undefined && !nonnegative(archive.deletedAt)) throw new Error('Invalid archive deletion record');
    if (archive.metadata !== undefined) validateGoalArchiveMetadata(archive.metadata);
    const result = decodeGoalArchiveResult(archive.result);
    decoded.push({ ...archive, result } as GoalArchive);
    ids.add(archive.id);
  }
  return decoded;
}

export function goalArchiveResultTime(result: GoalArchive['result']): number {
  return result.updatedAt ?? -1;
}

export function validateGoalArchiveMetadata(value: unknown): asserts value is NonNullable<GoalArchive['metadata']> {
  if (!object(value) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 160
    || typeof value.startDate !== 'string' || !isValidDateOnly(value.startDate)
    || typeof value.endDate !== 'string' || !isValidDateOnly(value.endDate) || value.startDate > value.endDate
    || !nonnegative(value.updatedAt) || typeof value.mutationId !== 'string' || !value.mutationId || value.mutationId.length > 120) {
    throw new Error('Enter a name and valid start/end dates for this archive');
  }
}
export function goalArchiveRevision(archive: GoalArchive): string {
  return JSON.stringify([archive.result, archive.metadata ?? null, archive.deletedAt ?? null]);
}
function newerMetadata(a: GoalArchive['metadata'], b: GoalArchive['metadata']) {
  if (!a) return b; if (!b) return a;
  return b.updatedAt > a.updatedAt || b.updatedAt === a.updatedAt && b.mutationId > a.mutationId ? b : a;
}
/** Frozen plan/summary stay canonical; independent revisions merge without resurrection. */
export function mergeGoalArchives(canonical: readonly GoalArchive[], incoming: readonly GoalArchive[]): GoalArchive[] {
  const byId = new Map(canonical.map(archive => [archive.id, archive]));
  for (const archive of incoming) {
    const existing = byId.get(archive.id);
    if (!existing) byId.set(archive.id, archive);
    else {
      if (existing.ownerUserId !== archive.ownerUserId || existing.sourceKey !== archive.sourceKey) throw new Error('Archive identity conflict');
      const metadata = newerMetadata(existing.metadata, archive.metadata);
      const deletion = existing.deletedAt ?? archive.deletedAt;
      byId.set(archive.id, { ...existing,
        result: goalArchiveResultTime(archive.result) > goalArchiveResultTime(existing.result) ? archive.result : existing.result,
        ...(metadata ? { metadata } : {}), ...(deletion !== undefined ? { deletedAt: deletion } : {}),
      });
    }
  }
  return [...byId.values()];
}

// The verified token stays private and is pinned to every query, even if the
// shared client's session changes while a request is in flight.
async function getOwnerContext(lease: OwnerLease) {
  requireGoalArchiveLease(lease, true);
  const available = getSupabaseAvailability();
  if (available.status !== 'available') throw new Error('Goal archive cloud backup is unavailable');
  const supabase = available.client;
  const sessionResult = await supabase.auth.getSession();
  requireGoalArchiveLease(lease, true);
  const session = sessionResult.data.session;
  if (sessionResult.error || session?.user.id !== lease.ownerUserId) throw new Error('Goal archive cloud owner could not be verified');
  const userResult = await supabase.auth.getUser(session.access_token);
  requireGoalArchiveLease(lease, true);
  if (userResult.error || userResult.data.user?.id !== lease.ownerUserId) throw new Error('Goal archive cloud owner could not be verified');
  return { supabase, authorization: `Bearer ${session.access_token}` };
}

async function readCloud(context: Awaited<ReturnType<typeof getOwnerContext>>, lease: OwnerLease): Promise<GoalArchive[]> {
  requireGoalArchiveLease(lease, true);
  const response = await context.supabase.from('profiles').select('goal_archives')
    .eq('id', lease.ownerUserId).setHeader('Authorization', context.authorization).maybeSingle();
  requireGoalArchiveLease(lease, true);
  if (response.error) throw new Error('Goal archive cloud restore failed; local history was retained');
  // A missing profile is a fresh account. A present but missing/invalid column
  // is an unavailable migration or corrupt backup, never an empty history.
  return response.data === null ? [] : decodeGoalArchives(response.data.goal_archives, lease.ownerUserId);
}

export async function fetchGoalArchives(lease: OwnerLease): Promise<GoalArchive[]> {
  const context = await getOwnerContext(lease);
  requireGoalArchiveLease(lease, true);
  const archives = await readCloud(context, lease);
  requireGoalArchiveLease(lease, true);
  return archives;
}

/** Restore first, atomically merge pending records, then read canonical backup. */
export async function syncGoalArchives(local: readonly GoalArchive[], lease: OwnerLease): Promise<GoalArchive[]> {
  requireGoalArchiveLease(lease, true);
  decodeGoalArchives(local, lease.ownerUserId);
  const context = await getOwnerContext(lease);
  requireGoalArchiveLease(lease, true);
  const cloud = await readCloud(context, lease);
  requireGoalArchiveLease(lease, true);
  const canonical = mergeGoalArchives(cloud, local);
  const cloudById = new Map(cloud.map(archive => [archive.id, archive]));
  for (const archive of canonical) {
    const existing = cloudById.get(archive.id);
    if (existing && goalArchiveRevision(mergeGoalArchives([existing], [archive])[0]) === goalArchiveRevision(existing)) continue;
    requireGoalArchiveLease(lease, true);
    const response = await context.supabase.rpc(archive.metadata || archive.deletedAt !== undefined ? 'revise_stride_goal_archive' : 'merge_stride_goal_archive', { archive: encodeGoalArchiveForCloud(archive) })
      .setHeader('Authorization', context.authorization);
    requireGoalArchiveLease(lease, true);
    if (response.error) throw new Error('Goal archive cloud backup failed; local history was retained');
  }
  const confirmed = await readCloud(context, lease);
  requireGoalArchiveLease(lease, true);
  const confirmedById = new Map(confirmed.map(archive => [archive.id, archive]));
  for (const archive of canonical) {
    const saved = confirmedById.get(archive.id);
    if (!saved || goalArchiveRevision(mergeGoalArchives([saved], [archive])[0]) !== goalArchiveRevision(saved)) {
      throw new Error('Goal archive cloud backup was not confirmed; local history was retained');
    }
  }
  return confirmed;
}
