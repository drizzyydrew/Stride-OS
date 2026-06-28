import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type TokenRequest =
  | { grant_type: 'authorization_code'; code: string }
  | { grant_type: 'refresh_token'; refresh_token: string };

function isTokenRequest(value: unknown): value is TokenRequest {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  if (body.grant_type === 'authorization_code') {
    return typeof body.code === 'string' && body.code.trim().length > 0;
  }
  if (body.grant_type === 'refresh_token') {
    return typeof body.refresh_token === 'string' && body.refresh_token.trim().length > 0;
  }
  return false;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method === 'GET') {
    return json({
      ok: Boolean(Deno.env.get('STRAVA_CLIENT_ID') && Deno.env.get('STRAVA_CLIENT_SECRET')),
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json();
    if (!isTokenRequest(body)) {
      return json({ error: 'Invalid Strava token request' }, 400);
    }

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return json({ error: 'Strava credentials are not configured' }, 500);
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: body.grant_type,
    });

    if (body.grant_type === 'authorization_code') {
      params.set('code', body.code.trim());
    } else {
      params.set('refresh_token', body.refresh_token.trim());
    }

    const stravaResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await stravaResponse.json().catch(() => ({}));
    if (!stravaResponse.ok) {
      return json({ error: data.message ?? data.error ?? `Strava token request failed with HTTP ${stravaResponse.status}` }, stravaResponse.status);
    }

    return json(data);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
