import type { ObservabilityConsent } from '../utils/observabilityConsent';
import { sanitizeProductEvent } from '../utils/observabilityPrivacy';

type Connection = { capture?: (name: string, properties: Record<string, unknown>) => void; stop: () => void };
type Factory = (isActive: () => boolean) => Promise<Connection>;

export function createObservabilityRuntime(factories: { usage: Factory; diagnostics: Factory }) {
  const slots: Record<'usage' | 'diagnostics', { active: boolean; owner: string | null; generation: number; connection?: Connection }> = {
    usage: { active: false, owner: null, generation: 0 }, diagnostics: { active: false, owner: null, generation: 0 },
  };
  function track(name: string, properties: Record<string, unknown> = {}) {
    try {
      const event = sanitizeProductEvent(name, properties);
      if (event && slots.usage.active) slots.usage.connection?.capture?.(event.event, event.properties);
    } catch { /* Telemetry cannot interrupt training. */ }
  }
  return {
    track,
    sync(consent: ObservabilityConsent) {
      for (const key of ['usage', 'diagnostics'] as const) {
        const slot = slots[key];
        const allowed = consent.ready && consent.owner != null && consent[key] === true;
        if (allowed === slot.active && consent.owner === slot.owner) continue;
        slot.active = false;
        slot.generation += 1;
        try { slot.connection?.stop(); } catch { /* Already disabled at the transport boundary. */ }
        slot.connection = undefined;
        slot.owner = consent.owner;
        if (!allowed) continue;
        slot.active = true;
        const generation = slot.generation;
        const isActive = () => slot.active && slot.generation === generation;
        try {
          void factories[key](isActive).then(connection => {
            if (!isActive()) { connection.stop(); return; }
            slot.connection = connection;
            if (key === 'usage') track('app_opened');
          }).catch(() => { if (isActive()) slot.active = false; });
        } catch { slot.active = false; }
      }
    },
  };
}

export const observability = createObservabilityRuntime({
  usage: async isActive => (await import('./observabilityClients')).connectUsage(isActive),
  diagnostics: async isActive => (await import('./observabilityClients')).connectDiagnostics(isActive),
});
