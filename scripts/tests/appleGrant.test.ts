import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppleGrantHandler, appleGrantHash, type AppleGrantDependencies, type AppleGrantIdentity } from '../../supabase/functions/_shared/appleGrant';
import { appleClientSecret, appleSecretConfigured } from '../../supabase/functions/_shared/appleGrantClientSecret';
import { createDeletionAccountHandler, type DeletionHandlersDependencies } from '../../supabase/functions/_shared/deletionHandlers';
import { parseDeletionRequest } from '../../src/lib/accountDeletionProtocol';
import { publicDeletionReceipt } from '../../supabase/functions/_shared/deletionHandlers';

const owner = '71e0ff16-e219-43f2-b87b-e58db4a10214';
const rawNonce = 'a'.repeat(64);
const body = { authorizationCode: 'synthetic-code', identityToken: 'synthetic-native-id', nonce: rawNonce };
const request = (value: unknown = body, authorization = 'Bearer synthetic-session') => new Request('https://fixture.invalid/apple-grant', {
  method: 'POST', headers: { authorization }, body: JSON.stringify(value),
});
async function fixture() {
  const events: string[] = [];
  const nonce = await appleGrantHash(rawNonce);
  const identity: AppleGrantIdentity = { iss: 'https://appleid.apple.com', aud: 'synthetic.app', sub: 'apple-subject', exp: 2000, nonce };
  const state = { saved: false, deleting: false, storageFailure: false, verifyError: false, fetchError: false, exchangeStatus: 200,
    response: { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', id_token: 'synthetic-exchanged-id', token_type: 'Bearer', expires_in: 3600, discarded: 'must-not-persist' },
    native: { ...identity }, exchanged: { ...identity }, stored: undefined as unknown, codeHash: '', calls: 0, reserved: false, uncertain: false, busy: false };
  const deps: AppleGrantDependencies = {
    authenticate: async () => { events.push('auth'); return { id: owner, identities: [{ provider: 'apple', provider_id: 'apple-subject', identity_data: { sub: 'apple-subject' } }] }; },
    clientId: () => 'synthetic.app', clientSecret: async () => { events.push('secret'); return 'synthetic-server-secret'; },
    verifyIdentity: async token => { events.push('verify'); if (state.verifyError) throw Error('private JWT detail'); return token === body.identityToken ? state.native : state.exchanged; },
    captured: async (user, sub, aud, hash) => {
      events.push('captured'); assert.equal(user, owner); assert.equal(sub, 'apple-subject'); assert.equal(aud, 'synthetic.app');
      assert.equal(hash, await appleGrantHash(body.authorizationCode)); if (state.deleting) throw Error('private state'); return state.saved;
    },
    reserve: async () => { events.push('reserve'); if(state.deleting) throw Error('Deleting'); if(state.reserved || state.busy) return null; state.reserved=true; return '71e0ff16-e219-43f2-b87b-e58db4a10215'; },
    uncertain: async () => { events.push('uncertain'); if(!state.saved) state.uncertain=true; },
    store: async (user, sub, aud, hash, tokens, captureId) => {
      assert.equal(captureId,'71e0ff16-e219-43f2-b87b-e58db4a10215');
      events.push('store'); assert.equal(user, owner); assert.equal(sub, 'apple-subject'); assert.equal(aud, 'synthetic.app');
      if (state.storageFailure) throw Error('private SQL and token detail');
      state.stored = tokens; state.codeHash = hash; state.saved = true; return !state.deleting;
    },
    fetch: async (url, init) => {
      state.calls++; events.push('exchange'); assert.equal(url, 'https://appleid.apple.com/auth/token');
      assert.equal(init?.method, 'POST'); assert.equal(init?.redirect, 'error'); assert.ok(init?.signal instanceof AbortSignal);
      const form = new URLSearchParams(String(init?.body)); assert.equal(form.get('client_id'), 'synthetic.app');
      assert.equal(form.get('client_secret'), 'synthetic-server-secret'); assert.equal(form.get('code'), body.authorizationCode);
      assert.equal(form.get('grant_type'), 'authorization_code'); assert.equal(form.has('redirect_uri'), false);
      if (state.fetchError) throw Error('private transport details');
      return new Response(JSON.stringify(state.response), { status: state.exchangeStatus });
    }, now: () => 1_000_000,
  };
  return { state, deps, events, handler: () => createAppleGrantHandler(deps) };
}
test('authenticated nonce-bound capture persists only the five supported token fields before acknowledging', async () => {
  const h = await fixture(); const response = await h.handler()(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { captured: true });
  assert.deepEqual(h.events, ['auth','verify','captured','secret','reserve','exchange','verify','store']);
  assert.deepEqual(Object.keys(h.state.stored as object).sort(), ['access_token','expires_in','id_token','refresh_token','token_type']);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('lost acknowledgement retry checks owner/code hash and never re-exchanges the consumed code', async () => {
  const h = await fixture(); await h.handler()(request()); h.events.length = 0;
  const response = await h.handler()(request()); assert.deepEqual(await response.json(), { captured: true });
  assert.deepEqual(h.events, ['auth','verify','captured']); assert.equal(h.state.calls, 1);
});
test('a busy duplicate cannot exchange or mark another reservation uncertain',async()=>{
  const h=await fixture(); h.state.busy=true;
  assert.equal((await h.handler()(request())).status,503); assert.equal(h.state.calls,0);
  assert.equal(h.state.uncertain,false); assert.ok(!h.events.includes('uncertain'));
});
test('potential issuance failures stay durably uncertain, including post-response JWKS and persistence failures',async()=>{
  for(const mode of ['http','body','jwks','persist','transport']){
    const h=await fixture();
    if(mode==='http') h.state.exchangeStatus=503;
    if(mode==='body') h.deps.fetch=async()=>new Response('{truncated');
    if(mode==='jwks'){const verify=h.deps.verifyIdentity;h.deps.verifyIdentity=async(...args)=>{if(args[0]!==body.identityToken)throw Error('JWKS unavailable');return verify(...args);};}
    if(mode==='persist') h.state.storageFailure=true;
    if(mode==='transport') h.state.fetchError=true;
    assert.equal((await h.handler()(request())).status,503); assert.equal(h.state.uncertain,true,mode);
  }
});
test('lost successful store acknowledgement cannot be downgraded by the uncertainty marker',async()=>{
  const h=await fixture();const store=h.deps.store;
  h.deps.store=async(...args)=>{await store(...args);throw Error('lost acknowledgement');};
  assert.equal((await h.handler()(request())).status,503);assert.equal(h.state.saved,true);assert.equal(h.state.uncertain,false);
  assert.equal((await h.handler()(request())).status,200);
  h.state.deleting=true;assert.equal((await h.handler()(request())).status,503);
});
test('rejects unknown/extra/missing fields, oversized credentials, non-hex nonce and missing authentication before exchange', async () => {
  for (const value of [null, [], {}, { ...body, ownerId: owner }, { ...body, nonce: 'x'.repeat(64) },
    { ...body, authorizationCode: '' }, { ...body, identityToken: 'x'.repeat(16385) }, { ...body, authorizationCode: 'x\ny' }]) {
    const h = await fixture(); assert.equal((await h.handler()(request(value))).status, 503); assert.equal(h.state.calls, 0);
  }
  const h = await fixture(); assert.equal((await h.handler()(request(body, ''))).status, 503); assert.deepEqual(h.events, []);
});
test('rejects wrong issuer/audience/subject, expired/missing expiry, wrong/missing nonce and JWKS errors before exchange', async () => {
  for (const patch of [{ iss: 'wrong' }, { aud: 'wrong' }, { aud: ['synthetic.app','other'] }, { sub: 'other' },
    { exp: 1000 }, { exp: undefined }, { nonce: 'wrong' }, { nonce: undefined }]) {
    const h = await fixture(); Object.assign(h.state.native, patch);
    assert.equal((await h.handler()(request())).status, 503); assert.equal(h.state.calls, 0);
  }
  const h = await fixture(); h.state.verifyError = true; assert.equal((await h.handler()(request())).status, 503); assert.equal(h.state.calls, 0);
});
test('authenticated users without exactly one matching Apple identity cannot capture another grant', async () => {
  for (const identities of [[], [{ provider: 'email' }], [{ provider: 'apple', provider_id: 'other' }],
    [{ provider: 'apple', provider_id: 'apple-subject', identity_data: { sub: 'other' } }],
    [{ provider: 'apple', provider_id: 'apple-subject' }, { provider: 'apple', provider_id: 'other' }]]) {
    const h = await fixture(); h.deps.authenticate = async () => ({ id: owner, identities });
    assert.equal((await h.handler()(request())).status, 503); assert.equal(h.state.calls, 0);
  }
});
test('exchanged identity must match subject/audience and any returned nonce; absent exchanged nonce is supported', async () => {
  for (const patch of [{ sub: 'other' }, { aud: 'other' }, { nonce: 'wrong' }, { exp: 1000 }]) {
    const h = await fixture(); Object.assign(h.state.exchanged, patch);
    assert.equal((await h.handler()(request())).status, 503); assert.equal(h.state.saved, false);
  }
  const h = await fixture(); delete h.state.exchanged.nonce; assert.equal((await h.handler()(request())).status, 200);
});
test('provider/storage/configuration failures are secret-free 503s and never acknowledge unsafe custody', async () => {
  for (const mode of ['provider','network','storage','client','secret','deleting'] as const) {
    const h = await fixture();
    if (mode==='provider') h.state.exchangeStatus=400;
    if (mode==='network') h.state.fetchError=true;
    if (mode==='storage') h.state.storageFailure=true;
    if (mode==='client') h.deps.clientId=()=>undefined;
    if (mode==='secret') h.deps.clientSecret=async()=>{ throw Error('private key'); };
    if (mode==='deleting') h.state.deleting=true;
    const r=await h.handler()(request()); assert.equal(r.status,503);
    const result=await r.text(); assert.match(result,/fresh Apple sign-in/); assert.doesNotMatch(result,/synthetic|private|refresh_token|access_token/);
    assert.equal(h.state.saved,false);
  }
});
test('late response during deletion is retained but never acknowledges login or downgrades completed custody', async () => {
  const h=await fixture(); const fetch=h.deps.fetch;
  h.deps.fetch=async(...args)=>{ const response=await fetch(...args); h.state.deleting=true; return response; };
  assert.equal((await h.handler()(request())).status,503); assert.equal(h.state.saved,true); assert.equal(h.state.uncertain,false);
});
test('incomplete token responses cannot be persisted; raw malformed/oversized provider responses fail safely', async () => {
  for (const patch of [{ refresh_token: '' }, { token_type: 'invalid' }, { expires_in: -1 }, { expires_in: 1.2 }, { access_token: '' }]) {
    const h=await fixture(); Object.assign(h.state.response,patch);
    assert.equal((await h.handler()(request())).status,503); assert.equal(h.state.saved,false);
  }
  for (const response of ['not-json','x'.repeat(65537)]) {
    const h=await fixture(); h.deps.fetch=async()=>new Response(response);
    assert.equal((await h.handler()(request())).status,503); assert.equal(h.state.saved,false);
  }
});
test('OPTIONS is credential-free and unsupported methods never authenticate', async () => {
  const h=await fixture(); assert.equal((await h.handler()(new Request('https://fixture.invalid',{method:'OPTIONS'}))).status,200);
  assert.equal((await h.handler()(new Request('https://fixture.invalid'))).status,405); assert.deepEqual(h.events,[]);
});
test('client-secret helper mints a short-lived ES256 input with exact Apple claims; static fallback needs no signer', async () => {
  const config={clientId:'synthetic.app',privateKey:'synthetic\\nkey',keyId:'KEY',teamId:'TEAM'};
  assert.equal(appleSecretConfigured(config),true);
  const value=await appleClientSecret(config,async(key,claims,kid)=>{
    assert.equal(key,'synthetic\nkey'); assert.equal(kid,'KEY');
    assert.deepEqual(claims,{iss:'TEAM',sub:'synthetic.app',aud:'https://appleid.apple.com',iat:995,exp:1300}); return 'signed';
  },1_000_000); assert.equal(value,'signed');
  assert.equal(await appleClientSecret({clientId:'synthetic.app',clientSecret:'static'},async()=>{throw Error('unexpected');}),'static');
  assert.equal(appleSecretConfigured({clientId:'synthetic.app'}),false);
  await assert.rejects(appleClientSecret({clientId:'synthetic.app'},async()=>''));
});
test('deletion preflight exposes retained custody without returning provider credentials or changing the receipt shape', async () => {
  const deps={authenticate:async()=>({id:owner}),readAuthenticated:async()=>({request:null,apple_grant_retained:true}),
    automationEnabled:async()=>false,capabilities:()=>({appleCodeExchange:true,googleTokenRevoke:true})} as unknown as DeletionHandlersDependencies;
  const r=await createDeletionAccountHandler(deps)(new Request('https://fixture.invalid'));
  assert.equal(r.status,200); const value=await r.json(); assert.equal(value.request,null); assert.equal(value.capabilities.appleGrantRetained,true);
  assert.equal(value.capabilities.automaticProcessing,false); assert.doesNotMatch(JSON.stringify(value),/refresh_token|access_token|vault/);
});
test('new pending/manual capture reasons survive server sanitization and current client parsing without becoming legacy or revoked',()=>{
  for(const reason of ['capture_in_flight','capture_outcome_unknown']){
    const saved={id:owner,requested_at:'2026-11-02T00:00:00Z',status:'processing',provider_actions:[{provider:'apple',status:'pending',reason}]};
    const parsed=parseDeletionRequest(publicDeletionReceipt(saved));assert.equal(parsed.provider_actions![0]!.reason,reason);assert.equal(parsed.provider_actions![0]!.status,'pending');
  }
  const manual={id:owner,requested_at:'2026-11-02T00:00:00Z',status:'processing',provider_dispositions:{apple:'manual_required'},
    provider_actions:[{provider:'apple',status:'manual_required',reason:'capture_outcome_unknown'}]};
  const parsed=parseDeletionRequest(publicDeletionReceipt(manual));assert.equal(parsed.provider_actions![0]!.reason,'capture_outcome_unknown');assert.equal(parsed.provider_actions![0]!.status,'manual_required');
  const legacy=parseDeletionRequest(publicDeletionReceipt({...manual,provider_actions:[]}));assert.equal(legacy.provider_actions![0]!.reason,'legacy_token_unavailable');
});
