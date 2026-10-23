import type PostHog from 'posthog-react-native';
import { sanitizeProductEvent } from '../utils/observabilityPrivacy';
import { isPostHogHost, isPostHogKey } from '../utils/observabilityConfig.cjs';

const projectKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? '';
const MAX_QUEUE_SIZE = 20;
const REQUEST_TIMEOUT_MS = 10000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Connection = { capture: (name: string, properties: Record<string, unknown>) => void; stop: () => void };
type Session = {
  isActive: () => boolean;
  stopped: boolean;
  ready: boolean;
  anonymousId: string;
  uuids: Set<string>;
  attempted: Set<string>;
  requests: Set<AbortController>;
};
type Sdk = { client: PostHog; clearQueue: () => void };

let singleton: Promise<Sdk> | undefined;
let transitions: Promise<unknown> = Promise.resolve();
let latestSession: Session | undefined;
let liveSession: Session | undefined;

const discarded = () => ({ status: 200, text: async () => '{}', json: async () => ({}) });
const inactive: Connection = { capture() {}, stop() {} };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function active(session: Session): boolean {
  try { return !session.stopped && latestSession === session && session.isActive(); } catch { return false; }
}

function revoke(session: Session) {
  session.stopped = true;
  session.ready = false;
  session.uuids.clear();
  session.attempted.clear();
  session.requests.forEach(request => request.abort());
  session.requests.clear();
  if (liveSession === session) liveSession = undefined;
}

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = transitions.then(work);
  transitions = result.catch(() => undefined);
  return result;
}

async function sendBatch(url: string, options: Parameters<PostHog['fetch']>[1]) {
  const session = liveSession;
  if (!session || !session.ready || !active(session) || url !== `${host}/batch/`
    || options.method !== 'POST' || typeof options.body !== 'string') return discarded();
  let batch: unknown;
  try { batch = JSON.parse(options.body).batch; } catch { return discarded(); }
  if (!Array.isArray(batch) || batch.length > MAX_QUEUE_SIZE || options.signal?.aborted) return discarded();

  const ids: string[] = [];
  const safeBatch = batch.flatMap(message => {
    if (!isRecord(message) || typeof message.uuid !== 'string'
      || !session.uuids.has(message.uuid) || session.attempted.has(message.uuid)) return [];
    // Reserve each permission before sending, including duplicates inside one SDK batch.
    session.attempted.add(message.uuid);
    ids.push(message.uuid);
    const safe = sanitizeProductEvent(message.event as string, isRecord(message.properties) ? message.properties : {});
    return safe ? [{ uuid: message.uuid, event: safe.event, distinct_id: session.anonymousId,
      properties: { ...safe.properties, $geoip_disable: true, $process_person_profile: false } }] : [];
  });
  const abort = new AbortController();
  const cancel = () => abort.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    if (!safeBatch.length || !active(session)) return discarded();
    const body = JSON.stringify({ api_key: projectKey, batch: safeBatch });
    if (!active(session)) return discarded();
    session.requests.add(abort);
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) abort.abort();
    if (abort.signal.aborted) return discarded();
    const cancelled = new Promise<ReturnType<typeof discarded>>(resolve => {
      onAbort = () => resolve(discarded());
      abort.signal.addEventListener('abort', onAbort, { once: true });
    });
    timer = setTimeout(cancel, REQUEST_TIMEOUT_MS);
    return await Promise.race([fetch(url, { method: 'POST', credentials: 'omit', redirect: 'error',
      headers: { 'Content-Type': 'application/json' }, body, signal: abort.signal }), cancelled]);
  } catch {
    // Failed attempts are consumed too; do not create an SDK offline retry backlog.
    return discarded();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    if (onAbort) abort.signal.removeEventListener('abort', onAbort);
    session.requests.delete(abort);
    ids.forEach(id => { session.uuids.delete(id); session.attempted.delete(id); });
  }
}

function getSdk(): Promise<Sdk> {
  // Keep even a rejected construction promise: never multiply SDK lifecycle listeners.
  return singleton ??= (async () => {
    const { default: PostHogSdk, PostHogPersistedProperty } = await import('posthog-react-native');
    class PrivatePostHog extends PostHogSdk {
      override fetch(url: string, options: Parameters<PostHog['fetch']>[1]) { return sendBatch(url, options); }
    }
    const client = new PrivatePostHog(projectKey, {
      host, persistence: 'memory', defaultOptIn: false,
      captureAppLifecycleEvents: false, enableSessionReplay: false, errorTracking: { autocapture: false },
      capturePushNotificationOpened: false, capturePushNotificationSubscriptions: false,
      disableRemoteFeatureFlags: true, preloadFeatureFlags: false, disableSurveys: true, sendFeatureFlagEvent: false,
      setDefaultPersonProperties: false, personProfiles: 'never', disableGeoip: true,
      disableCompression: true, fetchRetryCount: 0, flushAt: 1, flushInterval: 0, maxQueueSize: MAX_QUEUE_SIZE,
      customAppProperties: {}, logs: { beforeSend: () => null },
      before_send: event => {
        const session = liveSession;
        if (!session || !session.ready || !active(session) || typeof event.uuid !== 'string'
          || !UUID.test(event.uuid) || session.uuids.has(event.uuid)) return null;
        const safe = sanitizeProductEvent(event.event, event.properties ?? {});
        if (!safe) return null;
        if (session.uuids.size >= MAX_QUEUE_SIZE) {
          const oldest = [...session.uuids].find(id => !session.attempted.has(id));
          if (oldest === undefined) return null;
          session.uuids.delete(oldest);
        }
        session.uuids.add(event.uuid);
        return { uuid: event.uuid, event: safe.event, properties: { ...safe.properties, token: projectKey } };
      },
    });
    await client.ready();
    return { client, clearQueue: () => client.setPersistedProperty(PostHogPersistedProperty.Queue, []) };
  })();
}

export async function connectUsage(isActive: () => boolean): Promise<Connection> {
  if (!isPostHogKey(projectKey) || !isPostHogHost(host)) {
    throw new Error('Analytics configuration unavailable');
  }
  const session: Session = { isActive, stopped: false, ready: false, anonymousId: '',
    uuids: new Set(), attempted: new Set(), requests: new Set() };
  try { if (!isActive()) return inactive; } catch { return inactive; }
  if (latestSession) revoke(latestSession);
  latestSession = session;
  const stop = () => {
    if (session.stopped) return;
    revoke(session);
    if (latestSession !== session) return;
    latestSession = undefined;
    void serialize(async () => {
      if (latestSession || !singleton) return;
      const sdk = await singleton;
      if (latestSession) return;
      sdk.clearQueue();
      try { await sdk.client.optOut(); } finally { sdk.clearQueue(); }
    }).catch(() => undefined);
  };
  return serialize(async () => {
    let sdk: Sdk | undefined;
    try {
      if (!active(session)) return inactive;
      sdk = await getSdk();
      if (!active(session)) return inactive;
      await sdk.client.optOut();
      sdk.clearQueue();
      sdk.client.reset([]);
      sdk.clearQueue();
      session.anonymousId = sdk.client.getDistinctId();
      if (!UUID.test(session.anonymousId)) throw new Error('Analytics session unavailable');
      if (!active(session)) return inactive;
      await sdk.client.optIn();
      if (!active(session)) {
        await sdk.client.optOut();
        sdk.clearQueue();
        return inactive;
      }
      session.ready = true;
      liveSession = session;
      const client = sdk.client;
      return { stop, capture(name, properties) {
        if (!active(session) || !session.ready) return;
        try {
          const safe = sanitizeProductEvent(name, properties);
          if (safe) client.capture(safe.event, safe.properties);
        } catch { /* Telemetry cannot interrupt app actions. */ }
      } };
    } catch (error) {
      revoke(session);
      if (sdk) {
        try { await sdk.client.optOut(); } catch { /* The transport is already gated off. */ }
        sdk.clearQueue();
      }
      throw error;
    }
  });
}
