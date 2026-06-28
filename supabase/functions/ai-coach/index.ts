import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type CoachMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const MAX_SYSTEM_CHARS = 5000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function isCoachMessage(value: unknown): value is CoachMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' &&
    message.content.trim().length > 0
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method === 'GET') {
    const model = Deno.env.get('ANTHROPIC_MODEL') ?? DEFAULT_MODEL;
    return json({
      ok: Boolean(Deno.env.get('ANTHROPIC_API_KEY')),
      model,
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { messages, system } = await req.json();
    if (!Array.isArray(messages) || !messages.every(isCoachMessage)) {
      return json({ error: 'Invalid coach message payload' }, 400);
    }

    if (messages.length === 0 || messages.length > MAX_MESSAGES) {
      return json({ error: `Send between 1 and ${MAX_MESSAGES} coach messages.` }, 400);
    }

    if (messages.some((message) => message.content.length > MAX_MESSAGE_CHARS)) {
      return json({ error: `Coach messages must be ${MAX_MESSAGE_CHARS} characters or fewer.` }, 400);
    }

    if (typeof system !== 'string' || !system.trim()) {
      return json({ error: 'Missing coach system prompt' }, 400);
    }

    if (system.length > MAX_SYSTEM_CHARS) {
      return json({ error: `Coach system prompt must be ${MAX_SYSTEM_CHARS} characters or fewer.` }, 400);
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return json({ error: 'ANTHROPIC_API_KEY not set' }, 500);
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      Deno.env.get('ANTHROPIC_MODEL') ?? DEFAULT_MODEL,
        max_tokens: 1024,
        system:     system.trim(),
        messages,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const message = data?.error?.message ?? data?.error ?? `Anthropic request failed with HTTP ${res.status}`;
      return json({ error: message }, res.status);
    }

    return json(data, res.status);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
