import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as flow from '../../src/lib/appleSignInFlow';
import { LocalDataOwner, LOCAL_DATA_OWNER_KEY } from '../../src/lib/localDataOwner';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const tick = () => new Promise<void>(r => setImmediate(r));
const CURRENT_SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PRIOR_SESSION_ID = '22222222-2222-4222-8222-222222222222';
function accessToken(owner: string, sessionId = CURRENT_SESSION_ID, expired = false) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({alg:'ES256',typ:'JWT'})}.${encode({sub:owner,iss:'https://fixture.supabase.co/auth/v1',session_id:sessionId,
    exp:expired ? 1 : Math.floor(Date.now()/1000)+3600})}.fixture-signature`;
}
async function harness(existingOwner: string | null = null) {
  const values = new Map<string,string>(); const history = Object.freeze([{ id: 'preserve-original-history' }]);
  const owner = new LocalDataOwner({ getItem: async key => values.get(key) ?? null, setItem: async (key,value) => { values.set(key,value); } });
  const session = (id: string, token = accessToken(id)) => ({ user: { id }, access_token: token, refresh_token: 'fixture-refresh', expires_at: 1 });
  let cache = existingOwner ? session(existingOwner,accessToken(existingOwner,PRIOR_SESSION_ID)) : null, nextOwner = 'A', depth = 0, draws = 0, clearCount = 0;
  let signOutFails = false, authFails = false, commitFails = false, commitCount = 0;
  let refreshOnCommit = false, commitFailsBeforeWrite = false, partialSessionId = CURRENT_SESSION_ID;
  const signOutScopes: unknown[] = [], capturedOwners: string[] = [], transientSignOutScopes: unknown[] = [];
  const hooks: { capture?: () => Promise<void> } = {};
  let listener: ((event:string,session:unknown)=>void) | null = null;
  let serial: Promise<unknown> = Promise.resolve();
  const client = { auth: {
    getSession: async () => ({ data: { session: cache }, error: null }),
    onAuthStateChange: (fn: typeof listener) => { listener = fn; }, stopAutoRefresh: () => undefined,
    setSession: async () => {
      commitCount++;
      if(commitFailsBeforeWrite) throw Error('private-commit-error');
      cache=session(nextOwner,accessToken(nextOwner,partialSessionId)); listener?.('SIGNED_IN',cache);
      if(commitFails)throw Error('private-persist-error');
      return { data: { session: cache }, error: null };
    },
    signOut: async (options?:unknown) => { signOutScopes.push(options); if(signOutFails) throw Error('private-signout-error'); cache=null; listener?.('SIGNED_OUT',null); },
  } };
  const transient = { auth: {
    signInWithIdToken: async () => authFails ? { data: { session: null }, error: new Error('private-auth-detail') }
      : { data: { session: session(nextOwner,accessToken(nextOwner,CURRENT_SESSION_ID,refreshOnCommit)) }, error: null },
    signOut: async (options?:unknown) => {transientSignOutScopes.push(options);},
  }, functions: {
    invoke: async (name:string,options:{headers:{Authorization:string};body:flow.AppleGrantBody;timeout:number}) => {
      assert.equal(name,'apple-grant'); assert.equal(options.timeout,15_000); assert.match(options.headers.Authorization,/^Bearer [^.]+\.[^.]+\.[^.]+$/);
      capturedOwners.push(nextOwner); await hooks.capture?.(); return { data: {captured:true}, error:null };
    },
  } };
  const file=resolve('src/store/authStore.ts'), mod={exports:{}}, native=createRequire(file);
  const mocks: Record<string,unknown> = {
    '@supabase/supabase-js': {isAuthRetryableFetchError:()=>false,createClient:(_url:string,_key:string,options:unknown)=>{
      assert.deepEqual(JSON.parse(JSON.stringify(options)),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});return transient;
    }},
    '../lib/appleSignInFlow':flow,
    '../lib/localDataOwner':{localAccessReason:()=>null, localAccessReasonUnused:null},
    '../lib/supabase': {
      localDataOwner:owner, initializeLocalOwnership:()=>owner.initialize(existingOwner,async()=>!!existingOwner), readCachedSupabaseSession:async()=>cache,
      clearCachedSupabaseSession:async()=>{clearCount++;cache=null;},getSupabaseAvailability:()=>({status:'available',client}),
      getSupabaseConfigAvailability:()=>({status:'configured',supabaseUrl:'https://fixture.supabase.co',supabaseAnonKey:'fixture-public-key'}),
      isExplicitAuthAttempt:()=>depth>0,
      withExplicitAuthAttempt:<T>(work:()=>Promise<T>,current:()=>boolean=()=>true)=>{
        depth++;const task=serial.then(async()=>{if(!current())throw Error('cancelled');return work();}).finally(()=>{depth--;});serial=task.catch(()=>undefined);return task;
      },
    },
    'expo-crypto': {getRandomBytesAsync:async()=>new Uint8Array(32).fill(++draws),CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_algorithm:string,value:string)=>createHash('sha256').update(value).digest('hex')},
    'expo-apple-authentication':{signInAsync:async({state}:{state:string})=>({state,identityToken:'fixture.identity.token',authorizationCode:'fixture-code'}),addRevokeListener:()=>undefined,AppleAuthenticationScope:{FULL_NAME:0,EMAIL:1}},
    'expo-web-browser':{},'../lib/authRedirect':{hydrateUserData:async()=>undefined},
    './workoutStore':{useWorkoutStore:{getState:()=>({restorePendingCompletions:async()=>undefined})}},'./strengthStore':{},'./customWorkoutStore':{},'./checkInStore':{},
  };
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:(id:string)=>Object.hasOwn(mocks,id)?mocks[id]:native(id),console,setTimeout,clearTimeout,Date},{filename:file});
  const store=(mod.exports as typeof import('../../src/store/authStore')).useAuthStore; await store.getState().initialize();
  return {store,owner,values,history,hooks,signOutScopes,transientSignOutScopes,capturedOwners,setNextOwner:(id:string)=>{nextOwner=id;},
    failCommit:()=>{commitFails=true;},failSignOut:()=>{signOutFails=true;},failAuth:()=>{authFails=true;},
    refreshOnCommit:()=>{refreshOnCommit=true;},failBeforeCommitWrite:()=>{commitFailsBeforeWrite=true;},
    differentPartialSession:()=>{partialSessionId=PRIOR_SESSION_ID;},
    counts:()=>({clearCount,cacheOwner:cache?.user.id??null,commitCount})};
}

test('actual auth store publishes a fresh owner only after grant custody is confirmed',async()=>{
  const h=await harness();const capture=deferred<void>();h.hooks.capture=()=>capture.promise;
  const work=h.store.getState().signInWithApple();await tick();
  assert.equal(h.store.getState().canAccessLocalData,false);assert.equal(h.owner.ownerUserId,null);assert.deepEqual(h.capturedOwners,['A']);
  assert.equal(h.counts().cacheOwner,null);assert.equal(h.counts().commitCount,0,'process termination here leaves no stored new session');
  capture.resolve();assert.equal(await work,null);assert.equal(h.owner.ownerUserId,'A');assert.equal(h.store.getState().canAccessLocalData,true);
  assert.equal(h.counts().commitCount,1);
});
test('failed capture never replaces a previously valid session, history or owner',async()=>{
  const h=await harness('A');h.hooks.capture=async()=>{throw Error('private-server-detail');};
  assert.equal(await h.store.getState().signInWithApple(),flow.APPLE_SIGN_IN_INCOMPLETE);
  assert.equal(h.owner.ownerUserId,'A');assert.equal(h.owner.logoutFenced,false);assert.equal(h.store.getState().canAccessLocalData,true);
  assert.equal(h.signOutScopes.length,0);assert.equal(h.transientSignOutScopes.length,1);assert.deepEqual(h.counts(),{clearCount:0,cacheOwner:'A',commitCount:0});
  assert.equal(h.history[0].id,'preserve-original-history');assert.equal(JSON.parse(h.values.get(LOCAL_DATA_OWNER_KEY)!).ownerUserId,'A');
});
test('a failed durable commit clears cached partial credentials before SDK logout failure and leaves the owner fenced',async()=>{
  const h=await harness('A');h.failCommit();h.failSignOut();
  assert.equal(await h.store.getState().signInWithApple(),flow.APPLE_SIGN_IN_INCOMPLETE);
  assert.equal(h.owner.logoutFenced,true);assert.equal(h.store.getState().canAccessLocalData,false);assert.equal(h.counts().cacheOwner,null);assert.equal(h.counts().clearCount,1);
});
test('an expired transient token refreshed and persisted before a commit error is cleaned by session identity',async()=>{
  const h=await harness('A');h.refreshOnCommit();h.failCommit();h.failSignOut();
  assert.equal(await h.store.getState().signInWithApple(),flow.APPLE_SIGN_IN_INCOMPLETE);
  assert.equal(h.owner.ownerUserId,'A');assert.equal(h.owner.logoutFenced,true);
  assert.equal(h.store.getState().canAccessLocalData,false);
  assert.deepEqual(h.counts(),{clearCount:1,cacheOwner:null,commitCount:1});
  assert.equal(h.signOutScopes.length,1);assert.equal(h.history[0].id,'preserve-original-history');
});
test('failed commit cannot clear a different SDK session belonging to the same owner',async()=>{
  const h=await harness('A');h.refreshOnCommit();h.differentPartialSession();h.failCommit();
  assert.equal(await h.store.getState().signInWithApple(),flow.APPLE_SIGN_IN_INCOMPLETE);
  assert.equal(h.owner.logoutFenced,false);assert.equal(h.counts().clearCount,0);
  assert.equal(h.counts().cacheOwner,'A');assert.equal(h.signOutScopes.length,0);
});
test('a commit failure before writing preserves the prior same-owner session',async()=>{
  const h=await harness('A');h.failBeforeCommitWrite();
  assert.equal(await h.store.getState().signInWithApple(),flow.APPLE_SIGN_IN_INCOMPLETE);
  assert.equal(h.owner.logoutFenced,false);assert.equal(h.store.getState().canAccessLocalData,true);
  assert.equal(h.counts().clearCount,0);assert.equal(h.counts().cacheOwner,'A');
  assert.equal(h.signOutScopes.length,0);assert.equal(h.history.length,1);
});
test('a successful refreshed session transfer is published without transient revocation',async()=>{
  const h=await harness();h.refreshOnCommit();
  assert.equal(await h.store.getState().signInWithApple(),null);
  assert.equal(h.store.getState().canAccessLocalData,true);assert.equal(h.counts().cacheOwner,'A');
  assert.equal(h.transientSignOutScopes.length,0);assert.equal(h.signOutScopes.length,0);
});
test('an auth failure without a partial session does not sign out a previously valid owner',async()=>{
  const h=await harness('A');h.failAuth();assert.equal(h.store.getState().canAccessLocalData,true);
  assert.equal(await h.store.getState().signInWithApple(),flow.APPLE_SIGN_IN_INCOMPLETE);
  assert.equal(h.store.getState().canAccessLocalData,true);assert.equal(h.signOutScopes.length,0);assert.equal(h.counts().clearCount,0);assert.equal(h.history.length,1);
});
test('logout while capture is in flight is not reversed by a late success',async()=>{
  const h=await harness();const capture=deferred<void>();h.hooks.capture=()=>capture.promise;
  const work=h.store.getState().signInWithApple();await tick();await h.store.getState().signOut();capture.resolve();
  assert.match((await work)!,/cancelled/);assert.equal(h.store.getState().canAccessLocalData,false);assert.equal(h.owner.logoutFenced,true);assert.equal(h.signOutScopes.length,1);
});
test('a newer explicit owner wins; old capture failure does not clear their credentials or adopt old history',async()=>{
  const h=await harness();const capture=deferred<void>();let count=0;h.hooks.capture=async()=>{if(++count===1)await capture.promise;};
  const first=h.store.getState().signInWithApple();await tick();h.setNextOwner('B');const second=h.store.getState().signInWithApple();await tick();capture.resolve();
  assert.match((await first)!,/cancelled/);assert.equal(await second,null);assert.equal(h.owner.ownerUserId,'B');assert.equal(h.store.getState().user?.id,'B');assert.equal(h.counts().cacheOwner,'B');assert.equal(h.signOutScopes.length,0);
});
