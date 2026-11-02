import { importPKCS8, SignJWT } from 'https://esm.sh/jose@6.1.3';
import { appleClientSecret, type AppleSecretConfig } from './appleGrantClientSecret.ts';

export function appleSecretEnvironment(): AppleSecretConfig {
  return { clientId: Deno.env.get('STRIDEOS_APPLE_CLIENT_ID'), clientSecret: Deno.env.get('STRIDEOS_APPLE_CLIENT_SECRET'),
    privateKey: Deno.env.get('STRIDEOS_APPLE_PRIVATE_KEY'), keyId: Deno.env.get('STRIDEOS_APPLE_KEY_ID'), teamId: Deno.env.get('STRIDEOS_APPLE_TEAM_ID') };
}
export async function configuredAppleClientSecret(): Promise<string> {
  return appleClientSecret(appleSecretEnvironment(), async (key, claims, kid) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'ES256', kid }).sign(await importPKCS8(key, 'ES256')));
}
