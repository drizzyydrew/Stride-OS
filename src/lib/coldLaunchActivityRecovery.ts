import type { OwnerLease } from './localDataOwner';

export type RecoveredActivity = {
  domain: 'running' | 'outdoor';
  workoutInstanceId: string;
  startedAt: number;
  name: string;
  route: '/(tabs)/training' | '/(tabs)/activity/start';
  ending: boolean;
  alreadySaved: boolean;
  mayDiscardOnStop: boolean;
};

type RecoveryDependencies = {
  waitForHydration: () => Promise<void>;
  captureOwner: () => OwnerLease | null;
  ownerIsCurrent: (lease: OwnerLease) => boolean;
  readActivity: () => RecoveredActivity | null;
  recoverPendingStops: () => Promise<void>;
  hasPendingNativeStop: (activity: RecoveredActivity) => boolean;
  complete: (activity: RecoveredActivity, endedAt: number) => Promise<unknown>;
  canNavigateAfterStop: (activity: RecoveredActivity) => boolean;
  navigate: (activity: RecoveredActivity) => void;
  now: () => number;
};

export type RecoveredActivityDecision = {
  activity: RecoveredActivity;
  isOwnerCurrent: () => boolean;
  isAvailable: () => boolean;
  requiresDiscardConfirmation: () => boolean;
  resume: () => boolean;
  stop: (options?: { allowShortDiscard?: boolean }) => Promise<boolean>;
};

function sameActivity(a: RecoveredActivity | null, b: RecoveredActivity) {
  return a?.domain === b.domain && a.workoutInstanceId === b.workoutInstanceId && a.startedAt === b.startedAt;
}

/** A process considers its initial retained recording once, never each unlock or new start. */
export class ColdLaunchActivityRecovery {
  private preparation: Promise<RecoveredActivityDecision | null> | null = null;
  private preparedDecision: RecoveredActivityDecision | null = null;
  private presented = false;

  constructor(private readonly launchedAt: number) {}

  prepare(deps: RecoveryDependencies): Promise<RecoveredActivityDecision | null> {
    if (this.presented) return Promise.resolve(null);
    // Reuse a pending initial read if React remounts an effect, but do not
    // reconsider recordings started later during this process.
    return this.preparation ??= this.prepareInitial(deps);
  }

  claimPresentation(decision: RecoveredActivityDecision): boolean {
    if (this.presented || this.preparedDecision !== decision || !decision.isAvailable()) return false;
    this.presented = true;
    return true;
  }

  private async prepareInitial(deps: RecoveryDependencies): Promise<RecoveredActivityDecision | null> {
    await deps.waitForHydration();
    const lease = deps.captureOwner();
    if (!lease || !deps.ownerIsCurrent(lease)) return null;
    const initial = deps.readActivity();
    if (!initial || !initial.workoutInstanceId.trim() || !Number.isFinite(initial.startedAt)
      || initial.startedAt <= 0 || initial.startedAt > this.launchedAt) return null;
    // Root Watch/Live Activity recovery gets the first opportunity to finish a
    // queued Stop. A failed recovery is not permission to resume that recording.
    await deps.recoverPendingStops();
    const available = () => {
      const current = deps.readActivity();
      return deps.ownerIsCurrent(lease) && sameActivity(current, initial)
        && !current!.ending && !current!.alreadySaved && !deps.hasPendingNativeStop(current!);
    };
    if (!available()) return null;
    let decided = false;
    const decision: RecoveredActivityDecision = {
      activity: initial,
      isOwnerCurrent: () => deps.ownerIsCurrent(lease),
      isAvailable: available,
      requiresDiscardConfirmation: () => available() && Boolean(deps.readActivity()?.mayDiscardOnStop),
      resume() {
        if (decided || !available()) return false;
        decided = true;
        // Opening the existing screen preserves its exact paused/running state.
        deps.navigate(initial);
        return true;
      },
      async stop(options = {}) {
        if (decided || !available()) return false;
        if (deps.readActivity()?.mayDiscardOnStop && !options.allowShortDiscard) return false;
        decided = true;
        try {
          // The existing completion pipeline journals the original identity and
          // timestamp, and retains indoor distance confirmation when required.
          await deps.complete(initial, deps.now());
        } catch (error) {
          if (!deps.ownerIsCurrent(lease)) return false;
          if (deps.ownerIsCurrent(lease) && deps.canNavigateAfterStop(initial)) deps.navigate(initial);
          throw error;
        }
        if (deps.ownerIsCurrent(lease) && deps.canNavigateAfterStop(initial)) deps.navigate(initial);
        return true;
      },
    };
    this.preparedDecision = decision;
    return decision;
  }
}
