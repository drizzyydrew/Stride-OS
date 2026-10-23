import app from '../../app.json';
import { sanitizeDiagnosticEvent } from '../utils/observabilityPrivacy';
import { isSentryDsn } from '../utils/observabilityConfig.cjs';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const release = `com.mooremovement.strideos@${app.expo.version}+${app.expo.ios.buildNumber}`;

export async function connectUsage(isActive: () => boolean) {
  return (await import('./posthogClient')).connectUsage(isActive);
}

export async function connectDiagnostics(isActive: () => boolean) {
  if (!isSentryDsn(sentryDsn)) throw new Error('Diagnostics configuration unavailable');
  const Sentry = await import('@sentry/react-native');
  if (!isActive()) return { stop() {} };
  let stopped = false;
  const requests = new Set<AbortController>();
  const pending = new Set<Promise<unknown>>();
  const allowed = () => !stopped && isActive();
  Sentry.init({
    dsn: sentryDsn, release, dist: app.expo.ios.buildNumber,
    enableNative: false, enableNativeCrashHandling: false, enableNativeNagger: false,
    enableAutoSessionTracking: false, sendDefaultPii: false, sendClientReports: false,
    attachScreenshot: false, attachViewHierarchy: false, maxBreadcrumbs: 0, enableLogs: false,
    enableAppStartTracking: false, enableNativeFramesTracking: false, enableCaptureFailedRequests: false,
    defaultIntegrations: false, integrations: [Sentry.reactNativeErrorHandlersIntegration(), Sentry.dedupeIntegration(), Sentry.createReactNativeRewriteFrames()],
    beforeBreadcrumb: () => null,
    beforeSend: (event, hint) => { hint.attachments = []; return allowed() ? sanitizeDiagnosticEvent(event) : null; },
    transport: options => ({
      send(envelope) {
        if (!allowed() || requests.size >= 10) return Promise.resolve({});
        const errorItems = envelope[1].flatMap(item => {
          if (item[0].type !== 'event' || typeof item[1] !== 'object' || item[1] === null) return [];
          const safe = sanitizeDiagnosticEvent(item[1]);
          return safe ? [[{ type: 'event' }, { ...safe, release, dist: app.expo.ios.buildNumber }] as const] : [];
        });
        if (!errorItems.length || !allowed()) return Promise.resolve({});
        const abort = new AbortController(); requests.add(abort);
        const eventId = errorItems[0]?.[1].event_id;
        const body = [JSON.stringify(eventId ? { event_id: eventId } : {}), ...errorItems.flatMap(([header, event]) => [JSON.stringify(header), JSON.stringify(event)])].join('\n');
        const request = (async () => {
          try {
            const response = await fetch(options.url, { method: 'POST', credentials: 'omit', redirect: 'error', headers: { 'Content-Type': 'application/x-sentry-envelope' }, body, signal: abort.signal });
            return { statusCode: response.status };
          } finally { requests.delete(abort); }
        })();
        pending.add(request);
        void request.then(() => pending.delete(request), () => pending.delete(request));
        return request;
      },
      // This transport sends immediately, without an offline queue or retries.
      async flush(timeout = 2000) {
        if (!pending.size) return true;
        if (timeout <= 0) return false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            Promise.allSettled([...pending]).then(results => results.every(result => result.status === 'fulfilled')),
            new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), timeout); }),
          ]);
        } finally { if (timer) clearTimeout(timer); }
      },
    }),
  });
  const client = Sentry.getClient();
  return { stop() {
    if (stopped) return;
    stopped = true;
    requests.forEach(request => request.abort()); requests.clear();
    // close() flushes by design; close the captured client only after our transport is gated off.
    if (client) void Promise.resolve(client.close(0)).catch(() => {});
  } };
}
