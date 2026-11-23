import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from './supabase';
import { aiConsent } from '../store/aiConsentStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from './localDataOwner';
import { parseCoachUsage, type CoachUsage } from '../utils/coachUsage';
import { randomUUID } from 'expo-crypto';
import { unexpiredCoachMessages, type SavedCoachMessage } from '../utils/coachChatHistory';
import {
  budgetCoachMessages,
  enforceCoachSystemPrompt,
} from '../utils/coachPromptBudget';

type CoachRole = 'user' | 'assistant';

export type CoachMessage = {
  role: CoachRole;
  content: string;
};

type AnthropicTextBlock = {
  type?: string;
  text?: string;
};

type CoachResponse = {
  content?: AnthropicTextBlock[];
  createdAt?: number;
  error?: string | { message?: string };
};

export type AiCoachHealth = {
  ok: boolean;
  model?: string;
  error?: string;
};

export function isAiCoachConfigured(): boolean {
  return Boolean(getSupabaseFunctionUrl('ai-coach-v2'));
}

function coachEndpoint(): string | null {
  return getSupabaseFunctionUrl('ai-coach-v2');
}

export function coachTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

/** Read only the signed-in account's allowance; this never sends training data
 * to the AI provider or reserves a request. No client-supplied account ID. */
export async function fetchCoachUsage(signal: AbortSignal): Promise<CoachUsage> {
  const lease = captureOwnerLease(true);
  if (!lease) throw new Error('Connect to check your usage.');
  const endpoint = coachEndpoint();
  const headers = await getSupabaseFunctionHeaders();
  if (!endpoint || !headers || !ownerLeaseIsCurrent(lease, true)) throw new Error('Usage is temporarily unavailable.');
  const response = await fetch(`${endpoint}?usage=1&timezone=${encodeURIComponent(coachTimezone())}`, { method: 'GET', headers, signal });
  const body: unknown = await response.json().catch(() => null);
  if (signal.aborted || !ownerLeaseIsCurrent(lease, true)) throw new Error('The account changed.');
  if (!response.ok) throw new Error('Usage is temporarily unavailable.');
  return parseCoachUsage(body);
}

export async function recoverCoachReply(requestId: string): Promise<{ status: 'completed' | 'pending' | 'failed' | 'not_found'; text?: string; createdAt?: number }> {
  const lease = captureOwnerLease(true);
  const endpoint = coachEndpoint();
  const headers = await getSupabaseFunctionHeaders();
  if (!lease || !endpoint || !headers || !/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error('Connect to recover this reply.');
  const response = await fetch(`${endpoint}?requestId=${encodeURIComponent(requestId)}`, { headers, signal: AbortSignal.timeout(10_000) });
  const body = await response.json().catch(() => null);
  if (!ownerLeaseIsCurrent(lease, true)) throw new Error('Your account changed.');
  if (response.status === 410) throw new Error('This reply has expired. Start a new message.');
  if (response.status === 404) return { status: 'not_found' };
  if (!response.ok || !['completed', 'pending', 'failed'].includes(body?.status)) throw new Error('This reply could not be checked. Please retry online.');
  return { status: body.status, createdAt: body.createdAt,
    text: body.status === 'completed' ? body.content?.find((block: AnthropicTextBlock) => typeof block.text === 'string')?.text : undefined };
}

/** Reserves the only currently available purchase slot before opening StoreKit.
 * This never grants messages; only verified server purchase events do that. */
export async function reserveCoachPackPurchase(): Promise<string> {
  const lease = captureOwnerLease(true);
  const endpoint = coachEndpoint();
  const headers = await getSupabaseFunctionHeaders();
  if (!lease || !endpoint || !headers) throw new Error('Connect before buying messages.');
  const intentId = randomUUID();
  const response = await fetch(`${endpoint}?purchase=1`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId }), signal: AbortSignal.timeout(10_000) });
  if (!ownerLeaseIsCurrent(lease, true)) throw new Error('Your account changed.');
  if (!response.ok) throw new Error('A message pack is not available right now. Refresh your balance before retrying.');
  const body = await response.json();
  if (body?.purchaseIntent?.id !== intentId) throw new Error('The purchase could not be reserved. No payment was started.');
  return intentId;
}

export async function cancelCoachPackPurchase(intentId: string): Promise<void> {
  const endpoint = coachEndpoint();
  const headers = await getSupabaseFunctionHeaders();
  if (!endpoint || !headers) return;
  await fetch(`${endpoint}?purchase=cancel`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId }), signal: AbortSignal.timeout(10_000) });
}

function errorMessage(body: CoachResponse, status: number): string {
  if (typeof body.error === 'string') {
    if (body.error.toLowerCase().includes('invalid x-api-key')) {
      return 'AI Coach is temporarily unavailable. Your purchased messages have not been used.';
    }
    return body.error;
  }
  if (body.error?.message) return body.error.message;
  return `AI coach request failed with HTTP ${status}.`;
}

export async function checkAiCoachHealth(): Promise<AiCoachHealth> {
  const endpoint = coachEndpoint();
  const headers = await getSupabaseFunctionHeaders();
  if (!endpoint || !headers) {
    return { ok: false, error: 'AI coach is missing Supabase configuration.' };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
    });
    const body = await response.json().catch(() => ({})) as AiCoachHealth;
    if (!response.ok) {
      return {
        ok: false,
        error: body.error ?? `AI coach health check failed with HTTP ${response.status}.`,
      };
    }
    return {
      ok: Boolean(body.ok),
      model: body.model,
      error: body.ok ? undefined : 'ANTHROPIC_API_KEY is not set on the Supabase Edge Function.',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not reach AI coach health check.',
    };
  }
}

export async function sendCoachMessage(messages: (CoachMessage | SavedCoachMessage)[], system: string,
  options: { requestId?: string; timezone?: string } = {}): Promise<{ text: string; createdAt: number }> {
  const consent = aiConsent.getState();
  const lease = captureOwnerLease(true);
  if (!lease || !consent.ready || !consent.allowed || consent.owner !== lease.ownerUserId) {
    throw new Error('Enable sharing with Anthropic in AI Coach Privacy before sending a message.');
  }
  const endpoint = coachEndpoint();
  const headers = await getSupabaseFunctionHeaders();
  if (!endpoint || !headers) {
    throw new Error('AI coach is missing Supabase configuration.');
  }

  const liveMessages = messages.filter(message => (!('delivery' in message) || message.delivery !== 'failed')
    && (!('createdAt' in message) || unexpiredCoachMessages([message as SavedCoachMessage], Date.now()).length > 0));
  const budgetedMessages = budgetCoachMessages(liveMessages).map(message => ({ role: message.role, content: message.content,
    createdAt: 'createdAt' in message ? message.createdAt : Date.now() }));
  while (budgetedMessages[0]?.role === 'assistant') budgetedMessages.shift();
  const budgetedSystem = enforceCoachSystemPrompt(system);
  const current = () => ownerLeaseIsCurrent(lease, true) && aiConsent.getState().revision === consent.revision && aiConsent.getState().allowed;
  if (!current()) throw new Error('AI sharing or your account changed. Please try again.');
  const controller = new AbortController();
  const unsubscribe = aiConsent.subscribe(() => { if (!current()) controller.abort(); });
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ messages: budgetedMessages, system: budgetedSystem, consentVersion: 2,
        requestId: options.requestId ?? randomUUID(), timezone: options.timezone ?? coachTimezone() }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({})) as CoachResponse;
    if (!current()) throw new Error('AI sharing or your account changed. The response was discarded.');

    if (!response.ok) {
      throw Object.assign(new Error(errorMessage(body, response.status)), { notAccepted: [400, 402, 426].includes(response.status) });
    }

    const text = body.content?.find(part => typeof part.text === 'string')?.text;
    if (!text) {
      throw new Error('AI coach returned an empty response.');
    }

    const createdAt = body.createdAt;
    if (!Number.isFinite(createdAt) || createdAt! > Date.now() + 5 * 60_000
      || Date.now() - createdAt! >= 24 * 60 * 60 * 1000) throw new Error('This reply has expired or could not be verified.');
    return { text, createdAt: createdAt! };
  } finally { clearTimeout(timeout); unsubscribe(); }
}
