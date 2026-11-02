export type AppleSecretConfig = {
  clientId?: string; clientSecret?: string; privateKey?: string; keyId?: string; teamId?: string;
};
export type AppleSecretSigner = (key: string, claims: {
  iss: string; sub: string; aud: string; iat: number; exp: number;
}, keyId: string) => Promise<string>;

export function appleSecretConfigured(config: AppleSecretConfig): boolean {
  return Boolean(config.clientId && (config.clientSecret || (config.privateKey && config.keyId && config.teamId)));
}

// Private key and resulting client secret stay in server memory; never cache in a client or log.
export async function appleClientSecret(config: AppleSecretConfig, sign: AppleSecretSigner, now = Date.now()): Promise<string> {
  if (!config.clientId) throw new Error('Apple configuration unavailable');
  if (config.privateKey && config.keyId && config.teamId) {
    const issued = Math.floor(now / 1000);
    return sign(config.privateKey.replace(/\\n/g, '\n'), {
      iss: config.teamId, sub: config.clientId, aud: 'https://appleid.apple.com', iat: issued - 5, exp: issued + 300,
    }, config.keyId);
  }
  if (config.clientSecret) return config.clientSecret;
  throw new Error('Apple configuration unavailable');
}
