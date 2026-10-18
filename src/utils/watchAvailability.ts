import type { StrideWatchStatus } from '../../modules/stride-watch-connectivity/src';
import type { WatchRecordingEvidence } from '../types/activity';

/** Expo rejections can be plain objects, nested native errors, or strings. */
export function watchErrorText(error: unknown): string {
  const seen = new Set<object>();
  function read(value: unknown, depth: number): string | undefined {
    if (typeof value === 'string') {
      const text = value.trim();
      return text && !/^(undefined|null|unknown|undefined\s*reason)$/i.test(text) ? text : undefined;
    }
    if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return undefined;
    seen.add(value);
    const object = value as Record<string, unknown>;
    for (const key of ['localizedDescription', 'reason', 'message', 'cause', 'underlyingError', 'error']) {
      const text = read(object[key], depth + 1);
      if (text) return text;
    }
    return undefined;
  }
  const message = read(error, 0) ?? 'Apple Watch could not start. Open StrideOS on your watch and retry.';
  const code = error && typeof error === 'object' ? (error as Record<string, unknown>).code : undefined;
  return (typeof code === 'string' || typeof code === 'number') && !message.includes(String(code))
    ? `${code}: ${message}` : message;
}

function errorGuidance(error: string): string {
  if (/URLs?\s*while\s*locked|passcode|device.*locked|watch.*locked|unlock/i.test(error)) {
    return 'Unlock your Apple Watch with its passcode, open StrideOS on the watch, then retry.';
  }
  if (/updated.*watch|unsupported workout|enable this sport/i.test(error)) {
    return 'Open the updated StrideOS app on Apple Watch, then retry this activity.';
  }
  if (/authori[sz]|permission|health.*denied/i.test(error)) {
    return 'Open StrideOS on Apple Watch and check its Health permissions, then retry.';
  }
  return 'Keep your watch nearby. Unlock it, open StrideOS on the watch, then retry.';
}

export type WatchAvailabilityOptions = {
  workoutInstanceId?: string | null;
  recording?: WatchRecordingEvidence;
  active?: boolean;
  paused?: boolean;
  ending?: boolean;
  requesting?: boolean;
  requestError?: string | null;
};

export function watchAvailability(status: StrideWatchStatus, options: WatchAvailabilityOptions = {}) {
  const retryable = !!options.active && !options.paused && !options.ending && !options.requesting
    && !!options.workoutInstanceId && status.isSupported && status.isPaired && status.isWatchAppInstalled;
  const phoneDetail = options.active ? options.paused ? ' Phone activity remains paused.'
    : ' Phone recording continues without confirmed Watch data.' : '';
  if (!status.isSupported) return { title: 'Watch connection unavailable', detail: phoneDetail.trim(), retryable: false };
  if (!status.isPaired) return { title: 'No paired Apple Watch', detail: phoneDetail.trim(), retryable: false };
  if (!status.isWatchAppInstalled) return { title: 'Install StrideOS on Apple Watch', detail: phoneDetail.trim(), retryable: false };
  if (options.ending) return { title: 'Activity ending', detail: 'Watch start is disabled while this activity finishes.', retryable: false };
  if (options.requesting) return { title: 'Connecting to Apple Watch', detail: `Waiting for Watch recording confirmation.${phoneDetail}`, retryable: false };

  const evidence = options.recording?.workoutInstanceId === options.workoutInstanceId ? options.recording : undefined;
  const confirmed = evidence && Number.isFinite(evidence.confirmedAt) && evidence.confirmedAt > 0
    && (evidence.state === 'running' || evidence.state === 'paused');
  const error = options.requestError || status.lastError;
  // Reachability is a messaging channel, never evidence of recording or live HR.
  if (options.active && confirmed && status.isReachable) {
    return { title: `Watch recording confirmed: ${evidence.state}`,
      detail: error ? `Last Watch issue: ${errorGuidance(error)}` : 'Heart rate appears when a live sample arrives.',
      retryable: !!error && retryable };
  }
  const detail = error ? errorGuidance(error) : 'Unlock your watch, open StrideOS on it, then retry.';
  if (options.paused) return { title: 'Phone activity paused', detail: 'Resume the phone activity before retrying Watch start.', retryable: false };
  if (options.active) return {
    title: error ? 'Watch start needs attention' : status.isReachable ? 'Watch connected; recording not confirmed' : 'Watch recording not confirmed',
    detail: `${detail}${phoneDetail}`,
    retryable,
  };
  return { title: status.isReachable ? 'Watch connected' : 'Open StrideOS on Apple Watch', detail: error ? detail : '', retryable: false };
}

export type WatchStartRequest = {
  workoutInstanceId: string;
  workoutKind: string;
  isCurrent: () => boolean;
  getStatus: () => StrideWatchStatus;
  activate: () => Promise<StrideWatchStatus>;
  setContext: () => Promise<unknown>;
  start: () => Promise<StrideWatchStatus>;
  wait?: () => Promise<void>;
};

/** Wait before sending: a queued start flushed during activation cannot auto-launch. */
export function createWatchStartCoordinator() {
  const pending = new Map<string, Promise<StrideWatchStatus | null>>();
  async function perform(request: WatchStartRequest): Promise<StrideWatchStatus | null> {
    if (!request.isCurrent()) return null;
    try {
      let status = request.getStatus();
      const needsCapabilities = () => !['run', 'strength', 'mobility', 'cycling'].includes(request.workoutKind)
        && !status.supportedWorkoutKinds?.includes(request.workoutKind);
      if (status.activationState !== 'activated' || needsCapabilities()) {
        status = await request.activate();
        if (!request.isCurrent()) return null;
        // Bounded activation/capability negotiation. Never infer sport support.
        for (let attempt = 0; attempt < 15 && status.isSupported
          && (status.activationState !== 'activated' || (status.isReachable && needsCapabilities())); attempt += 1) {
          await (request.wait?.() ?? new Promise<void>(resolve => setTimeout(resolve, 100)));
          if (!request.isCurrent()) return null;
          status = request.getStatus();
        }
      }
      if (!request.isCurrent()) return null;
      if (!status.isSupported || !status.isPaired || !status.isWatchAppInstalled) return status;
      if (status.activationState !== 'activated') return { ...status, lastError: 'Watch connection is still activating. Open StrideOS on Apple Watch and retry.' };
      await request.setContext();
      if (!request.isCurrent()) return null;
      const result = await request.start();
      return request.isCurrent() ? result : null;
    } catch (error) {
      return request.isCurrent() ? { ...request.getStatus(), lastError: watchErrorText(error) } : null;
    }
  }
  return {
    request(request: WatchStartRequest): Promise<StrideWatchStatus | null> {
      const existing = pending.get(request.workoutInstanceId);
      if (existing) return existing;
      const promise = perform(request).finally(() => pending.delete(request.workoutInstanceId));
      pending.set(request.workoutInstanceId, promise);
      return promise;
    },
  };
}
