import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const requestId='71e0ff16-e219-43f2-b87b-e58db4a10214',lease='71e0ff16-e219-43f2-b87b-e58db4a10215';
const files=['supabase/functions/_shared/deletionRuntime.ts','supabase/functions/_shared/deletionProviders.ts',
  'supabase/functions/_shared/deletionHandlers.ts','supabase/functions/_shared/deletionProviderConfig.ts',
  'supabase/functions/_shared/launchHandlers.ts','src/utils/deletionFulfillment.ts'];
const sources=new Map(files.map(file=>[resolve(file),readFileSync(file,'utf8')]));
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
function harness(count=4){
  const pending=Array.from({length:count},(_,n)=>({provider:'apple' as const,kind:n%2?'apple_capture_refresh_token' as const:'apple_capture_access_token' as const,
    subject:'synthetic-sub',client_id:'synthetic.app',capture_id:`71e0ff16-e219-43f2-b87b-${String(Math.floor(n/2)+1).padStart(12,'0')}`,token:`synthetic-${n}`}));
  const acknowledged=new Set<string>(),events:string[]=[];
  const state={failAt:0,calls:0,ackFailure:false};
  const admin={rpc:async(name:string,args:any)=>{
    assert.equal(args.request_id,requestId);assert.equal(args.claim_token??args.token,lease);
    if(name==='renew_stride_deletion')return {data:true,error:null};
    assert.equal(name,'ack_stride_apple_capture_token');const token=pending.find(x=>x.capture_id===args.capture_id&&x.kind===args.token_kind)!;assert.ok(token);
    assert.equal(args.token_hash,createHash('sha256').update(token.token).digest('hex'));
    assert.equal(events.at(-1),`revoke:${token.token}`);acknowledged.add(token.token);events.push(`ack:${token.token}`);
    return state.ackFailure?{data:null,error:{message:'lost acknowledgement'}}:{data:true,error:null};
  }};
  const modules=new Map<string,{exports:any}>();
  const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,Uint8Array,AbortController,AbortSignal,setTimeout,clearTimeout,crypto:webcrypto,
    Deno:{env:{get:(name:string)=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',
      STRIDEOS_APPLE_CLIENT_ID:'synthetic.app',STRIDEOS_APPLE_CLIENT_SECRET:'synthetic-secret'} as Record<string,string>)[name]}},
    fetch:async(url:string,init:RequestInit)=>{
      assert.equal(url,'https://appleid.apple.com/auth/revoke');assert.equal(init.redirect,'error');assert.equal(init.method,'POST');assert.ok(init.signal instanceof AbortSignal);
      const form=new URLSearchParams(String(init.body));const token=pending.find(x=>x.token===form.get('token'))!;assert.ok(token);
      assert.equal(form.get('client_id'),'synthetic.app');assert.equal(form.get('client_secret'),'synthetic-secret');
      assert.equal(form.get('token_type_hint'),token.kind==='apple_capture_refresh_token'?'refresh_token':'access_token');
      state.calls++;events.push(`revoke:${token.token}`);return new Response('',{status:state.failAt===state.calls?500:200});
    },
  });
  function load(file:string):any{
    const path=resolve(file);if(modules.has(path))return modules.get(path)!.exports;
    const source=sources.get(path);assert.ok(source,`Unexpected import ${path}`);const module={exports:{}};modules.set(path,module);
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const requireMock=(name:string):any=>{
      if(name==='https://esm.sh/@supabase/supabase-js@2.48.0')return {createClient:()=>admin};
      if(name==='https://esm.sh/jose@6.1.3')return {createRemoteJWKSet:()=>({}),jwtVerify:async()=>{throw Error('Unexpected identity verification');}};
      assert.ok(name.startsWith('.'));return load(resolve(dirname(path),name));
    };
    new vm.Script(`(function(require,module,exports){${code}\n})`).runInContext(context)(requireMock,module,module.exports);return module.exports;
  }
  const api=load(files[0]!);
  return {state,events,pending,acknowledged,remaining:()=>pending.filter(x=>!acknowledged.has(x.token)),
    run:(tokens=pending)=>api.revokeRetainedAppleTokens(requestId,lease,clone(tokens))};
}
test('actual provider preparation separately revokes/ACKs refresh and access credentials for every completed response',async()=>{
  const h=harness();await h.run();assert.equal(h.state.calls,4);assert.equal(h.acknowledged.size,4);
  assert.deepEqual(h.events,h.pending.flatMap(x=>[`revoke:${x.token}`,`ack:${x.token}`]));
});
test('provider failure preserves earlier acknowledgements and never acknowledges unconfirmed credentials',async()=>{
  const h=harness();h.state.failAt=2;await assert.rejects(h.run());assert.equal(h.acknowledged.size,1);
  h.state.failAt=0;await h.run(h.remaining());assert.equal(h.acknowledged.size,4);assert.equal(h.state.calls,5);
});
test('a lost committed per-token ACK resumes from recorded progress, not an aggregate success guess',async()=>{
  const h=harness();h.state.ackFailure=true;await assert.rejects(h.run());assert.equal(h.acknowledged.size,1);
  h.state.ackFailure=false;await h.run(h.remaining());assert.equal(h.state.calls,4);assert.equal(h.acknowledged.size,4);
});
test('worker turn is bounded and unfinished credentials remain pending for a subsequent invocation',async()=>{
  const h=harness(8);await assert.rejects(h.run());assert.equal(h.state.calls,6);assert.equal(h.remaining().length,2);
  await h.run(h.remaining());assert.equal(h.acknowledged.size,8);
});
test('a stored audience mismatch never sends a token to Apple or acknowledges it',async()=>{
  const h=harness();h.pending[0]!.client_id='different.app';await assert.rejects(h.run());assert.equal(h.state.calls,0);assert.equal(h.acknowledged.size,0);
});
