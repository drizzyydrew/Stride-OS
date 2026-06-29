import { getSupabaseFunctionHeaders } from './supabase';

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
  error?: string | { message?: string };
};

export type AiCoachHealth = {
  ok: boolean;
  model?: string;
  error?: string;
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isAiCoachConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function coachEndpoint(): string {
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/ai-coach`;
}

function errorMessage(body: CoachResponse, status: number): string {
  if (typeof body.error === 'string') {
    if (body.error.toLowerCase().includes('invalid x-api-key')) {
      return 'AI Coach backend is connected, but Anthropic rejected the API key stored in Supabase. Replace the ANTHROPIC_API_KEY secret and redeploy/check again.';
    }
    return body.error;
  }
  if (body.error?.message) return body.error.message;
  return `AI coach request failed with HTTP ${status}.`;
}

export async function checkAiCoachHealth(): Promise<AiCoachHealth> {
  if (!isAiCoachConfigured()) {
    return { ok: false, error: 'AI coach is missing Supabase configuration.' };
  }

  try {
    const response = await fetch(coachEndpoint(), {
      method: 'GET',
      headers: await getSupabaseFunctionHeaders(),
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

export async function sendCoachMessage(messages: CoachMessage[], system: string): Promise<string> {
  if (!isAiCoachConfigured()) {
    throw new Error('AI coach is missing Supabase configuration.');
  }

  const response = await fetch(coachEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getSupabaseFunctionHeaders()),
    },
    body: JSON.stringify({ messages, system }),
  });

  const body = await response.json().catch(() => ({})) as CoachResponse;

  if (!response.ok) {
    throw new Error(errorMessage(body, response.status));
  }

  const text = body.content?.find(part => typeof part.text === 'string')?.text;
  if (!text) {
    throw new Error('AI coach returned an empty response.');
  }

  return text;
}
