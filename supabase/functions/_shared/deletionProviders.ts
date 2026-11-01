/** Server-only provider disconnect. Never persist/log request bodies or tokens here. */
export type DeletionProviderAction = {
  provider: 'apple' | 'google';
  status: 'revoked' | 'manual_required';
  reason: 'provider_confirmed' | 'legacy_token_unavailable';
};
export type ProviderCredentials = { token?: string; authorizationCode?: string };
export type ProviderConfig = { appleClientId?: string; appleClientSecret?: string; googleClientId?: string };
export type ProviderDependencies = {
  fetch: typeof fetch;
  verifyAppleIdentity: (jwt: string, clientId: string) => Promise<{ sub?: string }>;
  saveAppleRefreshToken: (token: string) => Promise<void>;
};

export class ProviderRemovalError extends Error {
  constructor(readonly code: 'configuration' | 'identity' | 'provider_unavailable' | 'invalid_response' | 'credential_refresh_required') {
    super('Provider disconnection is not confirmed. The deletion request remains pending.');
    this.name = 'ProviderRemovalError';
  }
}

function credential(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 16_384 && !/[\r\n\0]/.test(value);
}

async function request(fetcher: typeof fetch, url: string, init: RequestInit, expectJson = true): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(url, { ...init, redirect: 'error', signal: controller.signal });
    if (!response.ok) {
      let errorCode: unknown;
      const reader = response.body?.getReader();
      if (reader) {
        const parts: Uint8Array[] = []; let size = 0;
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 4096) { parts.length = 0; break; }
            parts.push(part.value);
          }
          const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
          let offset = 0;
          for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
          try { errorCode = JSON.parse(new TextDecoder().decode(bytes))?.error; } catch { /* No provider details escape. */ }
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      }
      throw new ProviderRemovalError(errorCode === 'invalid_client' ? 'configuration'
        : errorCode === 'invalid_grant' || errorCode === 'invalid_token'
          || ((response.status === 400 || response.status === 401) && url.startsWith('https://oauth2.googleapis.com/tokeninfo?'))
          ? 'credential_refresh_required' : 'provider_unavailable');
    }
    if (!expectJson) { await response.body?.cancel(); return {}; }
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderRemovalError('invalid_response');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 32_768) { await reader.cancel(); throw new ProviderRemovalError('invalid_response'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderRemovalError('invalid_response');
    return value;
  } catch (error) {
    if (error instanceof ProviderRemovalError) throw error;
    throw new ProviderRemovalError('provider_unavailable');
  } finally { clearTimeout(timer); }
}

export async function disconnectDeletionProvider(
  provider: 'apple' | 'google', subject: string, credentials: ProviderCredentials,
  config: ProviderConfig, deps: ProviderDependencies,
): Promise<DeletionProviderAction> {
  if (!credential(subject)) throw new ProviderRemovalError('identity');
  if (!credentials.token && !credentials.authorizationCode) {
    // Missing legacy credentials must not indefinitely prevent account removal.
    // This is explicitly documented for Apple in TN3194. The UI separately
    // explains that provider access is not represented as automatically revoked.
    return { provider, status: 'manual_required', reason: 'legacy_token_unavailable' };
  }
  if ((credentials.token && !credential(credentials.token))
    || (credentials.authorizationCode && !credential(credentials.authorizationCode))) throw new ProviderRemovalError('invalid_response');
  if (provider === 'google') {
    if (!credential(config.googleClientId) || !credential(credentials.token)) throw new ProviderRemovalError('configuration');
    // Google's token-info contract uses a query parameter. This fixed URL is
    // server-only, never returned, logged or sent to an analytics provider.
    const info = await request(deps.fetch, `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(credentials.token)}`, { method: 'GET' });
    if (info.sub !== subject || info.aud !== config.googleClientId) throw new ProviderRemovalError('identity');
    await request(deps.fetch, 'https://oauth2.googleapis.com/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: credentials.token }).toString(),
    }, false);
  } else {
    if (!credential(config.appleClientId) || !credential(config.appleClientSecret)) throw new ProviderRemovalError('configuration');
    let token = credentials.token;
    if (credentials.authorizationCode) {
      const exchanged = await request(deps.fetch, 'https://appleid.apple.com/auth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.appleClientId, client_secret: config.appleClientSecret,
          grant_type: 'authorization_code', code: credentials.authorizationCode }).toString(),
      });
      if (!credential(exchanged.id_token) || !credential(exchanged.refresh_token)) throw new ProviderRemovalError('invalid_response');
      let identity: { sub?: string };
      try { identity = await deps.verifyAppleIdentity(exchanged.id_token, config.appleClientId); }
      catch { throw new ProviderRemovalError('identity'); }
      if (identity.sub !== subject) throw new ProviderRemovalError('identity');
      token = exchanged.refresh_token;
      // Authorization codes are single-use. Secure the verified refresh token
      // before revocation so a failed provider call can resume without the code.
      try { await deps.saveAppleRefreshToken(token); }
      catch { throw new ProviderRemovalError('provider_unavailable'); }
    }
    if (!credential(token)) throw new ProviderRemovalError('invalid_response');
    await request(deps.fetch, 'https://appleid.apple.com/auth/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.appleClientId, client_secret: config.appleClientSecret,
        token, token_type_hint: 'refresh_token' }).toString(),
    }, false);
  }
  return { provider, status: 'revoked', reason: 'provider_confirmed' };
}
